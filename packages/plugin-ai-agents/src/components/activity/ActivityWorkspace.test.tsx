import '../../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ActivityWorkspace } from './ActivityWorkspace';
import { AgentRail } from './AgentRail';
import { LiveRuns } from './LiveRuns';
import { RecentRuns } from './RecentRuns';
import { RunDetail } from './RunDetail';
import { AgentWorkspacePanel } from './AgentWorkspacePanel';
import { installApi, resetApi } from '../../__fixtures__/testApi';
import { installImageStub } from '../../__fixtures__/imageStub';
import type {
  AgentActivity,
  AgentInsights,
  AgentRun,
  RunEvent,
} from '../../types';

afterEach(() => {
  cleanup();
  resetApi();
});

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();

const run = (id: string, over: Partial<AgentRun> = {}): AgentRun => ({
  runId: id,
  agent: 'a',
  state: 'completed',
  target: `!${id}`,
  project: 'grp/proj',
  startedAt: ago(300),
  updatedAt: ago(240),
  ...over,
});

const agent = (
  id: string,
  title: string,
  runs: AgentRun[] = [],
  error?: string,
): AgentActivity => ({
  entityRef: `component:default/${id}`,
  telemetryId: id,
  title,
  runs,
  error,
});

const insights = (over: Partial<AgentInsights> = {}): AgentInsights => ({
  windowHours: 24,
  totals: { runs: 10, running: 0, completed: 9, failed: 1, unknown: 0 },
  durationMs: { p50: 76000, p95: 129000 },
  histogram: Array.from({ length: 24 }, (_, i) => ({
    start: new Date(Date.UTC(2024, 0, 1, i)).toISOString(),
    runs: 1,
    failed: 0,
  })),
  tools: [
    { name: 'get_mr_changes', calls: 5, errors: 1, avgMs: 100, p95Ms: 300 },
  ],
  ...over,
});

const stubApi = (over: Record<string, unknown> = {}) =>
  installApi({
    getActivity: async () => [],
    getRuns: async () => [],
    getInsights: async () => null,
    getRunTimeline: async () => [],
    ...over,
  });

/** react-aria presses: a keyboard activation works the same in every env. */
const press = (el: Element, key = ' ') => {
  fireEvent.keyDown(el, { key });
  fireEvent.keyUp(el, { key });
};

const Loc: React.FC = () => <div data-testid="loc">{useLocation().search}</div>;
const renderAt = (ui: React.ReactElement, url = '/') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      {ui}
      <Loc />
    </MemoryRouter>,
  );

// ── AgentRail ────────────────────────────────────────────────────────────

const railOrder = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-testid="rail-item"]')].map(n =>
    n.getAttribute('data-telemetry-id'),
  );

test('rail: alphabetical by title and stable when states and input order change', () => {
  stubApi();
  const calm = [
    agent('z', 'Zed', [run('1')]),
    agent('a', 'Alpha'),
    agent('m', 'Mid', [run('2')]),
  ];
  const { container, rerender } = render(
    <AgentRail fleet={calm} onSelectAgent={() => undefined} />,
  );
  assert.deepEqual(railOrder(container), ['a', 'm', 'z']);

  // Zed starts running and the API returns agents in another order: the rail must not move.
  const busy = [
    agent('m', 'Mid', [run('2')]),
    agent('z', 'Zed', [run('3', { state: 'running' })]),
    agent('a', 'Alpha'),
  ];
  rerender(<AgentRail fleet={busy} onSelectAgent={() => undefined} />);
  assert.deepEqual(railOrder(container), ['a', 'm', 'z']);
});

test('rail: shows how many runs each agent has in progress, and the fleet total', () => {
  stubApi();
  const fleet = [
    agent('d', 'Dinesh', [
      run('1', { state: 'running' }),
      run('2', { state: 'running' }),
      run('3', { state: 'running' }),
      run('4'),
    ]),
    agent('e', 'Erlich', [run('5', { state: 'running' })]),
    agent('g', 'Gilfoyle', [run('6')]),
  ];
  const { container } = render(
    <AgentRail fleet={fleet} onSelectAgent={() => undefined} />,
  );
  const chips = (id: string) =>
    container.querySelector(
      `[data-telemetry-id="${id}"] [data-testid="running-chip"]`,
    )?.textContent;
  assert.equal(chips('d'), '3');
  assert.equal(chips('e'), '1');
  assert.equal(chips('g'), undefined, 'idle agent has no running chip');
  const all = container.querySelector('[role="row"]');
  assert.match(all?.textContent ?? '', /4 running/);
});

