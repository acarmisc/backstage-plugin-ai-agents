import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { FleetActivity, Sparkline } from './FleetActivity';
import { installApi, resetApi } from '../__fixtures__/testApi';
import type { AgentActivity, AgentRun } from '../types';

afterEach(() => {
  cleanup();
  resetApi();
});

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const run = (over: Partial<AgentRun>): AgentRun => ({
  runId: 'r',
  agent: 'dinesh',
  state: 'completed',
  startedAt: ago(120),
  updatedAt: ago(60),
  ...over,
});

function stub(data: AgentActivity[] | (() => Promise<AgentActivity[]>)) {
  installApi({
    getActivity: typeof data === 'function' ? data : async () => data,
    getRuns: async () => [],
    getRunTimeline: async () => [],
  });
}

test('running agent shows what it is doing, the target and an aria-labelled pulsing dot', async () => {
  stub([
    {
      entityRef: 'component:default/dinesh',
      telemetryId: 'dinesh',
      title: 'Dinesh',
      runs: [run({ state: 'running', currentActivity: 'after get_file_content', target: '!148', startedAt: ago(300) })],
    },
  ]);
  const { findByText, container } = render(<FleetActivity pollMs={60000} />);
  await findByText('Dinesh');
  const text = container.textContent ?? '';
  assert.match(text, /after get_file_content/);
  assert.match(text, /!148/);
  assert.match(text, /running for 5m/);
  assert.ok(container.querySelector('[aria-label="running"]'));
});

test('running agent without current activity says Running, never Idle', async () => {
  stub([{ entityRef: 'component:default/a', telemetryId: 'a', title: 'A', runs: [run({ state: 'running' })] }]);
  const { findByText, container } = render(<FleetActivity pollMs={60000} />);
  await findByText('A');
  assert.match(container.textContent ?? '', /Running/);
  assert.doesNotMatch(container.textContent ?? '', /Idle/);
});

test('idle agent shows last run time and the verdict chip', async () => {
  stub([
    {
      entityRef: 'component:default/dinesh',
      telemetryId: 'dinesh',
      title: 'Dinesh',
      runs: [run({ verdict: 'risk high · posted', updatedAt: ago(720) })],
    },
  ]);
  const { findByText, container } = render(<FleetActivity pollMs={60000} />);
  await findByText('risk high · posted');
  assert.match(container.textContent ?? '', /Idle · last run 12m ago/);
  assert.ok(container.querySelector('[aria-label="completed"]'));
});

test('agent with a telemetry error keeps its title and says telemetry is unavailable', async () => {
  stub([{ entityRef: 'component:default/jared', telemetryId: 'jared', title: 'Jared', runs: [], error: 'telemetry query failed' }]);
  const { findByText } = render(<FleetActivity pollMs={60000} />);
  await findByText('Jared');
  await findByText('Telemetry unavailable');
});

test('empty fleet explains the telemetry-id requirement', async () => {
  stub([]);
  const { findByText } = render(<FleetActivity pollMs={60000} />);
  await findByText(/ai-agent\.io\/telemetry-id/);
});

test('a failed refresh keeps the last data and shows a warning', async () => {
  let n = 0;
  stub(async () => {
    n++;
    if (n === 1) return [{ entityRef: 'component:default/dinesh', telemetryId: 'dinesh', title: 'Dinesh', runs: [run({})] }];
    throw new Error('down');
  });
  const { findByText } = render(<FleetActivity pollMs={30} />);
  await findByText('Dinesh');
  await findByText(/Showing last known data/);
  await findByText('Dinesh');
});

test('a first-load failure shows the error state instead of an empty fleet', async () => {
  stub(async () => {
    throw new Error('Failed to load activity: 500');
  });
  const { findByText } = render(<FleetActivity pollMs={60000} />);
  await findByText('Failed to load fleet activity');
  await findByText('Failed to load activity: 500');
});

test('clicking or pressing Enter/Space toggles the card expansion', async () => {
  stub([{ entityRef: 'component:default/dinesh', telemetryId: 'dinesh', title: 'Dinesh', runs: [run({})] }]);
  const { findByRole } = render(<FleetActivity pollMs={60000} />);
  const card = await findByRole('button', { name: /Dinesh/ });
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  fireEvent.click(card);
  await waitFor(() => assert.equal(card.getAttribute('aria-expanded'), 'true'));
  fireEvent.keyDown(card, { key: 'Enter' });
  await waitFor(() => assert.equal(card.getAttribute('aria-expanded'), 'false'));
  fireEvent.keyDown(card, { key: ' ' });
  await waitFor(() => assert.equal(card.getAttribute('aria-expanded'), 'true'));
});

test('Sparkline draws one point per run (max 10) and flags failed ones', () => {
  const runs = [
    run({ state: 'completed' }),
    run({ state: 'failed' }),
    run({ state: 'completed', startedAt: undefined, updatedAt: undefined }),
  ];
  const { container } = render(<Sparkline runs={runs} />);
  const dots = [...container.querySelectorAll('circle')];
  assert.equal(dots.length, 3);
  assert.deepEqual(dots.map(d => d.getAttribute('data-failed')), ['false', 'true', 'false']);
  assert.ok(container.querySelector('polyline'));
  for (const d of dots) assert.ok(Number.isFinite(Number(d.getAttribute('cy'))));

  cleanup();
  const many = render(<Sparkline runs={Array.from({ length: 15 }, () => run({}))} />);
  assert.equal(many.container.querySelectorAll('circle').length, 10);
});
