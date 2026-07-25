import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, initialFilters } from './hooks/useAgents';
import type { AiAgent } from './types';

const mk = (over: Partial<AiAgent>): AiAgent =>
  ({
    entityRef: 'component:default/x',
    name: 'x',
    purpose: '',
    runtime: { runtime: 'custom' },
    billing: { model: 'free' },
    capabilities: [],
    tags: [],
    links: [],
    rawEntity: {} as any,
    ...over,
  }) as AiAgent;

test('applyFilters search matches name/title/purpose case-insensitively', () => {
  const agents = [
    mk({ name: 'triage-agent', title: 'Triage', purpose: 'routes tickets' }),
    mk({ name: 'other', title: 'Other', purpose: 'unrelated' }),
  ];
  const r = applyFilters(agents, { ...initialFilters, search: 'TRIAGE' });
  assert.equal(r.length, 1);
  assert.equal(r[0].name, 'triage-agent');
});

test('applyFilters runtime filters by runtime name', () => {
  const agents = [
    mk({ runtime: { runtime: 'bedrock-agentcore' } }),
    mk({ runtime: { runtime: 'litellm' } }),
  ];
  const r = applyFilters(agents, { ...initialFilters, runtime: ['litellm'] });
  assert.equal(r.length, 1);
  assert.equal(r[0].runtime.runtime, 'litellm');
});

test('applyFilters capability requires all selected caps present', () => {
  const agents = [
    mk({ capabilities: [{ label: 'rag' }, { label: 'tools' }] }),
    mk({ capabilities: [{ label: 'rag' }] }),
  ];
  const r = applyFilters(agents, { ...initialFilters, capability: ['rag', 'tools'] });
  assert.equal(r.length, 1);
  assert.equal(r[0].capabilities.length, 2);
});

test('applyFilters lifecycle and owner filter by exact match', () => {
  const agents = [
    mk({ lifecycle: 'production', owner: 'team-a' }),
    mk({ lifecycle: 'experimental', owner: 'team-b' }),
  ];
  const r = applyFilters(agents, {
    ...initialFilters,
    lifecycle: ['production'],
    owner: ['team-a'],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].lifecycle, 'production');
});

test('applyFilters empty filters returns all', () => {
  const agents = [mk({ name: 'a' }), mk({ name: 'b' })];
  assert.equal(applyFilters(agents, initialFilters).length, 2);
});