test('rail: secondary line shows what a running agent is doing and "Idle" otherwise', () => {
  stubApi();
  const fleet = [
    agent('d', 'Dinesh', [
      run('1', { state: 'running', currentActivity: 'after get_file_content' }),
    ]),
    agent('g', 'Gilfoyle', [run('2', { updatedAt: ago(720) })]),
    agent('m', 'Monica'),
  ];
  const { container } = render(
    <AgentRail fleet={fleet} onSelectAgent={() => undefined} />,
  );
  const text = (id: string) =>
    container.querySelector(`[data-telemetry-id="${id}"]`)?.textContent ?? '';
  assert.match(text('d'), /after get_file_content/);
  assert.match(text('g'), /Idle · 12m ago/);
  assert.match(text('m'), /No runs yet/);
});

test('rail: rows select on press and the selection is exposed with aria-selected', () => {
  stubApi();
  const picked: Array<string | undefined> = [];
  const fleet = [agent('a', 'Alpha'), agent('b', 'Beta')];
  const { container, rerender } = render(
    <AgentRail fleet={fleet} onSelectAgent={id => picked.push(id)} />,
  );
  const rowFor = (id: string) =>
    container.querySelector(`[data-telemetry-id="${id}"]`) as HTMLElement;
  press(rowFor('b'));
  assert.deepEqual(picked, ['b']);

  rerender(
    <AgentRail
      fleet={fleet}
      selectedTelemetryId="b"
      onSelectAgent={() => undefined}
    />,
  );
  const selected = [
    ...container.querySelectorAll('[role="row"][aria-selected="true"]'),
  ];
  assert.equal(selected.length, 1);
  assert.equal(selected[0].getAttribute('data-telemetry-id'), 'b');
});

test('rail: "All agents" clears the selection', () => {
  stubApi();
  const picked: Array<string | undefined> = [];
  render(
    <AgentRail
      fleet={[agent('a', 'Alpha'), agent('b', 'Beta')]}
      selectedTelemetryId="b"
      onSelectAgent={id => picked.push(id)}
    />,
  );
  press(screen.getByRole('row', { name: /^All agents/ }));
  assert.deepEqual(picked, [undefined]);
});

test('rail: search filters agents and an agent with telemetry errors is flagged', () => {
  stubApi();
  const fleet = [
    agent('a', 'Alpha'),
    agent('b', 'Beta', [], 'telemetry query failed'),
  ];
  const { container } = render(
    <AgentRail fleet={fleet} onSelectAgent={() => undefined} />,
  );
  assert.ok(container.querySelector('[aria-label="Telemetry unavailable"]'));
  fireEvent.change(screen.getByLabelText('Search agents'), {
    target: { value: 'alp' },
  });
  assert.deepEqual(railOrder(container), ['a']);
  fireEvent.change(screen.getByLabelText('Search agents'), {
    target: { value: 'nothing' },
  });
  assert.match(container.textContent ?? '', /No agent matches your search/);
});

// ── LiveRuns ─────────────────────────────────────────────────────────────

test('live runs: one card per running run (concurrent), finished runs are excluded', () => {
  const runs = [
    run('1', {
      state: 'running',
      startedAt: ago(65),
      currentActivity: 'after a',
    }),
    run('2', {
      state: 'running',
      startedAt: ago(5),
      currentActivity: 'after b',
    }),
    run('3', { state: 'running', startedAt: ago(30) }),
    run('4'),
    run('5', { state: 'failed' }),
  ];
  const { container } = render(<LiveRuns runs={runs} />);
  const cards = [...container.querySelectorAll('[data-testid="live-run"]')];
  assert.deepEqual(
    cards.map(c => c.getAttribute('data-run-id')),
    ['1', '2', '3'],
  );
  assert.match(container.textContent ?? '', /Running now\s*3/);
  const elapsed = cards.map(
    c => c.querySelector('[data-testid="live-elapsed"]')?.textContent,
  );
  assert.match(elapsed[0] ?? '', /^1m 0[5-9]s$/);
  assert.match(
    cards[2].textContent ?? '',
    /working…/,
    'missing activity falls back to a placeholder',
  );
});

test('live runs: selecting a card reports its id; with nothing running it says so', () => {
  const picked: string[] = [];
  const { container, rerender } = render(
    <LiveRuns
      runs={[run('9', { state: 'running' })]}
      selectedRunId="9"
      onSelect={id => picked.push(id)}
    />,
  );
  const card = container.querySelector(
    '[data-testid="live-run"]',
  ) as HTMLElement;
  assert.equal(card.getAttribute('aria-pressed'), 'true');
  fireEvent.click(card);
  assert.deepEqual(picked, ['9']);
  rerender(<LiveRuns runs={[run('1')]} />);
  assert.match(container.textContent ?? '', /No runs in progress/);
});

