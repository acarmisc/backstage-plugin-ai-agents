import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigReader } from '@backstage/config';
import {
  LangfuseTelemetryProvider,
  readLangfuseConfig,
  LangfuseConfig,
  percentile,
} from './provider';

const cfg: LangfuseConfig = {
  baseUrl: 'http://lf',
  publicKey: 'pk',
  secretKey: 'sk',
  lookbackHours: 24,
  runningWindowSeconds: 90,
  servicePrefix: 'agents_',
  serviceAttribute: 'resourceAttributes.service.name',
  targetAttribute: 'attributes.agent.target',
  projectAttribute: 'attributes.agent.project',
  cacheTtlMs: 1000,
};
const NOW = Date.parse('2026-10-03T10:00:00Z');
const SVC = 'resourceAttributes.service.name';

const invoke = (
  trace: string,
  start: string,
  end: string,
  extra: Record<string, unknown> = {},
  level = 'DEFAULT',
) => ({
  id: `i-${trace}`,
  traceId: trace,
  type: 'AGENT',
  name: 'dinesh-invoke',
  startTime: start,
  endTime: end,
  level,
  latency: 10,
  metadata: {
    review_quality: {
      risk_tier: 'high',
      posted: true,
      completed: false,
      incomplete_reason: 'max_iterations',
    },
    [SVC]: 'agents_dinesh.DEFAULT',
    ...extra,
  },
});
const tool = (
  id: string,
  trace: string,
  name: string,
  start: string,
  end: string,
  status = 'success',
) => ({
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
    [SVC]: 'agents_dinesh.DEFAULT',
  },
});

/** Routes by the query's filter so each call gets only matching rows. */
function mockFetch(
  rows: ReturnType<typeof tool>[] | unknown[],
  calls: URL[] = [],
): typeof fetch {
  return (async (url: string) => {
    const u = new URL(String(url));
    calls.push(u);
    const filters = JSON.parse(u.searchParams.get('filter') ?? '[]') as Array<
      Record<string, string>
    >;
    const type = filters.find(f => f.column === 'type')?.value;
    const name = filters.find(f => f.column === 'name')?.value;
    const trace = filters.find(f => f.column === 'traceId')?.value;
    const data = (rows as Array<Record<string, string>>).filter(
      r =>
        (!type || r.type === type) &&
        (!name || r.name === name) &&
        (!trace || r.traceId === trace),
    );
    return {
      ok: true,
      status: 200,
      json: async () => ({ data, meta: {} }),
    } as Response;
  }) as unknown as typeof fetch;
}

test('readLangfuseConfig returns undefined when unconfigured and applies defaults', () => {
  assert.equal(readLangfuseConfig(new ConfigReader({})), undefined);
  const c = readLangfuseConfig(
    new ConfigReader({
      'ai-agents': {
        telemetry: {
          langfuse: { baseUrl: 'http://x/', publicKey: 'a', secretKey: 'b' },
        },
      },
    }),
  );
  assert.equal(c?.baseUrl, 'http://x');
  assert.equal(c?.servicePrefix, '');
  assert.equal(c?.serviceAttribute, 'resourceAttributes.service.name');
  assert.equal(c?.targetAttribute, undefined);
});

