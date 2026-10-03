import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigReader } from '@backstage/config';
import { LangfuseTelemetryProvider, readLangfuseConfig, LangfuseConfig } from './provider';

const cfg: LangfuseConfig = {
  baseUrl: 'http://lf',
  publicKey: 'pk',
  secretKey: 'sk',
  lookbackHours: 24,
  runningWindowSeconds: 90,
  servicePrefix: 'abs_ces_agents_',
  cacheTtlMs: 1000,
};
const NOW = Date.parse('2026-10-03T10:00:00Z');
const SVC = 'resourceAttributes.aws.local.service';

const invoke = (trace: string, start: string, end: string, extra: Record<string, unknown> = {}, level = 'DEFAULT') => ({
  id: `i-${trace}`,
  traceId: trace,
  type: 'AGENT',
  name: 'dinesh-invoke',
  startTime: start,
  endTime: end,
  level,
  latency: 10,
  metadata: {
    review_quality: { risk_tier: 'high', posted: true, completed: false, incomplete_reason: 'max_iterations' },
    [SVC]: 'abs_ces_agents_dinesh.DEFAULT',
    ...extra,
  },
});
const tool = (id: string, trace: string, name: string, start: string, end: string, status = 'success') => ({
  id,
  traceId: trace,
  type: 'TOOL',
  name,
  startTime: start,
  endTime: end,
  level: status === 'success' ? 'DEFAULT' : 'ERROR',
  latency: 0.4,
  metadata: {
    'attributes.gen_ai.tool.name': name,
    'attributes.gen_ai.tool.status': status,
    'attributes.gen_ai.tool.json_schema': 'must never leak',
    [SVC]: 'abs_ces_agents_dinesh.DEFAULT',
  },
});

/** Routes by the query's filter so each call gets only matching rows. */
function mockFetch(rows: ReturnType<typeof tool>[] | unknown[], calls: URL[] = []): typeof fetch {
  return (async (url: string) => {
    const u = new URL(String(url));
    calls.push(u);
    const filters = JSON.parse(u.searchParams.get('filter') ?? '[]') as Array<Record<string, string>>;
    const type = filters.find(f => f.column === 'type')?.value;
    const name = filters.find(f => f.column === 'name')?.value;
    const trace = filters.find(f => f.column === 'traceId')?.value;
    const data = (rows as Array<Record<string, string>>).filter(
      r => (!type || r.type === type) && (!name || r.name === name) && (!trace || r.traceId === trace),
    );
    return { ok: true, status: 200, json: async () => ({ data, meta: {} }) } as Response;
  }) as unknown as typeof fetch;
}

test('readLangfuseConfig returns undefined when unconfigured and applies defaults', () => {
  assert.equal(readLangfuseConfig(new ConfigReader({})), undefined);
  const c = readLangfuseConfig(
    new ConfigReader({ 'ai-agents': { telemetry: { langfuse: { baseUrl: 'http://x/', publicKey: 'a', secretKey: 'b' } } } }),
  );
  assert.equal(c?.baseUrl, 'http://x');
  assert.equal(c?.servicePrefix, 'abs_ces_agents_');
});

