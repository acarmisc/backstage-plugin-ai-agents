import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Entity } from '@backstage/catalog-model';
import { createRouter } from './router';
import type { ProbeFn, ProbeResult } from './types';

function makeEntity(name: string, annotations?: Record<string, string>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, annotations },
    spec: { type: 'ai-agent', lifecycle: 'production', owner: 'x' },
  } as Entity;
}

function makeConfig(over: Record<string, unknown> = {}) {
  return {
    getOptionalConfig: () => undefined,
    getOptionalBoolean: (k: string) => (k === 'enabled' ? over.enabled : undefined),
    getOptionalNumber: (k: string) => over[k as string] as number | undefined,
    getOptionalString: (k: string) => over[k as string] as string | undefined,
    getOptionalStringArray: (k: string) => over[k as string] as string[] | undefined,
  } as any;
}

function stubCatalog(items: (Entity | undefined)[]) {
  return {
    getEntitiesByRefs: async (_r: { entityRefs: string[] }) => ({ items }),
  };
}

function stubAuth() {
  return {
    getPluginRequestToken: async () => ({ token: 'tok' }),
    getOwnServiceCredentials: async () => ({}),
  } as any;
}

async function startServer(router: express.Router): Promise<{ url: string; close: () => Promise<void> }> {
  const app = express();
  app.use(router);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://localhost:${port}`,
    close: () => new Promise<void>(r => server.close(() => r())),
  };
}

const noopLogger = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {} } as any;

test('GET /health returns ok', async () => {
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/health`);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.enabled, true);
  } finally {
    await close();
  }
});

test('GET /statuses probes healthy agent and caches', async () => {
  const entity = makeEntity('triage', {
    'ai-agent.acarmisc.org/health': 'https://api.example.com/health',
  });
  let probeCalls = 0;
  const probe: ProbeFn = async () => {
    probeCalls++;
    return { ok: true, status: 200, latencyMs: 10 } as ProbeResult;
  };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    probe,
  });
  const { url, close } = await startServer(router);
  try {
    const res1 = await fetch(`${url}/statuses?refs=component:default/triage`);
    const body1 = await res1.json();
    assert.equal(body1['component:default/triage'].state, 'healthy');
    const res2 = await fetch(`${url}/statuses?refs=component:default/triage`);
    await res2.json();
    assert.equal(probeCalls, 1);
  } finally {
    await close();
  }
});

test('GET /statuses returns empty object when disabled', async () => {
  const router = await createRouter({
    config: makeConfig({ enabled: false }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/statuses?refs=component:default/x`);
    assert.deepEqual(await res.json(), {});
  } finally {
    await close();
  }
});

test('GET /statuses skips entities with no probe url → unknown', async () => {
  const entity = makeEntity('nohealth');
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    probe: async () => ({ ok: true, status: 200, latencyMs: 1 }),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/statuses?refs=component:default/nohealth`);
    const body = await res.json();
    assert.equal(body['component:default/nohealth'].state, 'unknown');
  } finally {
    await close();
  }
});

test('GET /statuses filters non ai-agent entities', async () => {
  const wrongType = { ...makeEntity('svc'), spec: { type: 'service', owner: 'x' } };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([wrongType]),
    probe: async () => ({ ok: true, status: 200, latencyMs: 1 }),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/statuses?refs=component:default/svc`);
    assert.deepEqual(await res.json(), {});
  } finally {
    await close();
  }
});

test('GET /status/:ref returns 404 for missing entity', async () => {
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([undefined]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/status/component:default/missing`);
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});
test('POST /invocations returns 501 without an invoker module', async () => {
  const entity = makeEntity('triage', {
    'ai-agent.acarmisc.org/runtime-handle': 'arn:aws:bedrock-agentcore:eu-west-1:1:runtime/x',
  });
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/invocations/component%3Adefault%2Ftriage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: {} }),
    });
    assert.equal(res.status, 501);
  } finally {
    await close();
  }
});

test('POST /invocations fills prompt template and records ok/error', async () => {
  const entity = makeEntity('triage', {
    'ai-agent.acarmisc.org/prompt-template': 'Triage issue {issue}',
    'ai-agent.acarmisc.org/region': 'eu-west-1',
    'ai-agent.acarmisc.org/runtime-handle':
      'arn:aws:bedrock-agentcore:eu-west-1:123456789012:runtime/support-triage-runtime-Xq7AsdA8od',
  });
  const requests: any[] = [];
  const invoker = {
    invoke: async (req: any) => {
      requests.push(req);
      if (req.fields.fail) throw new Error('agent exploded');
      return { responseText: `done:${req.prompt}`, latencyMs: 42 };
    },
  };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    invoker,
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/invocations/component%3Adefault%2Ftriage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: { issue: 'JIRA-1' } }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.responseText, 'done:Triage issue JIRA-1');
    assert.ok(body.sessionId.length >= 33);
    assert.equal(requests[0].target.region, 'eu-west-1');

    const failRes = await fetch(`${url}/invocations/component%3Adefault%2Ftriage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: { fail: 'yes' } }),
    });
    assert.equal(failRes.status, 502);
    const failBody = await failRes.json();
    assert.match(failBody.error, /agent exploded/);
  } finally {
    await close();
  }
});
