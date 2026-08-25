import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Entity } from '@backstage/catalog-model';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
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
    getOptionalConfig: () => ({
      getOptionalBoolean: (k: string) => (k === 'enabled' ? over.enabled : undefined),
      getOptionalNumber: (k: string) => over[k as string] as number | undefined,
      getOptionalString: (k: string) => over[k as string] as string | undefined,
      getOptionalStringArray: (k: string) => over[k as string] as string[] | undefined,
    }),
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

function stubHttpAuth() {
  return {
    credentials: async () => ({
      principal: { type: 'user', userEntityRef: 'user:default/test-user' },
    }),
  } as any;
}

function stubPermissions(result: AuthorizeResult) {
  return {
    authorize: async () => [{ result }],
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
    config: makeConfig({ probeAllowlist: ['https://api.example.com*'] }),
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
    invokers: new Map([['bedrock-agentcore', invoker]]),
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

test('POST /invocations returns 403 when permissions deny', async () => {
  const entity = makeEntity('triage', {
    'ai-agent.acarmisc.org/runtime-handle':
      'arn:aws:bedrock-agentcore:eu-west-1:123456789012:runtime/support-triage-runtime-Xq7AsdA8od',
  });
  const invoker = {
    invoke: async () => ({ responseText: 'ok', latencyMs: 10 }),
  };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    invokers: new Map([['bedrock-agentcore', invoker]]),
    httpAuth: stubHttpAuth(),
    permissions: stubPermissions(AuthorizeResult.DENY),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/invocations/component%3Adefault%2Ftriage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: {} }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /not authorized/);
  } finally {
    await close();
  }
});

test('POST /invocations returns 200 when permissions allow', async () => {
  const entity = makeEntity('triage', {
    'ai-agent.acarmisc.org/prompt-template': 'Triage issue {issue}',
    'ai-agent.acarmisc.org/runtime-handle':
      'arn:aws:bedrock-agentcore:eu-west-1:123456789012:runtime/support-triage-runtime-Xq7AsdA8od',
  });
  const invoker = {
    invoke: async (req: any) => ({ responseText: `ok:${req.prompt}`, latencyMs: 42 }),
  };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    invokers: new Map([['bedrock-agentcore', invoker]]),
    httpAuth: stubHttpAuth(),
    permissions: stubPermissions(AuthorizeResult.ALLOW),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/invocations/component%3Adefault%2Ftriage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: { issue: 'JIRA-1' } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.responseText, 'ok:Triage issue JIRA-1');
  } finally {
    await close();
  }
});

test('POST /invocations dispatches to the invoker matching the runtime annotation', async () => {
  const entity = makeEntity('cluster-bot', {
    'ai-agent.io/runtime': 'kagent',
    'ai-agent.io/runtime-handle': 'helm-agent',
    'ai-agent.io/namespace': 'kagent',
  });
  const agentcore = { invoke: async () => ({ responseText: 'wrong invoker', latencyMs: 1 }) };
  const kagent = {
    invoke: async (req: any) => ({ responseText: `kagent:${req.target.namespace}/${req.target.runtimeHandle}`, latencyMs: 5 }),
  };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    invokers: new Map([
      ['bedrock-agentcore', agentcore],
      ['kagent', kagent],
    ]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/invocations/component%3Adefault%2Fcluster-bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: {} }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.responseText, 'kagent:kagent/helm-agent');
  } finally {
    await close();
  }
});

test('POST /invocations returns 501 when the runtime annotation matches no registered invoker', async () => {
  const entity = makeEntity('cluster-bot', { 'ai-agent.io/runtime': 'litellm' });
  const kagent = { invoke: async () => ({ responseText: 'x', latencyMs: 1 }) };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    invokers: new Map([['kagent', kagent]]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/invocations/component%3Adefault%2Fcluster-bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: {} }),
    });
    assert.equal(res.status, 501);
    const body = await res.json();
    assert.match(body.error, /litellm/);
  } finally {
    await close();
  }
});