test('finished runs come from invoke spans, newest first, with a verdict and no events payload', async () => {
  const rows = [
    invoke('old', '2026-10-03T07:00:00Z', '2026-10-03T07:01:00Z'),
    invoke('new', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const runs = await p.getRuns('dinesh', 5);
  assert.deepEqual(
    runs.map(r => r.runId),
    ['new', 'old'],
  );
  assert.equal(runs[0].state, 'completed');
  assert.equal(
    runs[0].verdict,
    'risk high · posted · incomplete: max_iterations',
  );
  assert.equal(runs[0].events, undefined);
});

test('ERROR invoke span is a failed run', async () => {
  const p = new LangfuseTelemetryProvider(
    cfg,
    mockFetch([
      invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z', {}, 'ERROR'),
    ]),
    () => NOW,
  );
  assert.equal((await p.getRuns('dinesh'))[0].state, 'failed');
});

test('review_quality survives being a truncated string', async () => {
  const rows = [
    invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z', {
      review_quality:
        '{"risk_tier": "low", "posted": false, "incomplete_reason": "max_i',
    }),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  assert.equal(
    (await p.getRuns('dinesh'))[0].verdict,
    'risk low · nothing posted',
  );
});

test('trace with recent tools but no invoke span is running', async () => {
  const rows = [
    tool(
      'a',
      'live',
      'get_mr_details',
      '2026-10-03T09:59:00Z',
      '2026-10-03T09:59:30Z',
    ),
    tool(
      'b',
      'live',
      'get_file_content',
      '2026-10-03T09:59:31Z',
      '2026-10-03T09:59:50Z',
    ),
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
  assert.deepEqual(
    runs.map(r => [r.runId, r.state]),
    [
      ['done', 'completed'],
      ['quiet', 'unknown'],
    ],
  );
});

test('timeline lists tools in order with outcome and a completed event', async () => {
  const rows = [
    tool(
      'b',
      't',
      'post_inline_comment',
      '2026-10-03T09:00:05Z',
      '2026-10-03T09:00:06Z',
      'error',
    ),
    tool(
      'a',
      't',
      'get_mr_changes',
      '2026-10-03T09:00:01Z',
      '2026-10-03T09:00:02Z',
    ),
    invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const tl = (await p.getRunTimeline('dinesh', 't'))!;
  assert.deepEqual(
    tl.map(e => e.event),
    ['start', 'tool', 'tool', 'completed'],
  );
  assert.deepEqual(
    tl.filter(e => e.tool).map(e => [e.tool, e.outcome]),
    [
      ['get_mr_changes', 'ok'],
      ['post_inline_comment', 'error'],
    ],
  );
  assert.equal(tl.at(-1)?.incomplete, 'max_iterations');
});

test('timeline of another agent or unknown trace is null', async () => {
  const other = {
    ...invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
    name: 'erlich-invoke',
    metadata: {},
  };
  const p = new LangfuseTelemetryProvider(cfg, mockFetch([other]), () => NOW);
  assert.equal(await p.getRunTimeline('dinesh', 't'), null);
  assert.equal(await p.getRunTimeline('dinesh', 'missing'), null);
});

test('never asks for io and never leaks raw metadata', async () => {
  const calls: URL[] = [];
  const rows = [
    tool('a', 't', 'x', '2026-10-03T09:00:01Z', '2026-10-03T09:00:02Z'),
    invoke('t', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
  ];
  const p = new LangfuseTelemetryProvider(
    cfg,
    mockFetch(rows, calls),
    () => NOW,
  );
  const out = JSON.stringify([
    await p.getRuns('dinesh'),
    await p.getRunTimeline('dinesh', 't'),
  ]);
  assert.ok(!out.includes('must never leak'));
  assert.ok(
    calls.every(u => u.searchParams.get('fields') === 'core,basic,metadata'),
  );
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
      'attributes.agent.target': '148',
      'attributes.agent.project': 'lux/ds',
    }),
    invoke('b', '2026-10-03T08:00:00Z', '2026-10-03T08:01:00Z', {
      'attributes.agent.target': 'PROJ-12',
    }),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const runs = await p.getRuns('dinesh');
  assert.deepEqual(
    runs.map(r => [r.target, r.project]),
    [
      ['148', 'lux/ds'],
      ['PROJ-12', undefined],
    ],
  );
});

test('percentile uses nearest-rank method with empty and single value', () => {
  assert.equal(percentile([], 50), 0);
  assert.equal(percentile([100], 50), 100);
  assert.equal(percentile([10, 20, 30], 50), 20);
  assert.equal(percentile([10, 20, 30, 40, 50], 95), 50);
});

test('getInsights calculates totals with running/unknown split', async () => {
  const rows = [
    invoke('completed1', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z'),
    invoke(
      'failed1',
      '2026-10-03T08:00:00Z',
      '2026-10-03T08:01:00Z',
      {},
      'ERROR',
    ),
    tool(
      'a',
      'running1',
      'get_x',
      '2026-10-03T09:59:00Z',
      '2026-10-03T09:59:30Z',
    ),
    tool(
      'b',
      'unknown1',
      'get_y',
      '2026-10-03T09:50:00Z',
      '2026-10-03T09:50:05Z',
    ),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const insights = await p.getInsights('dinesh', 24);
  assert.equal(insights.totals.runs, 4);
  assert.equal(insights.totals.completed, 1);
  assert.equal(insights.totals.failed, 1);
  assert.equal(insights.totals.running, 1);
  assert.equal(insights.totals.unknown, 1);
});

test('getInsights histogram has exactly N buckets, last is current UTC hour', async () => {
  const rows = [
    invoke('t1', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z'),
    invoke('t2', '2026-10-03T08:30:00Z', '2026-10-03T08:31:00Z'),
    invoke('t3', '2026-10-03T08:00:00Z', '2026-10-03T08:01:00Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const insights = await p.getInsights('dinesh', 3);
  assert.equal(insights.histogram.length, 3);
  // Last bucket should be current hour: 10:00:00Z
  assert.equal(insights.histogram[2].start, '2026-10-03T10:00:00Z');
  // Previous bucket: 09:00:00Z
  assert.equal(insights.histogram[1].start, '2026-10-03T09:00:00Z');
  // Oldest bucket: 08:00:00Z
  assert.equal(insights.histogram[0].start, '2026-10-03T08:00:00Z');
  // Runs counted in correct buckets
  assert.equal(insights.histogram[2].runs, 0); // No runs in current hour (10:00:00Z)
  assert.equal(insights.histogram[1].runs, 1); // t1 at 09:00:00Z
  assert.equal(insights.histogram[0].runs, 2); // t2, t3 at 08:00:00Z (08:30 and 08:00)
});

test('getInsights histogram counts failed runs per bucket', async () => {
  const rows = [
    invoke('ok', '2026-10-03T09:00:00Z', '2026-10-03T09:01:00Z'),
    invoke('fail', '2026-10-03T09:30:00Z', '2026-10-03T09:31:00Z', {}, 'ERROR'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const insights = await p.getInsights('dinesh', 2);
  const hour9Bucket = insights.histogram.find(
    b => b.start === '2026-10-03T09:00:00Z',
  );
  assert.equal(hour9Bucket?.runs, 2);
  assert.equal(hour9Bucket?.failed, 1);
});

test('getInsights aggregates tools by name, sorted by calls, top 10 cap', async () => {
  const tools_rows = [
    tool(
      'a',
      't1',
      'tool_a',
      '2026-10-03T09:00:00Z',
      '2026-10-03T09:00:01Z',
      'success',
    ),
    tool(
      'b',
      't1',
      'tool_a',
      '2026-10-03T09:00:02Z',
      '2026-10-03T09:00:03Z',
      'success',
    ),
    tool(
      'c',
      't1',
      'tool_b',
      '2026-10-03T09:00:04Z',
      '2026-10-03T09:00:05Z',
      'error',
    ),
    tool(
      'd',
      't1',
      'tool_c',
      '2026-10-03T09:00:06Z',
      '2026-10-03T09:00:07Z',
      'success',
    ),
    invoke('t1', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
  ];
  const p = new LangfuseTelemetryProvider(
    cfg,
    mockFetch(tools_rows),
    () => NOW,
  );
  const insights = await p.getInsights('dinesh', 24);
  assert.equal(insights.tools.length, 3);
  assert.equal(insights.tools[0].name, 'tool_a');
  assert.equal(insights.tools[0].calls, 2);
  assert.equal(insights.tools[0].errors, 0);
  assert.equal(insights.tools[1].name, 'tool_b');
  assert.equal(insights.tools[1].calls, 1);
  assert.equal(insights.tools[1].errors, 1);
  assert.equal(insights.tools[2].name, 'tool_c');
  assert.equal(insights.tools[2].calls, 1);
  assert.equal(insights.tools[2].errors, 0);
});

test('getInsights keeps top 10 tools from 12 distinct tools', async () => {
  const tools_rows: Array<unknown> = [];
  for (let i = 0; i < 12; i++) {
    tools_rows.push(
      tool(
        `t${i}`,
        'trace',
        `tool_${i}`,
        '2026-10-03T09:00:00Z',
        '2026-10-03T09:00:01Z',
      ),
    );
  }
  tools_rows.push(
    invoke('trace', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
  );
  const p = new LangfuseTelemetryProvider(
    cfg,
    mockFetch(tools_rows),
    () => NOW,
  );
  const insights = await p.getInsights('dinesh', 24);
  assert.equal(insights.tools.length, 10);
});

test('getInsights counts tools without latency in calls but excludes from avgMs/p95Ms', async () => {
  const tools_rows: Array<unknown> = [
    {
      ...tool(
        'a',
        't1',
        'tool_a',
        '2026-10-03T09:00:00Z',
        '2026-10-03T09:00:01Z',
      ),
      latency: 0.1,
    },
    {
      ...tool(
        'b',
        't1',
        'tool_a',
        '2026-10-03T09:00:02Z',
        '2026-10-03T09:00:03Z',
      ),
      latency: null,
    },
    {
      ...tool(
        'c',
        't1',
        'tool_a',
        '2026-10-03T09:00:04Z',
        '2026-10-03T09:00:05Z',
      ),
      latency: 0.2,
    },
    invoke('t1', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
  ];
  const p = new LangfuseTelemetryProvider(
    cfg,
    mockFetch(tools_rows),
    () => NOW,
  );
  const insights = await p.getInsights('dinesh', 24);
  const toolAStat = insights.tools.find(
    (t: { name: string }) => t.name === 'tool_a',
  );
  assert.equal(toolAStat?.calls, 3); // All 3 counted
  // avgMs = (100 + 200) / 2 = 150
  assert.equal(toolAStat?.avgMs, 150);
  // p95 of [100, 200] = 200 (nearest-rank)
  assert.equal(toolAStat?.p95Ms, 200);
});

test('getInsights durationMs calculates p50 and p95 from finished run durations', async () => {
  const rows = [
    invoke('t1', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'), // 10 seconds
    invoke('t2', '2026-10-03T09:01:00Z', '2026-10-03T09:01:30Z'), // 30 seconds
    invoke('t3', '2026-10-03T09:02:00Z', '2026-10-03T09:02:50Z'), // 50 seconds
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const insights = await p.getInsights('dinesh', 24);
  // Durations in ms: [10000, 30000, 50000]
  // Sorted: [10000, 30000, 50000]
  // p50 at index ceil(50/100*3)-1 = ceil(1.5)-1 = 2-1 = 1 → 30000
  // p95 at index ceil(95/100*3)-1 = ceil(2.85)-1 = 3-1 = 2 → 50000
  assert.equal(insights.durationMs.p50, 30000);
  assert.equal(insights.durationMs.p95, 50000);
});

test('getInsights returns durationMs 0 when no finished runs', async () => {
  const rows = [
    tool('a', 'live1', 'get_x', '2026-10-03T09:59:00Z', '2026-10-03T09:59:30Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const insights = await p.getInsights('dinesh', 24);
  assert.equal(insights.durationMs.p50, 0);
  assert.equal(insights.durationMs.p95, 0);
});

test('getInsights metadata never leaks json_schema or other raw metadata', async () => {
  const rows = [
    tool('a', 't1', 'tool_a', '2026-10-03T09:00:00Z', '2026-10-03T09:00:01Z'),
    invoke('t1', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
  ];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const insights = await p.getInsights('dinesh', 24);
  const out = JSON.stringify(insights);
  assert.ok(
    !out.includes('json_schema'),
    'must never leak metadata.json_schema',
  );
  assert.ok(
    !out.includes('must never leak'),
    'must never leak metadata values',
  );
});

test('getInsights caches queries: two calls → one fetch pair', async () => {
  const calls: URL[] = [];
  const rows = [
    invoke('t1', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z'),
    tool('a', 't1', 'tool_a', '2026-10-03T09:00:00Z', '2026-10-03T09:00:01Z'),
  ];
  const p = new LangfuseTelemetryProvider(
    cfg,
    mockFetch(rows, calls),
    () => NOW,
  );
  await p.getInsights('dinesh', 24);
  const firstCallCount = calls.length;
  await p.getInsights('dinesh', 24);
  const secondCallCount = calls.length;
  // Two identical calls should use the cache and not make additional API calls
  assert.equal(secondCallCount, firstCallCount);
  assert.ok(firstCallCount > 0, 'should have made at least one query');
});

test('getInsights clamps hours between 1 and 72', async () => {
  const rows = [invoke('t1', '2026-10-03T09:00:00Z', '2026-10-03T09:00:10Z')];
  const p = new LangfuseTelemetryProvider(cfg, mockFetch(rows), () => NOW);
  const insights0 = await p.getInsights('dinesh', 0);
  const insights200 = await p.getInsights('dinesh', 200);
  assert.equal(insights0.windowHours, 1);
  assert.equal(insights200.windowHours, 72);
  assert.equal(insights0.histogram.length, 1);
  assert.equal(insights200.histogram.length, 72);
});
