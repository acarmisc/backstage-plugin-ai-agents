import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigReader } from '@backstage/config';
import {
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
