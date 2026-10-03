import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Entity } from '@backstage/catalog-model';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { createRouter } from './router';
import type { ProbeFn, ProbeResult, TelemetryProvider } from './types';

function makeEntity(name: string, annotations?: Record<string, string>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, annotations },
    spec: { type: 'ai-agent', lifecycle: 'production', owner: 'x' },
  } as Entity;
}

function makeConfig(over: Record<string, unknown> = {}) {
  // Path-aware mock: nested keys read "prefix.key" entries (e.g.
  // "avatarProxy.enabled"), while the top-level "ai-agents" config still
  // resolves the legacy flat keys existing tests pass ("enabled", ...).
  const reader = (prefix: string) => ({
    getOptionalBoolean: (k: string) =>
      over[`${prefix}${k}`] ?? (prefix === '' ? over[k] : undefined) as boolean | undefined,
    getOptionalNumber: (k: string) =>
      over[`${prefix}${k}`] ?? (prefix === '' ? over[k] : undefined) as number | undefined,
    getOptionalString: (k: string) =>
      over[`${prefix}${k}`] ?? (prefix === '' ? over[k] : undefined) as string | undefined,
    getOptionalStringArray: (k: string) =>
      over[`${prefix}${k}`] ?? (prefix === '' ? over[k] : undefined) as string[] | undefined,
    getOptionalConfig: (sub: string) => reader(`${prefix}${sub}.`),
  });
  return {
    getOptionalBoolean: (k: string) => over[k],
    getOptionalNumber: (k: string) => over[k],
    getOptionalString: (k: string) => over[k],
    getOptionalStringArray: (k: string) => over[k],
    getOptionalConfig: (path: string) => reader(path.replace(/^ai-agents\.?/, '')),
  } as any;
}

function stubCatalog(items: (Entity | undefined)[], allEntities?: Entity[]) {
  return {
    getEntitiesByRefs: async (_r: { entityRefs: string[] }) => ({ items }),
    getEntities: async (_f: { filter: Record<string, string> }) => ({ items: allEntities ?? [] }),
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

test('GET /runs resolves the catalog telemetry id before querying the provider', async () => {
  const entity = makeEntity('dinesh', { 'ai-agent.io/telemetry-id': 'dinesh' });
  const calls: string[] = [];
  const telemetryProvider: TelemetryProvider = {
    getRuns: async (telemetryId, limit) => {
      calls.push(`${telemetryId}:${limit}`);
      return [{ runId: 'trace-1', agent: telemetryId, state: 'running' }];
    },
    getRunTimeline: async () => [],
  };
  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]), telemetryProvider,
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/runs/component%3Adefault%2Fdinesh?limit=2`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [{ runId: 'trace-1', agent: 'dinesh', state: 'running' }]);
    assert.deepEqual(calls, ['dinesh:2']);
  } finally {
    await close();
  }
});

test('GET /runs returns 501 without a telemetry provider', async () => {
  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([]),
  });
  const { url, close } = await startServer(router);
  try {
    assert.equal((await fetch(`${url}/runs/component%3Adefault%2Fdinesh`)).status, 501);
  } finally {
    await close();
  }
});

test('GET /insights passes clamped hours to provider', async () => {
  const entity = makeEntity('dinesh', { 'ai-agent.io/telemetry-id': 'dinesh' });
  const calls: Array<[string, number]> = [];
  const telemetryProvider: TelemetryProvider = {
    getRuns: async () => [],
    getRunTimeline: async () => [],
    getInsights: async (telemetryId, hours) => {
      calls.push([telemetryId, hours]);
      return {
        windowHours: hours,
        totals: { runs: 0, running: 0, completed: 0, failed: 0, unknown: 0 },
        durationMs: { p50: 0, p95: 0 },
        histogram: [],
        tools: [],
      };
    },
  };
  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]), telemetryProvider,
  });
  const { url, close } = await startServer(router);
  try {
    const res1 = await fetch(`${url}/insights/component%3Adefault%2Fdinesh?hours=999`);
    assert.equal(res1.status, 200);
    assert.deepEqual(calls[0], ['dinesh', 72]);

    const res2 = await fetch(`${url}/insights/component%3Adefault%2Fdinesh`);
    assert.equal(res2.status, 200);
    assert.deepEqual(calls[1], ['dinesh', 24]);
  } finally {
    await close();
  }
});

test('GET /insights returns 501 without a telemetry provider', async () => {
  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([]),
  });
  const { url, close } = await startServer(router);
  try {
    assert.equal((await fetch(`${url}/insights/component%3Adefault%2Fdinesh`)).status, 501);
  } finally {
    await close();
  }
});

test('GET /insights returns 501 when provider lacks getInsights', async () => {
  const entity = makeEntity('dinesh', { 'ai-agent.io/telemetry-id': 'dinesh' });
  const telemetryProvider: TelemetryProvider = {
    getRuns: async () => [],
    getRunTimeline: async () => [],
  };
  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]), telemetryProvider,
  });
  const { url, close } = await startServer(router);
  try {
    assert.equal((await fetch(`${url}/insights/component%3Adefault%2Fdinesh`)).status, 501);
  } finally {
    await close();
  }
});

test('GET /insights returns 404 without telemetry-id annotation', async () => {
  const entity = makeEntity('dinesh');
  const telemetryProvider: TelemetryProvider = {
    getRuns: async () => [],
    getRunTimeline: async () => [],
    getInsights: async () => ({
      windowHours: 24,
      totals: { runs: 0, running: 0, completed: 0, failed: 0, unknown: 0 },
      durationMs: { p50: 0, p95: 0 },
      histogram: [],
      tools: [],
    }),
  };
  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]), telemetryProvider,
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/insights/component%3Adefault%2Fdinesh`);
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});

