import type { Config } from '@backstage/config';
import type { AgentRun, RunEvent, TelemetryProvider, AgentInsights } from '@acarmisc/backstage-plugin-ai-agents-backend';

export interface LangfuseConfig {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  lookbackHours: number;
  runningWindowSeconds: number;
  /** Prefix of the OTel service name, e.g. `abs_ces_agents_` → `abs_ces_agents_dinesh.DEFAULT`. */
  servicePrefix: string;
  cacheTtlMs: number;
}

export function readLangfuseConfig(config: Config): LangfuseConfig | undefined {
  const c = config.getOptionalConfig('ai-agents.telemetry.langfuse');
  if (!c) return undefined;
  return {
    baseUrl: c.getString('baseUrl').replace(/\/+$/, ''),
    publicKey: c.getString('publicKey'),
    secretKey: c.getString('secretKey'),
    lookbackHours: c.getOptionalNumber('lookbackHours') ?? 24,
    runningWindowSeconds: c.getOptionalNumber('runningWindowSeconds') ?? 90,
    servicePrefix: c.getOptionalString('servicePrefix') ?? 'abs_ces_agents_',
    cacheTtlMs: c.getOptionalNumber('cacheTtlMs') ?? 4000,
  };
}

/** The subset of a Langfuse v2 observation this provider reads. */
interface Observation {
  id: string;
  traceId: string;
  type: string;
  name: string;
  startTime: string;
  endTime?: string | null;
  level?: string;
  latency?: number | null;
  metadata?: Record<string, unknown>;
}

const TOOL_NAME_KEY = 'attributes.gen_ai.tool.name';
const TOOL_STATUS_KEY = 'attributes.gen_ai.tool.status';
const TARGET_KEY = 'attributes.ces.agent.target';
const PROJECT_KEY = 'attributes.ces.agent.project';
const SERVICE_KEY = 'resourceAttributes.aws.local.service';
const PAGE_SIZE = 1000;
const MAX_PAGES = 3;
const RUNNING_LOOKBACK_MS = 15 * 60_000;

type FetchFn = typeof fetch;
type Filter = Record<string, unknown>;

const eq = (column: string, value: string): Filter => ({ type: 'string', column, operator: '=', value });

/** Nearest-rank percentile: sorted ascending, index = ceil(p/100*n)-1 */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/** `review_quality` is a JSON object, or its (possibly truncated) string form. */
function readQuality(meta: Record<string, unknown> | undefined): {
  risk?: string;
  posted?: boolean;
  completed?: boolean;
  incomplete?: string;
} {
  const raw = meta?.review_quality;
  if (raw && typeof raw === 'object') {
    const q = raw as Record<string, unknown>;
    return {
      risk: typeof q.risk_tier === 'string' ? q.risk_tier : undefined,
      posted: typeof q.posted === 'boolean' ? q.posted : undefined,
      completed: typeof q.completed === 'boolean' ? q.completed : undefined,
      incomplete: typeof q.incomplete_reason === 'string' ? q.incomplete_reason : undefined,
    };
  }
  if (typeof raw !== 'string') return {};
  const str = (k: string) => raw.match(new RegExp(`"${k}":\\s*"([^"]*)"`))?.[1];
  const bool = (k: string) => {
    const m = raw.match(new RegExp(`"${k}":\\s*(true|false)`))?.[1];
    return m === undefined ? undefined : m === 'true';
  };
  return { risk: str('risk_tier'), posted: bool('posted'), completed: bool('completed'), incomplete: str('incomplete_reason') };
}

function postedLabel(posted: boolean | undefined): string | undefined {
  if (posted === undefined) return undefined;
  return posted ? 'posted' : 'nothing posted';
}

