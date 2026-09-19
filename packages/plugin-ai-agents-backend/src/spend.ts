import type { Config } from '@backstage/config';
import { LiteLLMClient, normalizeRequestTags } from '@acarmisc/backstage-plugin-litellm-backend';

/** Aggregated spend for a conversation or agent. */
export interface SpendSummary {
  /** Total USD spend across the matched requests. */
  spend: number;
  totalTokens: number;
  requests: number;
  /** Model -> spend, for per-model breakdown. */
  byModel: Record<string, number>;
}

/** A row consumed for aggregation; kept narrow so tests need no LiteLLM. */
export interface SpendRow {
  spend?: number;
  total_tokens?: number;
  model?: string;
  request_tags?: string[] | Record<string, string>;
}

export interface SpendReader {
  /** Reads spend rows for a date window, optionally scoped to a key. */
  getSpendLogs(params: {
    start_date: string;
    end_date: string;
    page_size?: number;
  }): Promise<SpendRow[]>;
}

/**
 * Reads `litellm.baseUrl` / `litellm.masterKey` (the same config the govai
 * plugin uses) and builds a spend reader. Returns undefined when LiteLLM is
 * not configured, so the spend route can degrade to 501.
 */
export function buildSpendReader(config: Config): SpendReader | undefined {
  const baseUrl = config.getOptionalString('litellm.baseUrl');
  const masterKey = config.getOptionalString('litellm.masterKey');
  if (!baseUrl || !masterKey) return undefined;
  const client = new LiteLLMClient({ baseUrl, masterKey });
  return {
    getSpendLogs: params => client.getSpendLogs(params) as Promise<SpendRow[]>,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Aggregates spend rows that carry `session:<threadId>` in their request
 * tags. Falls back to `entity:<ref>` when no thread is given, so per-agent
 * totals (all threads) work too. Rows with malformed tags are skipped.
 */
export function aggregateSpend(
  rows: SpendRow[],
  matcher: (tags: string[]) => boolean,
): SpendSummary {
  const summary: SpendSummary = { spend: 0, totalTokens: 0, requests: 0, byModel: {} };
  for (const row of rows) {
    const tags = normalizeRequestTags(row.request_tags as any);
    if (!matcher(tags)) continue;
    const spend = typeof row.spend === 'number' ? row.spend : Number(row.spend ?? 0);
    summary.spend += Number.isFinite(spend) ? spend : 0;
    summary.totalTokens += row.total_tokens ?? 0;
    summary.requests += 1;
    if (row.model) {
      summary.byModel[row.model] = (summary.byModel[row.model] ?? 0) + (Number.isFinite(spend) ? spend : 0);
    }
  }
  return summary;
}

/** The default lookback window for a spend query. */
export const DEFAULT_SPEND_DAYS = 30;

/**
 * Resolve the date window for a spend query. `days` is clamped to
 * [1, 90] to keep the admin `/spend/logs` query bounded.
 */
export function spendWindow(days?: number, now: Date = new Date()): { start_date: string; end_date: string } {
  const clamped = Math.min(Math.max(Math.floor(days ?? DEFAULT_SPEND_DAYS), 1), 90);
  const end = now;
  const start = new Date(end.getTime() - (clamped - 1) * 24 * 60 * 60 * 1000);
  return { start_date: isoDate(start), end_date: isoDate(end) };
}

/** Filter helper: does a tag list match a thread or entity tag? */
export function spendTagMatcher(opts: { threadId?: string; entityRef: string }): (tags: string[]) => boolean {
  if (opts.threadId) {
    const needle = `session:${opts.threadId}`;
    return tags => tags.includes(needle);
  }
  const needle = `backstage-entity:${opts.entityRef}`;
  return tags => tags.includes(needle);
}