test('GET /insights returns 502 when provider throws', async () => {
  const entity = makeEntity('dinesh', { 'ai-agent.io/telemetry-id': 'dinesh' });
  const telemetryProvider: TelemetryProvider = {
    getRuns: async () => [],
    getRunTimeline: async () => [],
    getInsights: async () => {
      throw new Error('provider error');
    },
  };
  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]), telemetryProvider,
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/insights/component%3Adefault%2Fdinesh`);
    assert.equal(res.status, 502);
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
    // Structured contract: a thread + explicit dry-run default + tags.
    assert.ok(body.threadId);
    assert.equal(requests[0].threadId, body.threadId);
    assert.equal(requests[0].sessionId, body.sessionId);
    assert.equal(requests[0].args.post, false);
    assert.equal(body.post, false);
    assert.ok(requests[0].tags.includes('channel:backstage'));
    assert.ok(requests[0].tags.includes(`session:${body.threadId}`));

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

test('POST /invocations maps action=post to post=true and reuses a thread', async () => {
  const entity = makeEntity('dinesh', {
    'ai-agent.io/prompt-template': 'Review MR !{target} in project {project}',
  });
  const requests: any[] = [];
  const invoker = {
    invoke: async (req: any) => {
      requests.push(req);
      return { responseText: 'review', latencyMs: 1 };
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
    const res = await fetch(`${url}/invocations/component%3Adefault%2Fdinesh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: { target: '42', project: 'innovation/ces-ai-agents', action: 'post' },
        threadId: 'thread-abc',
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(requests[0].threadId, 'thread-abc');
    assert.equal(requests[0].args.post, true);
    assert.equal(requests[0].args.target, '42');
    assert.equal(requests[0].args.project, 'innovation/ces-ai-agents');
    // The prompt is still rendered from the template.
    assert.equal(requests[0].prompt, 'Review MR !42 in project innovation/ces-ai-agents');
  } finally {
    await close();
  }
});

