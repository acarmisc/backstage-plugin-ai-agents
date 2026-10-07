import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  render,
  cleanup,
  screen,
  fireEvent,
  within,
} from '@testing-library/react';
import { AgentFiltersBar } from './AgentFilters';
import { initialFilters } from '../hooks/useAgents';
import type { AgentFilters } from '../hooks/useAgents';
import { makeAgent } from '../__fixtures__/agents';

afterEach(cleanup);

const agents = [
  makeAgent({ entityRef: 'component:default/a', name: 'a' }),
  makeAgent({
    entityRef: 'component:default/b',
    name: 'b',
    runtime: { runtime: 'kagent' } as any,
    lifecycle: 'production',
    owner: 'group:ops',
  }),
];

function setup(filters: Partial<AgentFilters> = {}) {
  const patches: Partial<AgentFilters>[] = [];
  let resets = 0;
  render(
    <AgentFiltersBar
      agents={agents}
      filters={{ ...initialFilters, ...filters }}
      onChange={p => patches.push(p)}
      onReset={() => (resets += 1)}
    />,
  );
  return { patches, resets: () => resets };
}

test('shows the number of agents', () => {
  setup();
  assert.ok(screen.getByText('2'));
  assert.ok(screen.getByText(/agents$/));
});

test('uses the singular for one agent', () => {
  render(
    <AgentFiltersBar
      agents={[agents[0]]}
      filters={initialFilters}
      onChange={() => {}}
      onReset={() => {}}
    />,
  );
  assert.ok(screen.getByText(/agent$/));
});

test('typing in the search field reports the new text', () => {
  const { patches } = setup();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search agents' }), {
    target: { value: 'triage' },
  });
  assert.deepEqual(patches.at(-1), { search: 'triage' });
});

test('no active filters: no clear button and no tags', () => {
  setup();
  assert.equal(screen.queryByRole('button', { name: 'Clear filters' }), null);
  assert.equal(screen.queryByRole('grid', { name: 'Active filters' }), null);
});

test('active filters show as tags and can be cleared all at once', () => {
  const { resets } = setup({
    search: 'triage',
    runtime: ['kagent'],
    capability: ['reasoning'],
    lifecycle: ['production'],
    owner: ['group:ops'],
  });
  // Scoped to the tag list: selected values also show in the select triggers.
  const tags = within(screen.getByRole('grid', { name: 'Active filters' }));
  for (const label of [
    '"triage"',
    'kagent',
    'reasoning',
    'production',
    'group:ops',
  ]) {
    assert.ok(tags.getByText(label), label);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  assert.equal(resets(), 1);
});

test('removing a tag drops only that value', () => {
  const { patches } = setup({ runtime: ['kagent', 'litellm'] });
  const removeButtons = screen.getAllByRole('button', { name: /remove/i });
  assert.equal(removeButtons.length, 2);
  fireEvent.click(removeButtons[0]);
  assert.deepEqual(patches.at(-1), { runtime: ['litellm'] });
});

test('removing the search tag clears the search', () => {
  const { patches } = setup({ search: 'triage' });
  fireEvent.click(screen.getByRole('button', { name: /remove/i }));
  assert.deepEqual(patches.at(-1), { search: '' });
});

test('"More filters" counts the lifecycle and owner filters', () => {
  setup({ lifecycle: ['production'], owner: ['group:ops'] });
  assert.ok(screen.getByRole('button', { name: 'More filters · 2' }));
});