// ── RecentRuns ───────────────────────────────────────────────────────────

const mixed = [
  run('1', { state: 'running', target: '!152' }),
  run('2', { target: '!148', verdict: 'risk high · posted' }),
  run('3', {
    target: '!129',
    state: 'failed',
    verdict: 'incomplete: invocation_failed',
  }),
  run('4', { target: 'CES-7', project: 'jira/ces' }),
];
const rowTargets = (container: HTMLElement) =>
  [...container.querySelectorAll('tbody tr')].map(
    r => r.querySelector('[role="rowheader"] p')?.textContent,
  );

test('recent runs: status chips show counts and filter the table', () => {
  const { container } = render(<RecentRuns runs={mixed} />);
  const chip = (s: string) =>
    container.querySelector(`[data-filter="${s}"]`) as HTMLElement;
  assert.match(chip('all').textContent ?? '', /All · 4/);
  assert.match(chip('failed').textContent ?? '', /Failed · 1/);
  fireEvent.click(chip('failed'));
  assert.equal(container.querySelectorAll('tbody tr').length, 1);
  assert.match(container.textContent ?? '', /!129/);
  assert.equal(chip('failed').getAttribute('aria-checked'), 'true');
});

test('recent runs: text filter matches target, project and verdict', () => {
  const { container } = render(<RecentRuns runs={mixed} />);
  const box = screen.getByLabelText('Filter runs');
  fireEvent.change(box, { target: { value: 'jira' } });
  assert.deepEqual(rowTargets(container), ['CES-7']);
  fireEvent.change(box, { target: { value: 'posted' } });
  assert.deepEqual(rowTargets(container), ['!148']);
  fireEvent.change(box, { target: { value: 'zzz' } });
  assert.match(container.textContent ?? '', /No runs found/);
});

test('recent runs: rows select on click and Enter, running rows show no fake duration', () => {
  const picked: string[] = [];
  const { container } = render(
    <RecentRuns
      runs={mixed}
      selectedRunId="2"
      onSelect={id => picked.push(id)}
    />,
  );
  const rows = [...container.querySelectorAll('tbody tr')] as HTMLElement[];
  assert.equal(rows[1].getAttribute('aria-selected'), 'true');
  assert.equal(rows[0].getAttribute('aria-selected'), 'false');
  press(rows[0], 'Enter');
  press(rows[2], 'Enter');
  assert.deepEqual(picked, ['1', '3']);
  assert.match(rows[0].textContent ?? '', /running…/);
});

test('recent runs: long lists are paged with a "show more" control', () => {
  const many = Array.from({ length: 45 }, (_, i) => run(String(i + 100)));
  const { container } = render(<RecentRuns runs={many} />);
  assert.equal(container.querySelectorAll('tbody tr').length, 30);
  fireEvent.click(screen.getByText(/Show more/));
  assert.equal(container.querySelectorAll('tbody tr').length, 45);
});

// ── RunDetail ────────────────────────────────────────────────────────────

const t0 = Date.parse('2026-01-01T10:00:00Z');
const toolEv = (
  seq: number,
  endOffsetMs: number,
  durationMs: number,
  outcome = 'ok',
): RunEvent => ({
  seq,
  name: `a:t${seq}`,
  event: 'tool',
  tool: `t${seq}`,
  outcome,
  durationMs,
  ts: new Date(t0 + endOffsetMs).toISOString(),
});

test('run detail: reports tool calls, errors and the real parallel peak from the timeline', async () => {
  const events: RunEvent[] = [
    { seq: 0, name: 'a:start', event: 'start', ts: new Date(t0).toISOString() },
    toolEv(1, 1000, 800), // 200..1000
    toolEv(2, 1000, 700), // 300..1000  (parallel with 1)
    toolEv(3, 1000, 600, 'error'), // 400..1000 (parallel with 1 and 2)
    toolEv(4, 3000, 500), // 2500..3000 alone
    {
      seq: 5,
      name: 'a:completed',
      event: 'completed',
      ts: new Date(t0 + 3200).toISOString(),
      incomplete: 'max_iterations',
    },
  ];
  stubApi({ getRunTimeline: async () => events });
  const { container } = render(
    <RunDetail
      entityRef="component:default/a"
      run={run('r1', { state: 'completed', target: '!7' })}
    />,
  );
  await waitFor(() =>
    assert.ok(container.querySelector('[data-testid="run-detail"]')),
  );
  await screen.findByText('Run did not complete: max_iterations', {
    exact: false,
  });
  const fact = (label: string) =>
    [...container.querySelectorAll('p, span, div')].find(
      n => n.textContent === label,
    )?.nextElementSibling?.textContent;
  assert.equal(fact('Tool calls'), '4');
  assert.equal(fact('Errors'), '1');
  assert.equal(fact('Max parallel'), '3');
});