test('POST /invocations defaults action to dry-run (post=false)', async () => {
  const entity = makeEntity('dinesh', {});
  const requests: any[] = [];
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    invokers: new Map([
      [
        'bedrock-agentcore',
        {
          invoke: async (req: any) => {
            requests.push(req);
            return { responseText: 'x', latencyMs: 1 };
          },
        },
      ],
    ]),
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/invocations/component%3Adefault%2Fdinesh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: { action: 'dry-run' } }),
    });
    assert.equal(res.status, 200);
    assert.equal(requests[0].args.post, false);
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

// --- Avatar proxy ---

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function stubUrlReader(png?: Buffer, etag?: string) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    readUrl: async () => {
      calls++;
      if (!png) {
        const err: any = new Error('upstream 404');
        err.status = 404;
        throw err;
      }
      return {
        buffer: async () => png,
        etag,
      };
    },
  };
}

test('GET /avatar 404s when the proxy is disabled', async () => {
  const entity = makeEntity('triage', { 'ai-agent.io/avatar': 'https://git.example.com/a.png' });
  const router = await createRouter({
    config: makeConfig({ 'avatarProxy.enabled': true, 'avatarProxy.allowlist': ['https://git.example.com*'] }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    // no urlReader → proxy off regardless of config
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/avatar/${encodeURIComponent("component:default/triage")}`);
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});

test('GET /avatar 404s for missing, data:, and relative avatars', async () => {
  const noAvatar = makeEntity('no-avatar');
  const dataAvatar = makeEntity('data-avatar', { 'ai-agent.io/avatar': 'data:image/png;base64,AAAA' });
  const relAvatar = makeEntity('rel-avatar', { 'ai-agent.io/avatar': '/img/a.png' });
  const router = await createRouter({
    config: makeConfig({ 'avatarProxy.enabled': true }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([noAvatar, dataAvatar, relAvatar]),
    avatarProxy: { urlReader: stubUrlReader(PNG) },
  });
  const { url, close } = await startServer(router);
  try {
    for (const ref of ['no-avatar', 'data-avatar', 'rel-avatar']) {
      const res = await fetch(`${url}/avatar/${encodeURIComponent(`component:default/${ref}`)}`);
      assert.equal(res.status, 404, ref);
    }
  } finally {
    await close();
  }
});

test('GET /avatar 302s to URLs outside the allowlist', async () => {
  const entity = makeEntity('triage', { 'ai-agent.io/avatar': 'https://public.example.com/a.png' });
  const router = await createRouter({
    config: makeConfig({ 'avatarProxy.enabled': true, 'avatarProxy.allowlist': ['https://git.example.com*'] }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    avatarProxy: { urlReader: stubUrlReader(PNG) },
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/avatar/${encodeURIComponent("component:default/triage")}`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://public.example.com/a.png');
  } finally {
    await close();
  }
});

test('GET /avatar serves cached images and fetches upstream once', async () => {
  const entity = makeEntity('triage', { 'ai-agent.io/avatar': 'https://git.example.com/a.png' });
  const urlReader = stubUrlReader(PNG, 'etag-1');
  const router = await createRouter({
    config: makeConfig({ 'avatarProxy.enabled': true, 'avatarProxy.allowlist': ['https://git.example.com*'] }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    avatarProxy: { urlReader },
  });
  const { url, close } = await startServer(router);
  try {
    const res1 = await fetch(`${url}/avatar/${encodeURIComponent("component:default/triage")}`);
    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get('content-type'), 'image/png');
    assert.match(res1.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.equal(res1.headers.get('x-content-type-options'), 'nosniff');
    const bytes = Buffer.from(await res1.arrayBuffer());
    assert.equal(bytes.subarray(0, 4).toString('hex'), PNG.subarray(0, 4).toString('hex'));

    const res2 = await fetch(`${url}/avatar/${encodeURIComponent("component:default/triage")}`);
    assert.equal(res2.status, 200);
    assert.equal(urlReader.calls, 1, 'second request must be served from cache');
  } finally {
    await close();
  }
});

test('GET /avatar negative-caches failed fetches and 302s', async () => {
  const entity = makeEntity('triage', { 'ai-agent.io/avatar': 'https://git.example.com/missing.png' });
  const urlReader = stubUrlReader(undefined);
  const router = await createRouter({
    config: makeConfig({ 'avatarProxy.enabled': true, 'avatarProxy.allowlist': ['https://git.example.com*'] }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    avatarProxy: { urlReader },
  });
  const { url, close } = await startServer(router);
  try {
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${url}/avatar/${encodeURIComponent("component:default/triage")}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), 'https://git.example.com/missing.png');
    }
    assert.equal(urlReader.calls, 1, 'negative cache must prevent refetching');
  } finally {
    await close();
  }
});

test('GET /avatar rewrites GitLab /-/raw/ URLs to /-/blob/ for the reader', async () => {
  const entity = makeEntity('triage', { 'ai-agent.io/avatar': 'https://git.example.com/r/-/raw/main/a.png' });
  const seen: string[] = [];
  const router = await createRouter({
    config: makeConfig({ 'avatarProxy.enabled': true, 'avatarProxy.allowlist': ['https://git.example.com*'] }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    avatarProxy: {
      urlReader: {
        readUrl: async (u: string) => {
          seen.push(u);
          return { buffer: async () => PNG };
        },
      },
    },
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/avatar/${encodeURIComponent("component:default/triage")}`);
    assert.equal(res.status, 200);
    assert.deepEqual(seen, ['https://git.example.com/r/-/blob/main/a.png']);
  } finally {
    await close();
  }
});

test('GET /avatar strips ?token= credentials before calling the reader', async () => {
  const entity = makeEntity('triage', {
    'ai-agent.io/avatar': 'https://git.example.com/r/-/raw/main/a.jpeg?token=SECRET&ref_type=heads',
  });
  const seen: string[] = [];
  const router = await createRouter({
    config: makeConfig({ 'avatarProxy.enabled': true, 'avatarProxy.allowlist': ['https://git.example.com*'] }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    avatarProxy: {
      urlReader: {
        readUrl: async (u: string) => {
          seen.push(u);
          return { buffer: async () => PNG };
        },
      },
    },
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/avatar/${encodeURIComponent("component:default/triage")}`);
    assert.equal(res.status, 200);
    assert.deepEqual(seen, ['https://git.example.com/r/-/blob/main/a.jpeg?ref_type=heads']);
  } finally {
    await close();
  }
});

test('GET /avatar 302s when upstream is not an image', async () => {
  const entity = makeEntity('triage', { 'ai-agent.io/avatar': 'https://git.example.com/evil' });
  const router = await createRouter({
    config: makeConfig({ 'avatarProxy.enabled': true, 'avatarProxy.allowlist': ['https://git.example.com*'] }),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    avatarProxy: { urlReader: { readUrl: async () => ({ buffer: async () => Buffer.from('<html>hi</html>') }) } },
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/avatar/${encodeURIComponent("component:default/triage")}`, { redirect: 'manual' });
    assert.equal(res.status, 302);
  } finally {
    await close();
  }
});

// --- Activity endpoint tests ---

test('GET /activity returns 501 without a telemetry provider', async () => {
  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([], []),
  });
  const { url, close } = await startServer(router);
  try {
    assert.equal((await fetch(`${url}/activity`)).status, 501);
  } finally {
    await close();
  }
});

test('GET /activity returns only agents with telemetry-id, strips events, and clamps limit', async () => {
  const agent1 = makeEntity('dinesh', { 'ai-agent.io/telemetry-id': 'dinesh' });
  const agent2 = makeEntity('gilfoyle', { 'ai-agent.io/telemetry-id': 'gilfoyle' });
  const noTelemetry = makeEntity('richard');

  const getRuns: any[] = [];
  const telemetryProvider: TelemetryProvider = {
    getRuns: async (telemetryId, limit) => {
      getRuns.push({ telemetryId, limit });
      return [
        { runId: 'run-1', agent: telemetryId, state: 'completed', startedAt: '2026-10-03T10:00:00Z', events: [{ seq: 1, name: 'step1', event: 'start' }] },
      ];
    },
    getRunTimeline: async () => [],
  };

  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([], [agent1, agent2, noTelemetry]), telemetryProvider,
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/activity?limit=999`);
    assert.equal(res.status, 200);
    const body = await res.json();

    // Only 2 agents with telemetry-id
    assert.equal(body.length, 2);

    // Runs have no events field
    for (const activity of body) {
      assert.ok(activity.runs);
      for (const run of activity.runs) {
        assert.equal(run.events, undefined);
        assert.ok(run.runId);
      }
    }

    // Limit was clamped to 30
    assert.deepEqual(getRuns, [
      { telemetryId: 'dinesh', limit: 30 },
      { telemetryId: 'gilfoyle', limit: 30 },
    ]);
  } finally {
    await close();
  }
});

test('GET /activity handles one agent failure gracefully', async () => {
  const agent1 = makeEntity('dinesh', { 'ai-agent.io/telemetry-id': 'dinesh' });
  const agent2 = makeEntity('gilfoyle', { 'ai-agent.io/telemetry-id': 'gilfoyle' });

  const errors: string[] = [];
  const errorLogger = { ...noopLogger, error: (msg: string) => errors.push(msg) };

  const telemetryProvider: TelemetryProvider = {
    getRuns: async (telemetryId) => {
      if (telemetryId === 'gilfoyle') throw new Error('backend down');
      return [{ runId: 'run-1', agent: telemetryId, state: 'completed' }];
    },
    getRunTimeline: async () => [],
  };

  const router = await createRouter({
    config: makeConfig(), logger: errorLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([], [agent1, agent2]), telemetryProvider,
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/activity`);
    assert.equal(res.status, 200);
    const body = await res.json();

    // Both agents returned
    assert.equal(body.length, 2);

    // dinesh succeeded
    const dinesh = body.find((a: any) => a.telemetryId === 'dinesh');
    assert.ok(dinesh);
    assert.equal(dinesh.runs.length, 1);
    assert.equal(dinesh.error, undefined);

    // gilfoyle failed
    const gilfoyle = body.find((a: any) => a.telemetryId === 'gilfoyle');
    assert.ok(gilfoyle);
    assert.equal(gilfoyle.runs.length, 0);
    assert.equal(gilfoyle.error, 'telemetry query failed');

    // Error was logged
    assert.equal(errors.length, 1);
    assert.match(errors[0], /component:default\/gilfoyle/);
  } finally {
    await close();
  }
});

test('GET /activity sorts with running agents first, then by most recent startedAt, then by title', async () => {
  const agent1 = makeEntity('alice', { 'ai-agent.io/telemetry-id': 'alice' });
  const agent2 = makeEntity('bob', { 'ai-agent.io/telemetry-id': 'bob' });
  const agent3 = makeEntity('charlie', { 'ai-agent.io/telemetry-id': 'charlie' });

  const telemetryProvider: TelemetryProvider = {
    getRuns: async (telemetryId) => {
      if (telemetryId === 'alice') {
        return [
          { runId: 'run-1', agent: telemetryId, state: 'completed', startedAt: '2026-10-03T12:00:00Z' },
        ];
      }
      if (telemetryId === 'bob') {
        return [
          { runId: 'run-2', agent: telemetryId, state: 'running', startedAt: '2026-10-03T10:00:00Z' },
        ];
      }
      // charlie
      return [
        { runId: 'run-3', agent: telemetryId, state: 'completed', startedAt: '2026-10-03T11:00:00Z' },
      ];
    },
    getRunTimeline: async () => [],
  };

  const router = await createRouter({
    config: makeConfig(), logger: noopLogger, auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([], [agent1, agent2, agent3]), telemetryProvider,
  });
  const { url, close } = await startServer(router);
  try {
    const res = await fetch(`${url}/activity`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.length, 3);

    // bob (running) first
    assert.equal(body[0].telemetryId, 'bob');
    assert.equal(body[0].runs[0].state, 'running');

    // alice (most recent startedAt) second
    assert.equal(body[1].telemetryId, 'alice');

    // charlie (older startedAt) third
    assert.equal(body[2].telemetryId, 'charlie');
  } finally {
    await close();
  }
});

test('catalog calls for /activity and /runs carry the plugin service token', async () => {
  const entity = makeEntity('dinesh', { 'ai-agent.io/telemetry-id': 'dinesh' });
  const tokens: Array<string | undefined> = [];
  const catalogClient = {
    getEntitiesByRefs: async (_r: { entityRefs: string[] }, o?: { token: string }) => {
      tokens.push(o?.token);
      return { items: [entity] };
    },
    getEntities: async (_r: unknown, o?: { token: string }) => {
      tokens.push(o?.token);
      return { items: [entity] };
    },
  };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient,
    telemetryProvider: { getRuns: async () => [], getRunTimeline: async () => [] },
  });
  const { url, close } = await startServer(router);
  try {
    await fetch(`${url}/activity`);
    await fetch(`${url}/runs/${encodeURIComponent('component:default/dinesh')}`);
    assert.deepEqual(tokens, ['tok', 'tok']);
  } finally {
    await close();
  }
});

test('catalog calls run on behalf of the calling user when httpAuth is wired', async () => {
  const entity = makeEntity('dinesh', { 'ai-agent.io/telemetry-id': 'dinesh' });
  const onBehalfOf: unknown[] = [];
  const auth = {
    getPluginRequestToken: async (o: { onBehalfOf: unknown }) => {
      onBehalfOf.push(o.onBehalfOf);
      return { token: 'user-tok' };
    },
    getOwnServiceCredentials: async () => ({ principal: { type: 'service' } }),
  } as any;
  const userCreds = { principal: { type: 'user', userEntityRef: 'user:default/alice' } };
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth,
    httpAuth: { credentials: async () => userCreds } as any,
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity], [entity]),
    telemetryProvider: { getRuns: async () => [], getRunTimeline: async () => [] },
  });
  const { url, close } = await startServer(router);
  try {
    await fetch(`${url}/activity`);
    await fetch(`${url}/runs/${encodeURIComponent('component:default/dinesh')}`);
    assert.deepEqual(onBehalfOf, [userCreds, userCreds]);
  } finally {
    await close();
  }
});

test('GET /runs answers 502 instead of hanging when the catalog read fails', async () => {
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: {
      getEntitiesByRefs: async () => {
        throw new Error('catalog down');
      },
    },
    telemetryProvider: { getRuns: async () => [], getRunTimeline: async () => [], getInsights: async () => ({}) as any },
  });
  const { url, close } = await startServer(router);
  try {
    const ref = encodeURIComponent('component:default/dinesh');
    for (const path of [`/runs/${ref}`, `/runs/${ref}/r1`, `/insights/${ref}`]) {
      const res = await fetch(`${url}${path}`);
      assert.equal(res.status, 502, path);
    }
  } finally {
    await close();
  }
});

test('POST /invocations drops non-string form values', async () => {
  const entity = makeEntity('triage', { 'ai-agent.io/runtime': 'kagent' });
  const requests: any[] = [];
  const router = await createRouter({
    config: makeConfig(),
    logger: noopLogger,
    auth: stubAuth(),
    discovery: { getBaseUrl: async () => 'http://x' } as any,
    catalogClient: stubCatalog([entity]),
    invokers: new Map([
      [
        'kagent',
        {
          invoke: async (req: any) => {
            requests.push(req);
            return { responseText: 'ok', latencyMs: 1 };
          },
        },
      ],
    ]),
  });
  const { url, close } = await startServer(router);
  try {
    for (const values of [null, ['a'], { issue: 'X-1', nested: { a: 1 }, n: 3 }]) {
      const res = await fetch(`${url}/invocations/component%3Adefault%2Ftriage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      assert.equal(res.status, 200);
    }
    assert.deepEqual(requests.map(r => r.fields), [{}, {}, { issue: 'X-1' }]);
  } finally {
    await close();
  }
});
