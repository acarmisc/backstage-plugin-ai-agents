import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigReader } from '@backstage/config';
import {
  buildPayload,
  extractResponseText,
  readAgentCoreConfig,
} from './invoker';

test('extractResponseText handles common payload shapes', () => {
  assert.equal(extractResponseText('{"result": "OK\\n"}'), 'OK\n');
  assert.equal(extractResponseText('{"response": "hello"}'), 'hello');
  assert.equal(extractResponseText('"plain string"'), 'plain string');
  assert.equal(extractResponseText('not json'), 'not json');
});

test('extractResponseText throws on AgentCore error payloads', () => {
  assert.throws(
    () => extractResponseText('{"jsonrpc":"2.0","error":{"code":-32001,"message":"aud mismatch"}}'),
    /aud mismatch/,
  );
});

test('readAgentCoreConfig reads full config', () => {
  const config = new ConfigReader({
    'ai-agents': {
      invocations: {
        agentCore: {
          tokenUrl: 'https://idp/token',
          clientId: 'backstage',
          clientSecret: 's3cret',
          region: 'eu-west-1',
        },
      },
    },
  });
  const cfg = readAgentCoreConfig(config);
  assert.equal(cfg?.tokenUrl, 'https://idp/token');
  assert.equal(cfg?.region, 'eu-west-1');
  assert.equal(cfg?.timeoutMs, 120000);
});

test('readAgentCoreConfig returns undefined when unconfigured', () => {
  assert.equal(readAgentCoreConfig(new ConfigReader({})), undefined);
});

test('buildPayload sends structured fields and always includes post', () => {
  const payload = buildPayload({
    entityRef: 'component:default/dinesh',
    sessionId: 's'.repeat(33),
    threadId: 't1',
    prompt: 'Review MR !42',
    fields: {},
    args: { post: false, target: '42', project: 'innovation/x', model: 'sonnet-5' },
    tags: ['channel:backstage', 'session:t1'],
    traceUserId: 'user:default/jane',
    target: {},
  });
  assert.equal(payload.prompt, 'Review MR !42');
  assert.equal(payload.post, false);
  assert.equal(payload.target, '42');
  assert.equal(payload.project, 'innovation/x');
  assert.equal(payload.model, 'sonnet-5');
  assert.equal(payload.trace_user_id, 'user:default/jane');
  assert.deepEqual(payload.litellm_tags, [
    'agent:dinesh',
    'channel:backstage',
    'session:t1',
  ]);
});

test('buildPayload includes post=true and knowledge_base_ids when requested', () => {
  const payload = buildPayload({
    entityRef: 'component:default/erlich',
    sessionId: 's'.repeat(33),
    threadId: 't1',
    prompt: 'why is the deploy failing',
    fields: {},
    args: { post: true, knowledgeBaseIds: ['kb-1', 'kb-2'] },
    tags: [],
    target: {},
  });
  assert.equal(payload.post, true);
  assert.deepEqual(payload.knowledge_base_ids, ['kb-1', 'kb-2']);
  assert.deepEqual(payload.litellm_tags, ['agent:erlich']);
  assert.equal(payload.trace_user_id, undefined);
});