test('run detail: clicking a tool bar shows that call, and a load error offers retry', async () => {
  let calls = 0;
  stubApi({
    getRunTimeline: async () => {
      calls++;
      if (calls === 1) throw new Error('nope');
      return [
        {
          seq: 0,
          name: 'a:start',
          event: 'start',
          ts: new Date(t0).toISOString(),
        },
        toolEv(1, 1500, 900),
      ];
    },
  });
  const { container } = render(
    <RunDetail entityRef="component:default/a" run={run('r2')} />,
  );
  const retry = await screen.findByText('Retry');
  fireEvent.click(retry);
  await waitFor(() => assert.ok(container.querySelector('[data-left]')));
  assert.equal(container.querySelector('[data-testid="tool-detail"]'), null);
  fireEvent.click(container.querySelector('[data-left]') as HTMLElement);
  const detail = await screen.findByTestId('tool-detail');
  assert.match(detail.textContent ?? '', /t1 · 900ms · ok/);
});

test('run detail: a running run shows a live elapsed time instead of a frozen duration', async () => {
  stubApi({ getRunTimeline: async () => [] });
  const { container } = render(
    <RunDetail
      entityRef="component:default/a"
      run={run('r3', {
        state: 'running',
        startedAt: ago(125),
        updatedAt: ago(100),
      })}
    />,
  );
  await screen.findByText(/No events recorded/);
  assert.match(container.textContent ?? '', /Elapsed\s*2m 0[5-9]s/);
});

// ── Panel + workspace ───────────────────────────────────────────────────

test('panel: durations are human readable and "running now" comes from the live runs, not the stale stats', async () => {
  stubApi({
    getRuns: async () => [
      run('1', { state: 'running' }),
      run('2', { state: 'running' }),
    ],
    getInsights: async () =>
      insights({
        totals: { runs: 10, running: 0, completed: 9, failed: 1, unknown: 0 },
      }),
  });
  const { container } = render(
    <AgentWorkspacePanel
      entityRef="component:default/a"
      telemetryId="a"
      title="Alpha"
    />,
  );
  await screen.findByText('1m 16s');
  assert.match(container.textContent ?? '', /2m 09s/);
  assert.match(container.textContent ?? '', /90%/);
  const label = screen.getAllByText('Running now').find(n => n.closest('div'));
  assert.match(
    label?.parentElement?.textContent ?? '',
    /^Running now2concurrent$/,
  );
});

test('panel: missing statistics (501/404) hide nothing else — runs are still listed', async () => {
  stubApi({
    getRuns: async () => [run('1', { target: '!77' })],
    getInsights: async () => null,
  });
  const { container } = render(
    <AgentWorkspacePanel
      entityRef="component:default/a"
      telemetryId="a"
      title="Alpha"
    />,
  );
  await screen.findByText('!77');
  assert.match(container.textContent ?? '', /Success rate\s*—/);
});

test('panel: selecting a run opens its detail next to the list and closing clears the selection', async () => {
  const picked: Array<string | undefined> = [];
  stubApi({
    getRuns: async () => [run('1', { target: '!77' })],
    getInsights: async () => insights(),
    getRunTimeline: async () => [],
  });
  const { container, rerender } = render(
    <AgentWorkspacePanel
      entityRef="component:default/a"
      telemetryId="a"
      title="Alpha"
      onSelectRun={id => picked.push(id)}
    />,
  );
  await screen.findByText('!77');
  assert.equal(container.querySelector('[data-testid="run-detail"]'), null);
  rerender(
    <AgentWorkspacePanel
      entityRef="component:default/a"
      telemetryId="a"
      title="Alpha"
      selectedRunId="1"
      onSelectRun={id => picked.push(id)}
    />,
  );
  await waitFor(() =>
    assert.ok(container.querySelector('[data-testid="run-detail"]')),
  );
  fireEvent.click(screen.getByLabelText('Close run details'));
  assert.deepEqual(picked, [undefined]);
});

