import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entityToAgent, AI_AGENT_TYPE } from './types';
import type { Entity } from '@backstage/catalog-model';

const baseEntity = (overrides: Partial<Entity> = {}): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'test-agent',
    ...overrides.metadata,
  },
  spec: { type: 'ai-agent', lifecycle: 'production', owner: 'team-a', ...overrides.spec },
  ...overrides,
} as Entity);

test('entityToAgent returns undefined for non ai-agent components', () => {
  const e = baseEntity({ spec: { type: 'service', lifecycle: 'production', owner: 'x' } });
  assert.equal(entityToAgent(e), undefined);
});

test('entityToAgent maps core fields and defaults runtime to custom', () => {
  const a = entityToAgent(baseEntity());
  assert.ok(a);
  assert.equal(a!.entityRef, 'component:default/test-agent');
  assert.equal(a!.name, 'test-agent');
  assert.equal(a!.runtime.runtime, 'custom');
  assert.equal(a!.billing.model, 'free');
  assert.equal(a!.capabilities.length, 0);
  assert.equal(a!.lifecycle, 'production');
  assert.equal(a!.owner, 'team-a');
});

test('entityToAgent parses annotations for runtime, billing, capabilities, version', () => {
  const e = baseEntity({
    metadata: {
      name: 'triage',
      description: 'Routes tickets.',
      annotations: {
        'ai-agent.acarmisc.org/runtime': 'bedrock-agentcore',
        'ai-agent.acarmisc.org/runtime-handle': 'arn:aws:bedrock:us-east-1:1:agent/T',
        'ai-agent.acarmisc.org/endpoint': 'https://api.example.com/invoke',
        'ai-agent.acarmisc.org/health': 'https://api.example.com/health',
        'ai-agent.acarmisc.org/billing-model': 'per-token',
        'ai-agent.acarmisc.org/cost-per-1k': '2.40',
        'ai-agent.acarmisc.org/budget': '100',
        'ai-agent.acarmisc.org/capabilities': 'tool-use:tools,rag:retrieval,reasoning',
        'ai-agent.acarmisc.org/version': '1.2.3',
        'ai-agent.acarmisc.org/avatar': 'https://example.com/a.png',
      },
      tags: ['ai-agent', 'llm'],
      links: [
        { url: 'https://grafana.example.com', title: 'Metrics', icon: 'dashboard' },
      ],
    },
  });
  const a = entityToAgent(e)!;
  assert.equal(a.runtime.runtime, 'bedrock-agentcore');
  assert.equal(a.runtime.runtimeHandle, 'arn:aws:bedrock:us-east-1:1:agent/T');
  assert.equal(a.runtime.endpoint, 'https://api.example.com/invoke');
  assert.equal(a.billing.model, 'per-token');
  assert.equal(a.billing.unitCost, 2.40);
  assert.equal(a.billing.budget, 100);
  assert.equal(a.version, '1.2.3');
  assert.equal(a.avatarUrl, 'https://example.com/a.png');
  assert.equal(a.capabilities.length, 3);
  assert.deepEqual(
    a.capabilities.map(c => [c.label, c.category ?? null]),
    [['tool-use', 'tools'], ['rag', 'retrieval'], ['reasoning', null]],
  );
  assert.equal(a.links.length, 1);
  assert.equal(a.tags.length, 2);
});

test('entityToAgent uses namespace in entity ref', () => {
  const e = baseEntity({ metadata: { name: 'x', namespace: 'custom' } });
  assert.equal(entityToAgent(e)!.entityRef, 'component:custom/x');
});

test('entityToAgent falls back to description for purpose', () => {
  const e = baseEntity({ metadata: { name: 'x', description: 'Does a thing.' } });
  assert.equal(entityToAgent(e)!.purpose, 'Does a thing.');
});

test('entityToAgent prefers explicit purpose annotation over description', () => {
  const e = baseEntity({
    metadata: {
      name: 'x',
      description: 'Generic desc.',
      annotations: { 'ai-agent.acarmisc.org/purpose': 'Specific purpose.' },
    },
  });
  assert.equal(entityToAgent(e)!.purpose, 'Specific purpose.');
});

test('entityToAgent ignores invalid capability categories', () => {
  const e = baseEntity({
    metadata: {
      name: 'x',
      annotations: { 'ai-agent.acarmisc.org/capabilities': 'foo:bogus,bar:tools' },
    },
  });
  const caps = entityToAgent(e)!.capabilities;
  assert.deepEqual(
    caps.map(c => [c.label, c.category ?? null]),
    [['foo', null], ['bar', 'tools']],
  );
});

test('entityToAgent accepts a status override', () => {
  const e = baseEntity();
  const a = entityToAgent(e, { state: 'healthy', latencyMs: 42 })!;
  assert.equal(a.status?.state, 'healthy');
  assert.equal(a.status?.latencyMs, 42);
});

test('AI_AGENT_TYPE is ai-agent', () => {
  assert.equal(AI_AGENT_TYPE, 'ai-agent');
});