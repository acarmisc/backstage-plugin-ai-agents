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
        'ai-agent.io/runtime': 'bedrock-agentcore',
        'ai-agent.io/runtime-handle': 'arn:aws:bedrock:us-east-1:1:agent/T',
        'ai-agent.io/endpoint': 'https://api.example.com/invoke',
        'ai-agent.io/health': 'https://api.example.com/health',
        'ai-agent.io/billing-model': 'per-token',
        'ai-agent.io/cost-per-1k': '2.40',
        'ai-agent.io/budget': '100',
        'ai-agent.io/capabilities': 'tool-use:tools,rag:retrieval,reasoning',
        'ai-agent.io/version': '1.2.3',
        'ai-agent.io/avatar': 'https://example.com/a.png',
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
      annotations: { 'ai-agent.io/purpose': 'Specific purpose.' },
    },
  });
  assert.equal(entityToAgent(e)!.purpose, 'Specific purpose.');
});

test('entityToAgent ignores invalid capability categories', () => {
  const e = baseEntity({
    metadata: {
      name: 'x',
      annotations: { 'ai-agent.io/capabilities': 'foo:bogus,bar:tools' },
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

test('entityToAgent leaves hireSchema undefined when no annotation', () => {
  const a = entityToAgent(baseEntity())!;
  assert.equal(a.hireSchema, undefined);
});

test('entityToAgent parses a valid hire-schema annotation', () => {
  const e = baseEntity({
    metadata: {
      name: 'x',
      annotations: {
        'ai-agent.io/hire-schema':
          '[{"name":"project","label":"Project","type":"text","required":true},' +
          '{"name":"action","label":"Action","type":"select","options":["dry-run","post"],"default":"dry-run"}]',
      },
    },
  });
  const a = entityToAgent(e)!;
  assert.ok(Array.isArray(a.hireSchema));
  assert.equal(a.hireSchema!.length, 2);
  assert.deepEqual(a.hireSchema![0], {
    name: 'project',
    label: 'Project',
    type: 'text',
    required: true,
    default: undefined,
    options: undefined,
    help: undefined,
  });
  assert.deepEqual(a.hireSchema![1].options, ['dry-run', 'post']);
  assert.equal(a.hireSchema![1].default, 'dry-run');
});

test('entityToAgent coerces unknown hire field types to text', () => {
  const e = baseEntity({
    metadata: {
      name: 'x',
      annotations: {
        'ai-agent.io/hire-schema':
          '[{"name":"f","label":"F","type":"bogus"}]',
      },
    },
  });
  const a = entityToAgent(e)!;
  assert.equal(a.hireSchema![0].type, 'text');
});

test('entityToAgent returns undefined hireSchema for malformed JSON', () => {
  const e = baseEntity({
    metadata: {
      name: 'x',
      annotations: { 'ai-agent.io/hire-schema': 'not-json{' },
    },
  });
  const a = entityToAgent(e)!;
  assert.equal(a.hireSchema, undefined);
});

test('entityToAgent returns undefined hireSchema for non-array JSON', () => {
  const e = baseEntity({
    metadata: {
      name: 'x',
      annotations: { 'ai-agent.io/hire-schema': '{"a":1}' },
    },
  });
  const a = entityToAgent(e)!;
  assert.equal(a.hireSchema, undefined);
});

test('entityToAgent parses region and prompt-template annotations', () => {
  const e = baseEntity({
    metadata: {
      name: 'x',
      annotations: {
        'ai-agent.io/region': 'eu-west-1',
        'ai-agent.io/prompt-template':
          'Review MR !{target} in {project}. Action: {action}.',
      },
    },
  });
  const a = entityToAgent(e)!;
  assert.equal(a.runtime.region, 'eu-west-1');
  assert.equal(
    a.promptTemplate,
    'Review MR !{target} in {project}. Action: {action}.',
  );
});

test('entityToAgent leaves region and promptTemplate undefined when absent', () => {
  const a = entityToAgent(baseEntity())!;
  assert.equal(a.runtime.region, undefined);
  assert.equal(a.promptTemplate, undefined);
});

test('entityToAgent falls back to legacy ai-agent.acarmisc.org prefix when new prefix absent', () => {
  const e = baseEntity({
    metadata: {
      name: 'legacy-agent',
      annotations: {
        'ai-agent.acarmisc.org/runtime': 'bedrock-agentcore',
        'ai-agent.acarmisc.org/runtime-handle': 'arn:aws:bedrock:us-east-1:1:agent/LEGACY',
        'ai-agent.acarmisc.org/version': '1.0.0',
      },
    },
  });
  const a = entityToAgent(e)!;
  assert.equal(a.runtime.runtime, 'bedrock-agentcore');
  assert.equal(a.runtime.runtimeHandle, 'arn:aws:bedrock:us-east-1:1:agent/LEGACY');
  assert.equal(a.version, '1.0.0');
});