function stubReviews() {
  const inserted: any[] = [];
  return {
    inserted,
    insert: async (rec: any) => {
      inserted.push(rec);
      return inserted.length;
    },
    summaryFor: async () => ({
      reviews: [
        {
          id: 1,
          entityRef: 'component:default/triage',
          userRef: 'user:default/alice',
          rating: 4,
          comment: 'great agent',
          createdAt: '2026-08-23T10:00:00.000Z',
        },
      ],
      count: 1,
      average: 4,
    }),
  };
}

test('POST /reviews validates rating and stores review', async () => {
  const reviews = stubReviews();
  const entity = makeEntity('triage');
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    reviews,
  });
  const { url, close } = await startServer(router);
  try {
    const ok = await fetch(`${url}/reviews/component%3Adefault%2Ftriage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 4, comment: ' great agent ' }),
    });
    assert.equal(ok.status, 201);
    assert.equal(reviews.inserted[0].rating, 4);
    assert.equal(reviews.inserted[0].comment, 'great agent');

    for (const bad of [6, -1, 2.5, 'x']) {
      const badRes = await fetch(`${url}/reviews/component%3Adefault%2Ftriage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: bad }),
      });
      assert.equal(badRes.status, 400, `rating ${bad} should be rejected`);
    }

    const list = await fetch(`${url}/reviews/component%3Adefault%2Ftriage`);
    const body = await list.json();
    assert.equal(body.count, 1);
    assert.equal(body.average, 4);
    assert.equal(body.reviews[0].comment, 'great agent');
  } finally {
    await close();
  }
});

test('POST /reviews rejects refs that are not an ai-agent entity', async () => {
  const reviews = stubReviews();
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([undefined]),
    reviews,
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/reviews/component%3Adefault%2Fghost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    });
    assert.equal(res.status, 404);
    assert.equal(reviews.inserted.length, 0);
  } finally {
    await close();
  }
});

test('GET /reviews returns 501 without database', async () => {
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/reviews/component%3Adefault%2Fx`);
    assert.equal(res.status, 501);
  } finally {
    await close();
  }
});

test('GET /statuses returns 400 when more than 200 refs provided', async () => {
  const refs = Array.from({ length: 201 }, (_, i) => `component:default/agent-${i}`).join(',');
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/statuses?refs=${encodeURIComponent(refs)}`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /too many refs/);
  } finally {
    await close();
  }
});

test('cache eviction: oldest entries are evicted when cache exceeds max size', async () => {
  let probeCalls = 0;
  const countingProbe: ProbeFn = async () => {
    probeCalls += 1;
    return { ok: true, status: 200, latencyMs: 1 } as ProbeResult;
  };

  // Ref-aware stub: resolves each requested ref to its own entity, keyed by
  // the ref string itself (not by array position), so cache keys line up.
  const catalogClient = {
    getEntitiesByRefs: async (r: { entityRefs: string[] }) => ({
      items: r.entityRefs.map(ref => {
        const name = ref.split('/').pop()!;
        return makeEntity(name, {
          'ai-agent.io/health': `https://api.example.com/${name}/health`,
        });
      }),
    }),
  };

  const router = await createRouter({
    config: makeConfig({ probeAllowlist: ['https://api.example.com/*'] }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    maxCacheEntries: 5,
    probe: countingProbe,
    catalogClient,
  });
  const { url, close } = await startServer(router);
  try {
    // Fill the cache to its 5-entry max: agent-0..agent-4, in that order.
    const first5 = Array.from({ length: 5 }, (_, i) => `component:default/agent-${i}`);
    await fetch(`${url}/statuses?refs=${first5.join(',')}`);
    assert.equal(probeCalls, 5);

    // A 6th distinct ref pushes the cache over its max, evicting the oldest
    // entry (agent-0, the first one inserted).
    await fetch(`${url}/statuses?refs=component:default/agent-5`);
    assert.equal(probeCalls, 6);

    // Re-requesting agent-0 must miss the cache (it was evicted) and probe
    // again, while agent-4 — still within the 5-entry window — must hit the
    // cache and NOT trigger another probe call.
    await fetch(
      `${url}/statuses?refs=component:default/agent-0,component:default/agent-4`,
    );
    assert.equal(probeCalls, 7);
  } finally {
    await close();
  }
});