function verdict(q: ReturnType<typeof readQuality>): string | undefined {
  const parts = [
    q.risk ? `risk ${q.risk}` : undefined,
    postedLabel(q.posted),
    q.incomplete ? `incomplete: ${q.incomplete}` : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Numeric targets are GitLab MR iids; anything else (e.g. a Jira key) is shown as is. */
function displayTarget(meta: Record<string, unknown> | undefined): string | undefined {
  const t = meta?.[TARGET_KEY];
  if (typeof t !== 'string' || !t) return undefined;
  return /^\d+$/.test(t) ? `!${t}` : t;
}

function stringAttr(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' && v ? v : undefined;
}

function toolName(o: Observation): string {
  const n = o.metadata?.[TOOL_NAME_KEY];
  return typeof n === 'string' && n ? n : o.name;
}

function toolFailed(o: Observation): boolean {
  const st = o.metadata?.[TOOL_STATUS_KEY];
  return o.level === 'ERROR' || (typeof st === 'string' && st !== 'success');
}

/**
 * Builds agent runs from the Langfuse project the agents trace into.
 *
 * Each invocation is an `<agent>-invoke` AGENT observation (one trace); its
 * tool calls are TOOL observations from the Strands tracer. The invoke span
 * is exported only when the run ends, so a trace that already has tool
 * observations but no invoke span yet is reported as `running`.
 *
 * Only core/basic/metadata fields are requested (never `io`, which holds
 * prompts and tool arguments) and only an explicit allow-list of derived
 * values leaves the backend.
 */
export class LangfuseTelemetryProvider implements TelemetryProvider {
  private readonly cache = new Map<string, { at: number; value: Promise<Observation[]> }>();

  constructor(
    private readonly cfg: LangfuseConfig,
    private readonly doFetch: FetchFn = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async getRuns(telemetryId: string, limit = 5): Promise<AgentRun[]> {
    const [invokes, recentTools] = await Promise.all([
      this.query([eq('type', 'AGENT'), eq('name', `${telemetryId}-invoke`)], 1),
      this.query(
        [
          eq('type', 'TOOL'),
          { type: 'stringObject', column: 'metadata', key: SERVICE_KEY, operator: 'contains', value: `${this.cfg.servicePrefix}${telemetryId}` },
        ],
        1,
        RUNNING_LOOKBACK_MS,
      ),
    ]);

    const finished = new Set(invokes.map(o => o.traceId));
    const runs: AgentRun[] = invokes.map(o => this.finishedRun(telemetryId, o));

    const live = new Map<string, Observation[]>();
    for (const t of recentTools) {
      if (finished.has(t.traceId)) continue;
      live.set(t.traceId, [...(live.get(t.traceId) ?? []), t]);
    }
    for (const [traceId, tools] of live) runs.push(this.liveRun(telemetryId, traceId, tools));

    runs.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
    return runs.slice(0, limit);
  }

  async getRunTimeline(telemetryId: string, runId: string): Promise<RunEvent[] | null> {
    const obs = (await this.query([eq('traceId', runId)])).filter(o => o.traceId === runId);
    const invoke = obs.find(o => o.type === 'AGENT' && o.name === `${telemetryId}-invoke`);
    const tools = obs.filter(o => o.type === 'TOOL').sort((a, b) => a.startTime.localeCompare(b.startTime));
    const owned =
      invoke ||
      tools.some(o => String(o.metadata?.[SERVICE_KEY] ?? '').startsWith(`${this.cfg.servicePrefix}${telemetryId}`));
    if (!owned) return null;

    const events: RunEvent[] = [
      { seq: 0, name: `${telemetryId}:start`, event: 'start', ts: (invoke ?? tools[0]).startTime },
      ...tools.map(
        (t, i): RunEvent => ({
          seq: i + 1,
          name: `${telemetryId}:${toolName(t)}`,
          event: 'tool',
          tool: toolName(t),
          outcome: toolFailed(t) ? 'error' : 'ok',
          durationMs: typeof t.latency === 'number' ? Math.round(t.latency * 1000) : undefined,
          ts: t.endTime ?? t.startTime,
        }),
      ),
    ];
    if (invoke) {
      events.push({
        seq: tools.length + 1,
        name: `${telemetryId}:completed`,
        event: 'completed',
        incomplete: invoke.level === 'ERROR' ? 'invocation_failed' : readQuality(invoke.metadata).incomplete,
        ts: invoke.endTime ?? invoke.startTime,
      });
    }
    return events;
  }

  async getInsights(telemetryId: string, hours: number): Promise<AgentInsights> {
    const clampedHours = Math.min(Math.max(hours, 1), 72);
    const withinMs = clampedHours * 3600_000;

    // Fetch invoke observations and tool observations in parallel
    const [invokes, tools] = await Promise.all([
      this.query([eq('type', 'AGENT'), eq('name', `${telemetryId}-invoke`)], MAX_PAGES, withinMs),
      this.query(
        [
          eq('type', 'TOOL'),
          { type: 'stringObject', column: 'metadata', key: SERVICE_KEY, operator: 'contains', value: `${this.cfg.servicePrefix}${telemetryId}` },
        ],
        MAX_PAGES,
        withinMs,
      ),
    ]);

    // Build a set of finished trace IDs (those with invoke observations)
    const finishedTraces = new Set(invokes.map(o => o.traceId));

    // Categorize runs: finished (from invokes) and live/unknown (from tools without invokes)
    const finished: Array<{ traceId: string; startTime: string; endTime: string; state: 'completed' | 'failed' }> = invokes.map(o => ({
      traceId: o.traceId,
      startTime: o.startTime,
      endTime: o.endTime ?? o.startTime,
      state: o.level === 'ERROR' ? 'failed' : 'completed',
    }));

    // Group tools by trace to find live/unknown runs
    const liveTraces = new Map<string, Observation[]>();
    for (const tool of tools) {
      if (finishedTraces.has(tool.traceId)) continue; // Skip traces with invoke observations
      liveTraces.set(tool.traceId, [...(liveTraces.get(tool.traceId) ?? []), tool]);
    }

    const live: Array<{ traceId: string; startTime: string; state: 'running' | 'unknown' }> = [];
    for (const [traceId, traceTools] of liveTraces) {
      const sorted = [...traceTools].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const last = sorted[sorted.length - 1];
      const lastEnd = last.endTime ?? last.startTime;
      const active = this.now() - Date.parse(lastEnd) < this.cfg.runningWindowSeconds * 1000;
      live.push({
        traceId,
        startTime: sorted[0].startTime,
        state: active ? 'running' : 'unknown',
      });
    }

    // Calculate totals
    const totals = {
      runs: finished.length + live.length,
      completed: finished.filter(r => r.state === 'completed').length,
      failed: finished.filter(r => r.state === 'failed').length,
      running: live.filter(r => r.state === 'running').length,
      unknown: live.filter(r => r.state === 'unknown').length,
    };

    // Calculate duration stats for finished runs
    const durations = finished
      .map(r => Date.parse(r.endTime) - Date.parse(r.startTime))
      .filter(d => d > 0);
    const durationMs = {
      p50: durations.length ? percentile(durations, 50) : 0,
      p95: durations.length ? percentile(durations, 95) : 0,
    };

    // Build histogram: exactly clampedHours buckets, oldest first
    // Each bucket represents a UTC hour: bucket start = UTC hour start for each of the last clampedHours hours INCLUDING current hour
    const now = this.now();
    const buckets = [];
    for (let i = clampedHours - 1; i >= 0; i--) {
      const bucketTime = now - i * 3600_000;
      const bucketDate = new Date(bucketTime);
      bucketDate.setUTCMinutes(0, 0, 0);
      const isoStr = bucketDate.toISOString();
      // Remove milliseconds to match expected format (HH:MM:00Z instead of HH:MM:00.000Z)
      const bucketStart = isoStr.replace(/\.\d{3}Z$/, 'Z');
      const bucketEnd = new Date(Date.parse(bucketStart) + 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

      const runsInBucket = finished.filter(r => {
        const runStart = Date.parse(r.startTime);
        return runStart >= Date.parse(bucketStart) && runStart < Date.parse(bucketEnd);
      });

      buckets.push({
        start: bucketStart,
        runs: runsInBucket.length,
        failed: runsInBucket.filter(r => r.state === 'failed').length,
      });
    }

    // Aggregate tools: group by name, calculate stats
    const toolStats = new Map<string, { calls: number; errors: number; latencies: number[] }>();
    for (const tool of tools) {
      const name = toolName(tool);
      const stat = toolStats.get(name) ?? { calls: 0, errors: 0, latencies: [] };
      stat.calls++;
      if (toolFailed(tool)) stat.errors++;
      if (typeof tool.latency === 'number') {
        stat.latencies.push(tool.latency * 1000); // Convert seconds to ms
      }
      toolStats.set(name, stat);
    }

    // Convert to array and sort by calls descending, take top 10
    const topTools = Array.from(toolStats.entries())
      .map(([name, stat]) => ({
        name,
        calls: stat.calls,
        errors: stat.errors,
        avgMs: stat.latencies.length ? Math.round(stat.latencies.reduce((a, b) => a + b, 0) / stat.latencies.length) : 0,
        p95Ms: stat.latencies.length ? Math.round(percentile(stat.latencies, 95)) : 0,
      }))
      .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
      .slice(0, 10);

    return {
      windowHours: clampedHours,
      totals,
      durationMs,
      histogram: buckets,
      tools: topTools,
    };
  }

  private finishedRun(agent: string, o: Observation): AgentRun {
    const q = readQuality(o.metadata);
    return {
      runId: o.traceId,
      agent,
      target: displayTarget(o.metadata),
      project: stringAttr(o.metadata, PROJECT_KEY),
      state: o.level === 'ERROR' ? 'failed' : 'completed',
      startedAt: o.startTime,
      updatedAt: o.endTime ?? o.startTime,
      verdict: verdict(q),
    };
  }

  private liveRun(agent: string, traceId: string, tools: Observation[]): AgentRun {
    const sorted = [...tools].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const last = sorted[sorted.length - 1];
    const lastEnd = last.endTime ?? last.startTime;
    const active = this.now() - Date.parse(lastEnd) < this.cfg.runningWindowSeconds * 1000;
    return {
      runId: traceId,
      agent,
      state: active ? 'running' : 'unknown',
      startedAt: sorted[0].startTime,
      updatedAt: lastEnd,
      currentActivity: active ? `after ${toolName(last)}` : undefined,
    };
  }

  private query(filters: Filter[], pages = MAX_PAGES, withinMs?: number): Promise<Observation[]> {
    const key = JSON.stringify([filters, pages, withinMs]);
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.cfg.cacheTtlMs) return hit.value;
    const value = this.fetchAll(filters, pages, withinMs);
    this.cache.set(key, { at: this.now(), value });
    value.catch(() => this.cache.delete(key));
    if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value as string);
    return value;
  }

  private async fetchAll(filters: Filter[], pages: number, withinMs?: number): Promise<Observation[]> {
    const from = new Date(this.now() - (withinMs ?? this.cfg.lookbackHours * 3600_000)).toISOString();
    const auth = `Basic ${Buffer.from(`${this.cfg.publicKey}:${this.cfg.secretKey}`).toString('base64')}`;
    const out: Observation[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < pages; page++) {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        fields: 'core,basic,metadata',
        fromStartTime: from,
        filter: JSON.stringify(filters),
      });
      if (cursor) qs.set('cursor', cursor);
      const res = await this.doFetch(`${this.cfg.baseUrl}/api/public/v2/observations?${qs}`, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Langfuse observations query failed: ${res.status}`);
      const body = (await res.json()) as { data?: Observation[]; meta?: { cursor?: string } };
      out.push(...(body.data ?? []));
      cursor = body.meta?.cursor;
      if (!cursor || !(body.data ?? []).length) break;
    }
    return out;
  }
}
