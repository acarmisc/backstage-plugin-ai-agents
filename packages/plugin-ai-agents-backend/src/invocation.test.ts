import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Entity } from '@backstage/catalog-model';
import { buildPrompt, fillTemplate, makeSessionId } from './invocation';

function makeEntity(
  name: string,
  namespace: string = 'default',
  annotations?: Record<string, string>,
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace, annotations },
    spec: { type: 'ai-agent', lifecycle: 'production', owner: 'x' },
  } as Entity;
}

test('fillTemplate replaces placeholders with values', () => {
  const result = fillTemplate('Review MR !{target} in {project}. Action: {action}.', {
    target: '123',
    project: 'my-project',
    action: 'approve',
  });
  assert.equal(result, 'Review MR !123 in my-project. Action: approve.');
});

test('fillTemplate leaves unknown placeholders unchanged', () => {
  const result = fillTemplate('Do {action} with {unknown}', { action: 'something' });
  assert.equal(result, 'Do something with {unknown}');
});

test('buildPrompt uses prompt-template annotation when present', () => {
  const entity = makeEntity('test', 'default', {
    'ai-agent.io/prompt-template': 'Triage issue {issue}',
  });
  const result = buildPrompt(entity, { issue: 'JIRA-1' });
  assert.equal(result, 'Triage issue JIRA-1');
});

test('buildPrompt falls back to JSON dump when template absent', () => {
  const entity = makeEntity('test', 'default', {});
  const result = buildPrompt(entity, { field1: 'value1', field2: 'value2' });
  const parsed = JSON.parse(result);
  assert.deepEqual(parsed, { field1: 'value1', field2: 'value2' });
});

test('makeSessionId creates unique session ids', () => {
  const id1 = makeSessionId('agent-1');
  const id2 = makeSessionId('agent-1');
  assert.ok(id1.startsWith('agent-1-'));
  assert.ok(id2.startsWith('agent-1-'));
  assert.notEqual(id1, id2, 'Session IDs should be unique');
});

test('buildPrompt warns exactly once per entity when legacy prompt-template annotation is used', () => {
  const calls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args) => calls.push(args);

  try {
    const entity = makeEntity('legacy-prompt-unique', 'custom-ns', {
      'ai-agent.acarmisc.org/prompt-template': 'Legacy template: {data}',
    });

    // First call: should trigger warning
    const result1 = buildPrompt(entity, { data: 'test1' });
    assert.equal(result1, 'Legacy template: test1');
    assert.equal(calls.length, 1, 'Warning should be logged once');
    assert.ok(
      String(calls[0][0]).includes('ai-agent.acarmisc.org/prompt-template'),
      'Warning should mention legacy annotation',
    );
    assert.ok(
      String(calls[0][0]).includes('ai-agent.io/prompt-template'),
      'Warning should mention new annotation',
    );
    assert.ok(
      String(calls[0][0]).includes('legacy-prompt-unique'),
      'Warning should mention entity name',
    );
    assert.ok(
      String(calls[0][0]).includes('custom-ns'),
      'Warning should mention namespace',
    );

    // Second call with same entity: should NOT trigger another warning (dedup)
    const result2 = buildPrompt(entity, { data: 'test2' });
    assert.equal(result2, 'Legacy template: test2');
    assert.equal(calls.length, 1, 'Warning should still be 1 (dedup working)');
  } finally {
    console.warn = originalWarn;
  }
});

test('buildPrompt does not warn when new prefix prompt-template annotation is present', () => {
  const calls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args) => calls.push(args);

  try {
    const entity = makeEntity('new-prefix-prompt', 'default', {
      'ai-agent.io/prompt-template': 'New template: {data}',
    });

    buildPrompt(entity, { data: 'test' });
    assert.equal(calls.length, 0, 'No warning when new prefix is present');
  } finally {
    console.warn = originalWarn;
  }
});

test('buildPrompt does not warn when prompt-template annotation is absent', () => {
  const calls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args) => calls.push(args);

  try {
    const entity = makeEntity('no-template', 'default', {});

    buildPrompt(entity, { data: 'test' });
    assert.equal(calls.length, 0, 'No warning when annotation is absent');
  } finally {
    console.warn = originalWarn;
  }
});
