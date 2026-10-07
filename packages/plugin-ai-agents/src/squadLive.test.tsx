import './setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Entity } from '@backstage/catalog-model';
import { entityToAgent } from './types';
import { applyFilters, initialFilters } from './hooks/useAgents';
import { AgentsGrid, groupBySquad } from './components/AgentsGrid';
import { AgentFiltersBar } from './components/AgentFilters';
import { AgentCard } from './components/AgentCard';
import { liveFromActivity, liveByEntityRef } from './utils/live';
import { installApi, resetApi } from './__fixtures__/testApi';
import { makeAgent } from './__fixtures__/agents';
import type { AgentActivity, AgentRun } from './types';

afterEach(() => {
  cleanup();
  resetApi();
});

const entity = (
  annotations: Record<string, string> = {},
  spec: Record<string, unknown> = {},
): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'a', annotations },
  spec: { type: 'ai-agent', owner: 'group:x', ...spec },
});

// ── squad mapping ────────────────────────────────────────────────────────

test('squad: annotation wins, then spec.system; refs are shortened', () => {
  assert.equal(
    entityToAgent(
      entity({ 'ai-agent.io/squad': 'payments' }, { system: 'core' }),
    )?.squad,
    'payments',
  );
  assert.equal(
    entityToAgent(entity({}, { system: 'system:default/platform' }))?.squad,
    'platform',
  );
  assert.equal(entityToAgent(entity())?.squad, undefined);
});

test('squad filter keeps only the chosen squads', () => {
  const agents = [
    makeAgent({ entityRef: 'component:default/a', squad: 'alpha' }),
    makeAgent({ entityRef: 'component:default/b', squad: 'beta' }),
    makeAgent({ entityRef: 'component:default/c' }),
  ];
  const out = applyFilters(agents, { ...initialFilters, squad: ['beta'] });
  assert.deepEqual(
    out.map(a => a.entityRef),
    ['component:default/b'],
  );
});

test('groupBySquad: alphabetical, agents without a squad last', () => {
  const agents = [
    makeAgent({ entityRef: 'component:default/a', squad: 'zeta' }),
    makeAgent({ entityRef: 'component:default/b' }),
    makeAgent({ entityRef: 'component:default/c', squad: 'alpha' }),
  ];
  assert.deepEqual(
    groupBySquad(agents).map(g => g.name),
    ['alpha', 'zeta', 'No squad'],
  );
});

test('grid: group by squad renders a labelled section per squad', () => {
  installApi({
    getInvocations: async () => [],
    getAvatar: async () => undefined,
  });
  render(
    <AgentsGrid
      groupBy="squad"
      agents={[
        makeAgent({
          entityRef: 'component:default/a',
          name: 'a',
          squad: 'alpha',
        }),
        makeAgent({
          entityRef: 'component:default/b',
          name: 'b',
          squad: 'beta',
        }),
      ]}
    />,
  );
  assert.ok(screen.getByRole('region', { name: 'alpha' }));
  assert.ok(screen.getByRole('region', { name: 'beta' }));
});

test('filters bar: squad select and Group by only appear when squads exist', () => {
  const noop = () => undefined;
  const { rerender } = render(
    <AgentFiltersBar
      agents={[makeAgent()]}
      filters={initialFilters}
      onChange={noop}
      onReset={noop}
      onGroupByChange={noop}
    />,
  );
  assert.equal(screen.queryByRole('radiogroup', { name: 'Group by' }), null);
  const picked: string[] = [];
  rerender(
    <AgentFiltersBar
      agents={[makeAgent({ squad: 'alpha' })]}
      filters={initialFilters}
      onChange={noop}
      onReset={noop}
      onGroupByChange={g => picked.push(g)}
    />,
  );
  assert.ok(screen.getByRole('radiogroup', { name: 'Group by' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Squad' }));
  assert.deepEqual(picked, ['squad']);
});

// ── live status ──────────────────────────────────────────────────────────

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const run = (over: Partial<AgentRun>): AgentRun => ({
  runId: 'r',
  agent: 'a',
  state: 'completed',
  startedAt: ago(300),
  updatedAt: ago(240),
  ...over,
});
const activity = (runs: AgentRun[]): AgentActivity => ({
  entityRef: 'component:default/test-agent',
  telemetryId: 't',
  runs,
});

test('live: running wins, last seen is the newest sign of life', () => {
  const live = liveFromActivity(
    activity([
      run({ state: 'failed', updatedAt: ago(100) }),
      run({
        runId: 'r2',
        state: 'running',
        startedAt: ago(20),
        updatedAt: ago(5),
      }),
    ]),
  );
  assert.equal(live.state, 'running');
  assert.equal(live.running, 1);
  assert.equal(Date.now() - Date.parse(live.lastSeen!) < 6000, true);
  assert.deepEqual(liveByEntityRef(null), {});
});

test('card: shows the Activity state and last seen instead of the probe dot', () => {
  installApi({
    getInvocations: async () => [],
    getAvatar: async () => undefined,
  });
  const live = liveFromActivity(
    activity([run({ state: 'completed', updatedAt: ago(180) })]),
  );
  render(<AgentCard agent={makeAgent()} live={live} />);
  assert.ok(screen.getByText('Completed'));
  assert.match(
    screen.getByText(/last seen/).textContent ?? '',
    /last seen 3m ago/,
  );
});

test('card: running shows "running now"; no telemetry falls back to the probe', () => {
  installApi({
    getInvocations: async () => [],
    getAvatar: async () => undefined,
  });
  const live = liveFromActivity(activity([run({ state: 'running' })]));
  const { rerender } = render(<AgentCard agent={makeAgent()} live={live} />);
  assert.ok(screen.getByText('running now'));
  rerender(<AgentCard agent={makeAgent()} />);
  assert.equal(screen.queryByTestId('live-status'), null);
});
