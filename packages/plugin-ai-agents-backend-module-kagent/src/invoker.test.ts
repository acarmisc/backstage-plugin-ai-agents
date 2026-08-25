import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigReader } from '@backstage/config';
import { KagentInvoker, extractResponseText, readKagentConfig } from './invoker';

test('extractResponseText reads Task artifacts', () => {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    result: {
      status: { state: 'completed' },
      artifacts: [{ name: 'Task Result', parts: [{ kind: 'text', text: 'pods: 3 running' }] }],
    },
  });
  assert.equal(extractResponseText(body), 'pods: 3 running');
});

test('extractResponseText reads a plain Message result', () => {
  const body = JSON.stringify({ result: { role: 'agent', parts: [{ kind: 'text', text: 'hello' }] } });
  assert.equal(extractResponseText(body), 'hello');
});

test('extractResponseText throws on JSON-RPC error payloads', () => {
  assert.throws(
    () => extractResponseText('{"jsonrpc":"2.0","error":{"code":-32001,"message":"agent not found"}}'),
    /agent not found/,
  );
});

test('readKagentConfig reads full config with defaults', () => {
  const config = new ConfigReader({
    'ai-agents': { invocations: { kagent: { baseUrl: 'http://kagent-controller:8083' } } },
  });
  const cfg = readKagentConfig(config);
  assert.equal(cfg?.baseUrl, 'http://kagent-controller:8083');
  assert.equal(cfg?.namespace, 'kagent');
  assert.equal(cfg?.timeoutMs, 120000);
});

test('readKagentConfig returns undefined when unconfigured', () => {
  assert.equal(readKagentConfig(new ConfigReader({})), undefined);
});

test('KagentInvoker posts a message/send JSON-RPC request to the namespaced A2A endpoint', async () => {
  const config = new ConfigReader({
    'ai-agents': {
      invocations: { kagent: { baseUrl: 'http://kagent-controller:8083', namespace: 'default' } },
    },
  });
  const calls: any[] = [];
  const fetchImpl = (async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok: true,
      text: async () =>
        JSON.stringify({ result: { parts: [{ kind: 'text', text: 'done' }] } }),
    } as Response;
  }) as typeof fetch;

  const invoker = new KagentInvoker(config, fetchImpl);
  const result = await invoker.invoke({
    entityRef: 'component:default/helm-bot',
    sessionId: 'session-1234567890123456789012345678',
    prompt: 'list pods',
    fields: {},
    target: { runtimeHandle: 'helm-agent' },
  });

  assert.equal(result.responseText, 'done');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://kagent-controller:8083/api/a2a/default/helm-agent/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.method, 'message/send');
  assert.equal(body.params.message.parts[0].text, 'list pods');
  assert.equal(body.params.message.contextId, 'session-1234567890123456789012345678');
});

test('KagentInvoker throws when no runtime-handle annotation is set', async () => {
  const config = new ConfigReader({
    'ai-agents': { invocations: { kagent: { baseUrl: 'http://x:8083' } } },
  });
  const invoker = new KagentInvoker(config, (async () => ({}) as Response) as typeof fetch);
  await assert.rejects(
    invoker.invoke({
      entityRef: 'component:default/x',
      sessionId: 's',
      prompt: 'p',
      fields: {},
      target: {},
    }),
    /runtime-handle/,
  );
});
