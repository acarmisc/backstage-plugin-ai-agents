import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigReader } from '@backstage/config';
import {
  KagentInvoker,
  buildMessageMetadata,
  extractResponseText,
  readKagentConfig,
} from './invoker';

test('extractResponseText reads Task artifacts', () => {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    result: {
      status: { state: 'completed' },
      artifacts: [
        {
          name: 'Task Result',
          parts: [{ kind: 'text', text: 'pods: 3 running' }],
        },
      ],
    },
  });
  assert.equal(extractResponseText(body), 'pods: 3 running');
});

test('extractResponseText reads a plain Message result', () => {
  const body = JSON.stringify({
    result: { role: 'agent', parts: [{ kind: 'text', text: 'hello' }] },
  });
  assert.equal(extractResponseText(body), 'hello');
});

test('extractResponseText throws on JSON-RPC error payloads', () => {
  assert.throws(
    () =>
      extractResponseText(
        '{"jsonrpc":"2.0","error":{"code":-32001,"message":"agent not found"}}',
      ),
    /agent not found/,
  );
});

test('readKagentConfig reads full config with defaults', () => {
  const config = new ConfigReader({
    'ai-agents': {
      invocations: { kagent: { baseUrl: 'http://kagent-controller:8083' } },
    },
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
      invocations: {
        kagent: {
          baseUrl: 'http://kagent-controller:8083',
          namespace: 'default',
        },
      },
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
    threadId: 'helm-bot-thread',
    prompt: 'list pods',
    fields: {},
    args: { post: false },
    tags: [],
    target: { runtimeHandle: 'helm-agent' },
  });

  assert.equal(result.responseText, 'done');
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'http://kagent-controller:8083/api/a2a/default/helm-agent/',
  );
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.method, 'message/send');
  assert.equal(body.params.message.parts[0].text, 'list pods');
  assert.equal(body.params.message.contextId, 'helm-bot-thread');
  assert.equal(body.params.message.metadata.post, false);
  assert.deepEqual(body.params.message.metadata.litellm_tags, [
    'agent:helm-bot',
  ]);
});

test('buildMessageMetadata sends post:false and cost tags by default', () => {
  const metadata = buildMessageMetadata({
    entityRef: 'component:default/helm-bot',
    sessionId: 's',
    threadId: 't1',
    prompt: 'list pods',
    fields: {},
    args: { post: false },
    tags: ['session:t1', 'backstage-entity:component:default/helm-bot'],
    target: {},
  });
  assert.equal(metadata.post, false);
  assert.deepEqual(metadata.litellm_tags, [
    'agent:helm-bot',
    'session:t1',
    'backstage-entity:component:default/helm-bot',
  ]);
  assert.ok(!('knowledge_base_ids' in metadata));
  assert.ok(!('trace_user_id' in metadata));
});

test('buildMessageMetadata passes through post:true, target/project and trace_user_id', () => {
  const metadata = buildMessageMetadata({
    entityRef: 'component:default/helm-bot',
    sessionId: 's',
    threadId: 't1',
    prompt: 'list pods',
    fields: {},
    args: { post: true, target: '42', project: 'innovation/x' },
    tags: [],
    traceUserId: 'user:default/jane',
    target: {},
  });
  assert.equal(metadata.post, true);
  assert.equal(metadata.target, '42');
  assert.equal(metadata.project, 'innovation/x');
  assert.equal(metadata.trace_user_id, 'user:default/jane');
});

test('buildMessageMetadata sends knowledge_base_ids only when set', () => {
  const withKb = buildMessageMetadata({
    entityRef: 'component:default/helm-bot',
    sessionId: 's',
    threadId: 't1',
    prompt: 'p',
    fields: {},
    args: { post: false, knowledgeBaseIds: ['kb-1', 'kb-2'] },
    tags: [],
    target: {},
  });
  assert.deepEqual(withKb.knowledge_base_ids, ['kb-1', 'kb-2']);
  const withoutKb = buildMessageMetadata({
    entityRef: 'component:default/helm-bot',
    sessionId: 's',
    threadId: 't1',
    prompt: 'p',
    fields: {},
    args: { post: false },
    tags: [],
    target: {},
  });
  assert.ok(!('knowledge_base_ids' in withoutKb));
});

test('KagentInvoker throws when no runtime-handle annotation is set', async () => {
  const config = new ConfigReader({
    'ai-agents': { invocations: { kagent: { baseUrl: 'http://x:8083' } } },
  });
  const invoker = new KagentInvoker(
    config,
    (async () => ({}) as Response) as typeof fetch,
  );
  await assert.rejects(
    invoker.invoke({
      entityRef: 'component:default/x',
      sessionId: 's',
      threadId: 't',
      prompt: 'p',
      fields: {},
      args: { post: false },
      tags: [],
      target: {},
    }),
    /runtime-handle/,
  );
});

test('KagentInvoker rejects an endpoint override on another origin without fetching', async () => {
  const config = new ConfigReader({
    'ai-agents': {
      invocations: {
        kagent: {
          baseUrl: 'http://kagent-controller:8083',
          authHeader: 'Bearer secret',
        },
      },
    },
  });
  const calls: any[] = [];
  const fetchImpl = (async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok: true,
      text: async () =>
        JSON.stringify({ result: { parts: [{ kind: 'text', text: 'ok' }] } }),
    } as Response;
  }) as typeof fetch;
  const invoker = new KagentInvoker(config, fetchImpl);
  await assert.rejects(
    invoker.invoke({
      entityRef: 'component:default/a',
      sessionId: 's',
      threadId: 't',
      prompt: 'p',
      fields: {},
      args: { post: false },
      tags: [],
      target: { runtimeHandle: 'a', endpoint: 'https://evil.example' },
    }),
    /not on the configured kagent controller origin/,
  );
  assert.equal(calls.length, 0);
});

test('KagentInvoker sends authHeader to a same-origin endpoint override', async () => {
  const config = new ConfigReader({
    'ai-agents': {
      invocations: {
        kagent: {
          baseUrl: 'http://kagent-controller:8083',
          authHeader: 'Bearer secret',
        },
      },
    },
  });
  const calls: any[] = [];
  const fetchImpl = (async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok: true,
      text: async () =>
        JSON.stringify({ result: { parts: [{ kind: 'text', text: 'ok' }] } }),
    } as Response;
  }) as typeof fetch;
  const invoker = new KagentInvoker(config, fetchImpl);
  const req = {
    entityRef: 'component:default/a',
    sessionId: 's',
    threadId: 't',
    prompt: 'p',
    fields: {},
    args: { post: false },
    tags: [],
  };
  await invoker.invoke({
    ...req,
    target: {
      runtimeHandle: 'a',
      endpoint: 'http://kagent-controller:8083/other-path',
    },
  });
  await invoker.invoke({ ...req, target: { runtimeHandle: 'a' } });
  assert.equal(
    calls[0].url,
    'http://kagent-controller:8083/other-path/api/a2a/kagent/a/',
  );
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer secret');
});