test('finished runs come from invoke spans, newest first, with a verdict and no events payload', async () => {
  const rows = [
    invoke('old', '2026-10-03T07:00:00Z', '2026-10-03T07:01:00Z'),
    invoke('new', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const runs = await p.getRuns('dinesh', 5);
  assert.deepEqual(runs.map(r => r.runId), ['new', 'old']);
  assert.equal(runs[0].state, 'completed');
  assert.equal(runs[0].verdict, 'risk high · posted · incomplete: max_iterations');
  assert.equal(runs[0].events, undefined);
});

test('ERROR invoke span is a failed run', async () => {
  const p = new LangfuseTelemetryProvider(cfg, mockFetch([invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z', {}, 'ERROR')]), () => NOW);
  assert.equal((await p.getRuns('dinesh'))[0].state, 'failed');
});

test('review_quality survives being a truncated string', async () => {
  const rows = [invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z', { review_quality: '{"risk_tier": "low", "posted": false, "incomplete_reason": "max_i' })];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  assert.equal((await p.getRuns('dinesh'))[0].verdict, 'risk low · nothing posted');
});

test('trace with recent tools but no invoke span is running', async () => {
  const rows = [
    tool('a', 'live', 'get_mr_details', '2026-10-03T09:59:00Z', '2026-10-03T09:59:30Z'),
    tool('b', 'live', 'get_file_content', '2026-10-03T09:59:31Z', '2026-10-03T09:59:50Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const [run] = await p.getRuns('dinesh');
  assert.equal(run.state, 'running');
  assert.equal(run.currentActivity, 'after get_file_content');
});

test('tool-only trace that went quiet is unknown; one with an invoke span is not duplicated', async () => {
  const rows = [
    tool('a', 'quiet', 'x', '2026-10-03T09:50:00Z', '2026-10-03T09:50:05Z'),
    tool('b', 'done', 'y', '2026-10-03T09:58:00Z', '2026-10-03T09:58:05Z'),
    invoke('done', '2026-10-03T09:57:00Z', '2026-10-03T09:58:10Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const runs = await p.getRuns('dinesh');
  assert.deepEqual(runs.map(r => [r.runId, r.state]), [['done', 'completed'], ['quiet', 'unknown']]);
});

test('timeline lists tools in order with outcome and a completed event', async () => {
  const rows = [
    tool('b', 't', 'post_inline_comment', '2026-10-03T09:00:05Z', '2026-10-03T09:00:06Z', 'error'),
    tool('a', 't', 'get_mr_changes', '2026-10-03T09:00:01Z', '2026-10-03T09:00:02Z'),
    invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const tl = (await p.getRunTimeline('dinesh', 't'))!;
  assert.deepEqual(tl.map(e => e.event), ['start', 'tool', 'tool', 'completed']);
  assert.deepEqual(tl.filter(e => e.tool).map(e => [e.tool, e.outcome]), [['get_mr_changes', 'ok'], ['post_inline_comment', 'error']]);
  assert.equal(tl.at(-1)?.incomplete, 'max_iterations');
});

test('timeline of another agent or unknown trace is null', async () => {
  const other = { ...invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'), name: 'erlich-invoke', metadata: {} };
  const p = new LangfuseTelemetryProvider(cfg, mockFetch([other]), () => NOW);
  assert.equal(await p.getRunTimeline('dinesh', 't'), null);
  assert.equal(await p.getRunTimeline('dinesh', 'missing'), null);
});

test('never asks for io and never leaks raw metadata', async () => {
  const calls: URL[] = [];
  const rows = [tool('a', 't', 'x', '2026-10-03T09:00:01Z', '2026-10-03T09:00:02Z'), invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z')];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows, calls), () => NOW);
  const out = JSON.stringify([await p.getRuns('dinesh'), await p.getRunTimeline('dinesh', 't')]);
  assert.ok(!out.includes('must never leak'));
  assert.ok(calls.every(u => u.searchParams.get('fields') === 'core,basic,metadata'));
});

test('queries are cached; upstream failures reject and are not cached', async () => {
  const calls: URL[] = [];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch([], calls), () => NOW);
  await p.getRuns('dinesh');
  const n = calls.length;
  await p.getRuns('dinesh');
  assert.equal(calls.length, n);

  let hits = 0;
  const bad = (async () => {
    hits++;
    return { ok: false, status: 500, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
  const q = new LangfuseTelemetryProvider(cfg, bad, () => NOW);
  await assert.rejects(q.getRuns('dinesh'), /500/);
  const first = hits;
  await assert.rejects(q.getRuns('dinesh'), /500/);
  assert.ok(hits > first);
});

test('target and project come from the invoke span attributes', async () => {
  const rows = [
    invoke('a', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z', {
      'attributes.ces.agent.target': '148',
      'attributes.ces.agent.project': 'lux/ds',
    }),
    invoke('b', '2026-10-03T08:00:00Z', '2026-10-03T08:01:00Z', { 'attributes.ces.agent.target': 'CES-12' }),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const runs = await p.getRuns('dinesh');
  assert.deepEqual(runs.map(r => [r.target, r.project]), [['!148', 'lux/ds'], ['CES-12', undefined]]);
});