test('workspace: fleet overview lists every running run across agents and clicking one deep-links to it', async () => {
  stubApi({
    getActivity: async () => [
      agent('d', 'Dinesh', [
        run('1', { state: 'running', target: '!152' }),
        run('2', { state: 'running', target: '!77' }),
      ]),
      agent('e', 'Erlich', [run('3', { state: 'running', target: undefined })]),
      agent('g', 'Gilfoyle', [run('4', { state: 'failed' })]),
    ],
  });
  renderAt(<ActivityWorkspace />);
  const section = await screen.findByTestId('fleet-running');
  const rows = [...section.querySelectorAll('tbody tr')];
  assert.equal(rows.length, 3);
  press(rows[0], 'Enter');
  await waitFor(() =>
    assert.match(screen.getByTestId('loc').textContent ?? '', /agent=(d|e)/),
  );
  assert.match(screen.getByTestId('loc').textContent ?? '', /run=\d/);
});

test('workspace: selecting an agent in the rail updates the URL and drops the previous run', async () => {
  stubApi({
    getActivity: async () => [
      agent('a', 'Alpha', [run('1')]),
      agent('b', 'Beta', [run('2')]),
    ],
    getRuns: async () => [],
  });
  renderAt(<ActivityWorkspace />, '/?tab=activity&agent=a&run=1');
  await screen.findAllByText('Alpha');
  press(screen.getByRole('row', { name: /^Beta/ }));
  await waitFor(() =>
    assert.equal(
      screen.getByTestId('loc').textContent,
      '?tab=activity&agent=b',
    ),
  );
});

test('workspace: a deep link restores agent and run, and keeps unrelated params', async () => {
  stubApi({
    getActivity: async () => [
      agent('a', 'Alpha', [run('1', { target: '!42' })]),
    ],
    getRuns: async () => [run('1', { target: '!42' })],
    getInsights: async () => insights(),
    getRunTimeline: async () => [],
  });
  renderAt(<ActivityWorkspace />, '/?tab=activity&agent=a&run=1&hours=72');
  await screen.findByTestId('run-detail');
  const selected = screen.getByRole('radio', { name: '72h' });
  assert.equal(selected.getAttribute('aria-checked'), 'true');
  assert.equal(
    screen.getByTestId('loc').textContent,
    '?tab=activity&agent=a&run=1&hours=72',
  );
});

test('workspace: an invalid hours value falls back to 24h', async () => {
  stubApi({
    getActivity: async () => [agent('a', 'Alpha')],
    getRuns: async () => [],
    getInsights: async () => insights(),
  });
  renderAt(<ActivityWorkspace />, '/?agent=a&hours=5');
  await screen.findByText('Success rate');
  assert.equal(
    screen.getByRole('radio', { name: '24h' }).getAttribute('aria-checked'),
    'true',
  );
});

test('workspace: first-load failure shows an error with retry; empty fleet explains the annotation', async () => {
  let fail = true;
  stubApi({
    getActivity: async () => {
      if (fail) throw new Error('Failed to load activity: 500');
      return [];
    },
  });
  renderAt(<ActivityWorkspace />);
  const retry = await screen.findByText('Retry');
  assert.match(document.body.textContent ?? '', /Failed to load activity: 500/);
  fail = false;
  fireEvent.click(retry);
  await screen.findByText(/ai-agent\.io\/telemetry-id/);
});

test('workspace: rail and header show proxied avatars', async () => {
  const restoreImage = installImageStub();
  try {
    const requested: string[] = [];
    stubApi({
      getActivity: async () => [
        {
          ...agent('a', 'Alpha'),
          avatarUrl: 'https://git.example.com/g/p/-/raw/main/a/avatar.png',
        },
        agent('b', 'Beta'),
      ],
      getRuns: async () => [],
      getInsights: async () => insights(),
      getAvatar: async (ref: string) => {
        requested.push(ref);
        return new Blob(['png'], { type: 'image/png' });
      },
    });
    const { container } = renderAt(<ActivityWorkspace />, '/?agent=a');
    await waitFor(() => {
      const imgs = [...container.querySelectorAll('img')];
      assert.equal(imgs.length, 2, 'rail item and workspace header');
      for (const img of imgs) {
        assert.match(img.getAttribute('src') ?? '', /^data:image\/png;base64,/);
      }
    });
    // Shared per-agent cache: one proxy request, and none for agents without
    // an avatar (Beta keeps its initials).
    assert.deepEqual(requested, ['component:default/a']);
  } finally {
    restoreImage();
  }
});
