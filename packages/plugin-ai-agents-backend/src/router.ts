import express, { Router, Request, Response } from 'express';
import { Config } from '@backstage/config';
import {
  AuthService,
  DiscoveryService,
  HttpAuthService,
  LoggerService,
  DatabaseService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import type {
  Permission,
  ResourcePermission,
} from '@backstage/plugin-permission-common';
import {
  aiAgentInvokePermission,
  aiAgentHistoryReadPermission,
} from './permissions';
import {
  AI_AGENT_TYPE,
  AgentActivity,
  AgentInvocationRequest,
  AgentInvoker,
  AgentStatus,
  ProbeConfig,
  ProbeFn,
  ReviewRecord,
  ReviewsSummary,
  TelemetryProvider,
} from './types';
import {
  buildProbeFn,
  isAllowed,
  mapProbeResult,
  readProbeConfig,
} from './client';
import {
  readAvatarProxyConfig,
  resolveAvatar,
  createCacheStore,
  createLocalStore,
} from './avatar';
import { InvocationStore, ReviewStore } from './store';
import {
  annotation,
  buildInvocationArgs,
  buildInvocationTags,
  buildPrompt,
  makeThreadId,
  normalizeSessionId,
} from './invocation';
import {
  aggregateSpend,
  buildSpendReader,
  spendTagMatcher,
  spendWindow,
} from './spend';

const MAX_STATUS_REFS = 200;
const MAX_CACHE_ENTRIES = 2000;
const MAX_PROMPT_CHARS = 20000;
const MAX_VALUES_KEYS = 50;
const THREAD_ID_RE = /^[A-Za-z0-9_.:/+=-]{1,128}$/;

/** @public */
export interface RouterOptions {
  config: Config;
  logger: LoggerService;
  auth: AuthService;
  discovery: DiscoveryService;
  /** Optional database service; required for invocation history. */
  database?: DatabaseService;
  /**
   * Authenticated user resolution for invocation audit records. Without it
   * (and `permissions`) guarded routes deny all requests.
   */
  httpAuth?: HttpAuthService;
  /**
   * Optional permissions service for authorization checks. Without it
   * guarded routes deny all requests.
   */
  permissions?: PermissionsService;
  /** Invokers registered by provider modules (e.g. agentcore, kagent), keyed by runtime. */
  invokers?: Map<string, AgentInvoker>;
  /** Optional server-side OTel-store adapter for live run timelines. */
  telemetryProvider?: TelemetryProvider;
  /** Override the probe function (tests). Defaults to fetch-based. */
  probe?: ProbeFn;
  /** Override the catalog client (tests). Defaults to one built from discovery. */
  catalogClient?: {
    getEntitiesByRefs: (r: {
      entityRefs: string[];
    }) => Promise<{ items: (Entity | undefined)[] }>;
    getEntities?: (
      r: { filter: Record<string, string> },
      o?: { token: string },
    ) => Promise<{ items: Entity[] }>;
  };
  /** Override the reviews store (tests). Defaults to one built from database. */
  reviews?: {
    insert(rec: ReviewRecord): Promise<number>;
    summaryFor(ref: string, limit?: number): Promise<ReviewsSummary>;
  };
  /** Override max cache entries (tests). Defaults to MAX_CACHE_ENTRIES. */
  maxCacheEntries?: number;
  /** Override the LiteLLM spend reader (tests). Defaults to one from config. */
  spendReader?: import('./spend').SpendReader;
  /**
   * Avatar proxy services. `urlReader` fetches through the integrations'
   * credentials; `cache` persists avatars across processes. Both optional —
   * without them the route redirects to the original URL.
   */
  avatarProxy?: {
    urlReader?: Pick<
      import('@backstage/backend-plugin-api').UrlReaderService,
      'readUrl'
    >;
    cache?: import('@backstage/backend-plugin-api').CacheService;
  };
}

interface CachedStatus {
  status: AgentStatus;
  expiresAt: number;
}

function probeUrlFor(entity: Entity): string | undefined {
  return annotation(entity, 'health') ?? annotation(entity, 'endpoint');
}

/**
 * Picks the invoker for an entity: the one registered under its
 * `ai-agent.io/runtime` annotation, or — when the entity declares no
 * runtime and exactly one module is installed — that single invoker, so
 * single-runtime setups keep working without the annotation.
 */
function resolveInvoker(
  invokers: Map<string, AgentInvoker> | undefined,
  entity: Entity,
): { invoker?: AgentInvoker; runtime?: string } {
  if (!invokers || invokers.size === 0) return {};
  const runtime = annotation(entity, 'runtime');
  if (runtime) return { invoker: invokers.get(runtime), runtime };
  if (invokers.size === 1) return { invoker: invokers.values().next().value };
  return {};
}

/** @public */
export async function createRouter(options: RouterOptions): Promise<Router> {
  const {
    config,
    logger,
    auth,
    discovery,
    probe: probeOverride,
    invokers,
    telemetryProvider,
    httpAuth,
    permissions,
  } = options;
  const cfg: ProbeConfig = readProbeConfig(config);
  const probe = probeOverride ?? buildProbeFn(fetch);
  const invocationsEnabled =
    config.getOptionalBoolean('ai-agents.invocations.enabled') ?? true;
  const maxCacheEntries = options.maxCacheEntries ?? MAX_CACHE_ENTRIES;

  if (!permissions || !httpAuth) {
    logger.warn(
      'permissions service not wired — guarded ai-agents routes (invocations, history, reviews) deny all requests',
    );
  }

  const store = options.database
    ? await InvocationStore.create(await options.database.getClient())
    : undefined;

  let reviews = options.reviews;
  if (!reviews && options.database) {
    reviews = await ReviewStore.create(await options.database.getClient());
  }

  // Spend attribution is optional: it reads the LiteLLM proxy configured
  // under `litellm`. Without that config the route answers 501.
  const spendReader = options.spendReader ?? buildSpendReader(config);

  // Avatar proxy: fetches agent avatars through the integrations' credentials
  // (e.g. the GitLab token) and caches them, so private-repo images render.
  const avatarCfg = readAvatarProxyConfig(config);
  if (avatarCfg.enabled && options.avatarProxy?.urlReader) {
    logger.info(
      avatarCfg.allowlist.length
        ? `avatar proxy enabled for ${avatarCfg.allowlist.join(', ')}`
        : 'avatar proxy has no allowlist and no integrations: avatars load directly',
    );
  }
  const avatarProxy = {
    config: avatarCfg,
    urlReader: options.avatarProxy?.urlReader,
    store: options.avatarProxy?.cache
      ? createCacheStore(options.avatarProxy.cache)
      : createLocalStore(),
    logger,
  };

  const cache = new Map<string, CachedStatus>();

  function localCacheSet(
    ref: string,
    status: AgentStatus,
    expiresAt: number,
  ): void {
    if (cache.size >= maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    cache.set(ref, { status, expiresAt });
  }

  const catalogClient =
    options.catalogClient ?? new CatalogClient({ discoveryApi: discovery });

  const router = Router();
  router.use(express.json());

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', enabled: cfg.enabled });
  });

  router.get('/activity', async (req: Request, res: Response) => {
    if (!telemetryProvider) {
      res.status(501).json({ error: 'telemetry not configured' });
      return;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);

    try {
      const agents = (await listAgentEntities(req)).flatMap(entity => {
        const telemetryId = annotation(entity, 'telemetry-id');
        return telemetryId
          ? [
              {
                entityRef: stringifyEntityRef(entity),
                telemetryId,
                title: entity.metadata.title ?? entity.metadata.name,
                avatarUrl: annotation(entity, 'avatar'),
              },
            ]
          : [];
      });

      // Bounded fan-out so a large fleet doesn't flood the telemetry backend.
      const CONCURRENCY = 8;
      const activities: AgentActivity[] = [];
      for (let i = 0; i < agents.length; i += CONCURRENCY) {
        const chunk = agents.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          chunk.map(agent =>
            telemetryProvider.getRuns(agent.telemetryId, limit),
          ),
        );
        results.forEach((result, j) => {
          const agent = chunk[j];
          if (result.status === 'fulfilled') {
            activities.push({
              ...agent,
              runs: result.value.map(({ events: _events, ...run }) => run),
            });
          } else {
            logger.error(
              `Failed to fetch runs for ${agent.entityRef}: ${result.reason?.message ?? result.reason}`,
            );
            activities.push({
              ...agent,
              runs: [],
              error: 'telemetry query failed',
            });
          }
        });
      }

      // Running agents first, then most recent run, then title.
      const hasRunning = (a: AgentActivity) =>
        a.runs.some(r => r.state === 'running');
      const lastStart = (a: AgentActivity) =>
        a.runs[0]?.startedAt ? Date.parse(a.runs[0].startedAt) : 0;
      activities.sort(
        (a, b) =>
          Number(hasRunning(b)) - Number(hasRunning(a)) ||
          lastStart(b) - lastStart(a) ||
          (a.title ?? '').localeCompare(b.title ?? ''),
      );

      res.json(activities);
    } catch (err: any) {
      logger.error('Failed to fetch fleet activity', err);
      res.status(500).json({ error: 'failed to fetch activity' });
    }
  });

  /**
   * Catalog reads run on behalf of the caller, so the catalog's own read
   * permissions decide which agents a user can probe, invoke or inspect.
   */
  async function catalogToken(req: Request): Promise<string> {
    const onBehalfOf = httpAuth
      ? await httpAuth.credentials(req)
      : await auth.getOwnServiceCredentials();
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf,
      targetPluginId: 'catalog',
    });
    return token;
  }

  async function resolveEntities(
    req: Request,
    refs: string[],
  ): Promise<{ items: (Entity | undefined)[] }> {
    return catalogClient.getEntitiesByRefs(
      { entityRefs: refs },
      { token: await catalogToken(req) },
    );
  }

  async function resolveAgent(
    req: Request,
    ref: string,
  ): Promise<Entity | undefined> {
    const [entity] = (await resolveEntities(req, [ref])).items;
    return entity?.spec?.type === AI_AGENT_TYPE ? entity : undefined;
  }

  async function listAgentEntities(req: Request): Promise<Entity[]> {
    if (!catalogClient.getEntities)
      throw new Error('catalog client cannot list entities');
    const { items } = await catalogClient.getEntities(
      { filter: { 'spec.type': AI_AGENT_TYPE } },
      { token: await catalogToken(req) },
    );
    return items;
  }

  async function probeAndCache(
    ref: string,
    entity: Entity | undefined,
  ): Promise<AgentStatus | undefined> {
    if (!entity || entity.spec?.type !== AI_AGENT_TYPE) return undefined;
    const now = Date.now();
    const cached = cache.get(ref);
    if (cached && cached.expiresAt > now) return cached.status;
    const url = probeUrlFor(entity);
    if (!url || !isAllowed(url, cfg.probeAllowlist)) {
      const status: AgentStatus = {
        state: 'unknown',
        lastChecked: new Date().toISOString(),
      };
      localCacheSet(ref, status, now + cfg.statusCacheTtlMs);
      return status;
    }
    try {
      const result = await probe(url, {
        timeoutMs: cfg.probeTimeoutMs,
        authHeader: cfg.probeAuthHeader,
      });
      const status = mapProbeResult(result);
      localCacheSet(ref, status, now + cfg.statusCacheTtlMs);
      return status;
    } catch (err: any) {
      const status = mapProbeResult({ error: err?.message ?? 'probe failed' });
      localCacheSet(ref, status, now + cfg.statusCacheTtlMs);
      return status;
    }
  }

  router.get('/statuses', async (req: Request, res: Response) => {
    if (!cfg.enabled) {
      res.json({});
      return;
    }
    const refsParam = (req.query.refs as string | undefined) ?? '';
    const refs = refsParameterSplit(refsParam);
    if (!refs.length) {
      res.json({});
      return;
    }
    if (refs.length > MAX_STATUS_REFS) {
      res.status(400).json({ error: `too many refs (max ${MAX_STATUS_REFS})` });
      return;
    }
    try {
      const { items } = await resolveEntities(req, refs);
      const out: Record<string, AgentStatus> = {};
      // Bounded fan-out so a large ref list doesn't fire all probes at once.
      const CONCURRENCY = 8;
      for (let i = 0; i < items.length; i += CONCURRENCY) {
        const chunk = items.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (entity, j) => {
            const ref = refs[i + j];
            const status = await probeAndCache(ref, entity);
            if (status) out[ref] = status;
          }),
        );
      }
      res.json(out);
    } catch (err: any) {
      logger.error('Failed to fetch agent statuses', err);
      res.status(500).json({ error: 'failed to fetch agent statuses' });
    }
  });

  router.get('/status/:entityRef', async (req: Request, res: Response) => {
    if (!cfg.enabled) {
      res.json({ state: 'unknown' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    try {
      const entity = await resolveAgent(req, ref);
      if (!entity) {
        res.status(404).json({ error: 'not an ai-agent entity' });
        return;
      }
      const status = await probeAndCache(ref, entity);
      res.json(status ?? { state: 'unknown' });
    } catch (err: any) {
      logger.error('Failed to probe agent', err);
      res.status(500).json({ error: 'failed to probe agent' });
    }
  });

  router.get('/avatar/:entityRef', async (req: Request, res: Response) => {
    // Proxy off (or no UrlReader): the frontend falls back to the direct
    // avatarUrl it already has, so 404 is the cheapest correct answer.
    if (!avatarCfg.enabled || !avatarProxy.urlReader) {
      res.status(404).json({ error: 'avatar proxy disabled' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    try {
      const entity = await resolveAgent(req, ref);
      const url = entity ? annotation(entity, 'avatar') : undefined;
      // Only absolute http(s) URLs are proxied: data: URIs and app-relative
      // paths need no credentials and are fetched by the browser directly.
      if (!url || !/^https?:\/\//i.test(url)) {
        res.status(404).json({ error: 'no proxyable avatar' });
        return;
      }
      // Not on the allowlist: redirect so public URLs keep working exactly
      // as before the proxy existed (browser fetches directly).
      if (!isAllowed(url, avatarCfg.allowlist)) {
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.redirect(302, url);
        return;
      }
      const result = await resolveAvatar(url, avatarProxy);
      if (result.kind === 'redirect') {
        res.setHeader(
          'Cache-Control',
          `private, max-age=${Math.max(60, result.maxAgeSec)}`,
        );
        res.redirect(302, result.location!);
        return;
      }
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', `private, max-age=${result.maxAgeSec}`);
      // Served from the app's origin: an SVG opened directly must not be able
      // to run script, and the browser must not sniff it into something else.
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(result.data);
    } catch (err: any) {
      logger.warn(`avatar route failed for ${ref}: ${err?.message ?? err}`);
      res.status(500).json({ error: 'avatar lookup failed' });
    }
  });

  async function userRef(req: Request): Promise<string | undefined> {
    if (!httpAuth) return undefined;
    try {
      const credentials = await httpAuth.credentials(req, {
        allowLimitedAccess: true,
      });
      const principal = credentials.principal as {
        type: string;
        userEntityRef?: string;
      };
      return principal.type === 'user' ? principal.userEntityRef : undefined;
    } catch (err) {
      logger.warn(
        `Failed to resolve user for invocation audit: ${(err as any)?.message ?? err}`,
      );
      return undefined;
    }
  }

  async function checkPermission(
    req: Request,
    permission: Exclude<Permission, ResourcePermission>,
  ): Promise<boolean> {
    // Fail closed: without the permissions service there is no way to
    // authorize, so guarded routes deny. (Absence is warned at startup.)
    if (!permissions || !httpAuth) return false;
    try {
      const credentials = await httpAuth.credentials(req);
      const [decision] = await permissions.authorize([{ permission }], {
        credentials,
      });
      return decision.result === AuthorizeResult.ALLOW;
    } catch {
      return false;
    }
  }

  router.post('/invocations/:entityRef', async (req, res) => {
    if (!invocationsEnabled) {
      res.status(404).json({ error: 'invocations disabled' });
      return;
    }
    if (!invokers || invokers.size === 0) {
      res.status(501).json({
        error:
          'no invoker registered — install a provider module such as @acarmisc/backstage-plugin-ai-agents-backend-module-agentcore or -module-kagent',
      });
      return;
    }
    if (!(await checkPermission(req, aiAgentInvokePermission))) {
      res.status(403).json({ error: 'not authorized to invoke this agent' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const values = stringFields(req.body?.values);
    // Follow-up turns of a conversation send a free-text prompt directly;
    // without it the prompt is rendered from the entity's template.
    const explicitPrompt =
      typeof req.body?.prompt === 'string' && req.body.prompt.trim()
        ? req.body.prompt
        : undefined;
    // A thread groups the turns of one conversation. Reusing it keeps the
    // AgentCore session alive (multi-turn memory) and gives cost grouping a
    // stable code. A caller that omits it starts a new conversation.
    const threadId =
      typeof req.body?.threadId === 'string' && req.body.threadId
        ? req.body.threadId
        : makeThreadId(ref.split('/').pop() ?? 'agent');
    // Publish confirmation: the UI always dry-runs first, then re-invokes
    // with post=true once the user confirms the result in the conversation.
    const postOverride =
      typeof req.body?.post === 'boolean' ? req.body.post : undefined;

    if (Object.keys(values).length > MAX_VALUES_KEYS) {
      res
        .status(400)
        .json({ error: `too many values (max ${MAX_VALUES_KEYS})` });
      return;
    }
    // `..` is rejected on top of the charset so path-like ids can't
    // traverse (e.g. `../evil`) while entity-ish `a/b:c.d` ids still pass.
    if (!THREAD_ID_RE.test(threadId) || threadId.includes('..')) {
      res.status(400).json({ error: 'invalid threadId' });
      return;
    }
    if (explicitPrompt && explicitPrompt.length > MAX_PROMPT_CHARS) {
      res.status(400).json({ error: 'prompt too large' });
      return;
    }

    try {
      const entity = await resolveAgent(req, ref);
      if (!entity) {
        res.status(404).json({ error: 'not an ai-agent entity' });
        return;
      }

      const prompt = explicitPrompt ?? buildPrompt(entity, values);
      if (prompt.length > MAX_PROMPT_CHARS) {
        res.status(400).json({ error: 'prompt too large' });
        return;
      }

      const { invoker, runtime } = resolveInvoker(invokers, entity);
      if (!invoker) {
        res.status(501).json({
          error: runtime
            ? `no invoker registered for runtime "${runtime}"`
            : 'multiple invoker modules are installed — set the ai-agent.io/runtime annotation to select one',
        });
        return;
      }

      const who = await userRef(req);
      const args = buildInvocationArgs(values, { post: postOverride });
      const request: AgentInvocationRequest = {
        entityRef: ref,
        threadId,
        sessionId: normalizeSessionId(threadId),
        prompt,
        fields: values,
        args,
        tags: buildInvocationTags({ threadId, userRef: who, entityRef: ref }),
        traceUserId: who,
        target: {
          region: annotation(entity, 'region'),
          runtimeHandle: annotation(entity, 'runtime-handle'),
          endpoint: annotation(entity, 'endpoint'),
          namespace: annotation(entity, 'namespace'),
        },
      };

      let responseText: string;
      try {
        const result = await invoker.invoke(request);
        responseText = result.responseText;
        await store?.insert({
          entityRef: ref,
          userRef: who,
          sessionId: request.sessionId,
          threadId,
          prompt: request.prompt,
          status: 'ok',
          post: args.post,
          responseText,
          latencyMs: result.latencyMs || null,
        });
        res.json({
          sessionId: request.sessionId,
          threadId,
          post: args.post,
          responseText,
          latencyMs: result.latencyMs,
        });
      } catch (err: any) {
        const message = err?.message ?? 'invocation failed';
        logger.warn(`Invocation of ${ref} failed: ${message}`);
        await store?.insert({
          entityRef: ref,
          userRef: who,
          sessionId: request.sessionId,
          threadId,
          prompt: request.prompt,
          status: 'error',
          post: args.post,
          errorMessage: message,
        });
        res
          .status(502)
          .json({ error: message, sessionId: request.sessionId, threadId });
      }
    } catch (err: any) {
      logger.error('Failed to resolve agent for invocation', err);
      res.status(500).json({ error: 'failed to resolve agent for invocation' });
    }
  });

  router.get('/invocations/:entityRef', async (req, res) => {
    if (!store) {
      res.status(501).json({ error: 'no database configured' });
      return;
    }
    if (!(await checkPermission(req, aiAgentHistoryReadPermission))) {
      res
        .status(403)
        .json({ error: 'not authorized to read this agent history' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    try {
      res.json(await store.listForEntity(ref, limit));
    } catch (err: any) {
      logger.error('Failed to read invocation history', err);
      res.status(500).json({ error: 'failed to read invocation history' });
    }
  });

  router.get('/invocations/:entityRef/spend', async (req, res) => {
    if (!spendReader) {
      res
        .status(501)
        .json({ error: 'liteLLM is not configured — spend unavailable' });
      return;
    }
    if (!(await checkPermission(req, aiAgentHistoryReadPermission))) {
      res
        .status(403)
        .json({ error: 'not authorized to read this agent history' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const threadId =
      typeof req.query.thread === 'string' && req.query.thread
        ? req.query.thread
        : undefined;
    const window = spendWindow(Number(req.query.days) || undefined);
    try {
      const rows = await spendReader.getSpendLogs({
        ...window,
        page_size: 1000,
      });
      res.json(
        aggregateSpend(rows, spendTagMatcher({ threadId, entityRef: ref })),
      );
    } catch (err: any) {
      logger.warn(`Failed to read LiteLLM spend: ${err?.message ?? err}`);
      res.status(502).json({ error: 'failed to read spend' });
    }
  });

  router.post('/reviews/:entityRef', async (req, res) => {
    if (!reviews) {
      res.status(501).json({ error: 'no database configured' });
      return;
    }
    if (!(await checkPermission(req, aiAgentHistoryReadPermission))) {
      res
        .status(403)
        .json({ error: 'not authorized to read this agent history' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const rating = Number(req.body?.rating);
    const comment =
      typeof req.body?.comment === 'string'
        ? req.body.comment.trim().slice(0, 2000)
        : null;
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      res
        .status(400)
        .json({ error: 'rating must be an integer between 0 and 5' });
      return;
    }
    try {
      const entity = await resolveAgent(req, ref);
      if (!entity) {
        res.status(404).json({ error: 'not an ai-agent entity' });
        return;
      }
      const who = await userRef(req);
      const id = await reviews.insert({
        entityRef: ref,
        userRef: who,
        rating,
        comment: comment || null,
      });
      res.status(201).json({ id });
    } catch (err: any) {
      logger.error('Failed to save agent review', err);
      res.status(500).json({ error: 'failed to save agent review' });
    }
  });

  router.get('/reviews/:entityRef', async (req, res) => {
    if (!reviews) {
      res.status(501).json({ error: 'no database configured' });
      return;
    }
    if (!(await checkPermission(req, aiAgentHistoryReadPermission))) {
      res
        .status(403)
        .json({ error: 'not authorized to read this agent history' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    try {
      res.json(await reviews.summaryFor(ref, limit));
    } catch (err: any) {
      logger.error('Failed to read agent reviews', err);
      res.status(500).json({ error: 'failed to read agent reviews' });
    }
  });

  /** Resolves the agent's telemetry id; undefined when the caller can't see it or it has none. */
  async function telemetryIdFor(req: Request): Promise<string | undefined> {
    const entity = await resolveAgent(
      req,
      decodeURIComponent(req.params.entityRef),
    );
    return entity ? annotation(entity, 'telemetry-id') : undefined;
  }

  router.get('/insights/:entityRef', async (req, res) => {
    if (!telemetryProvider?.getInsights) {
      res.status(501).json({
        error: telemetryProvider
          ? 'insights not supported by the telemetry provider'
          : 'telemetry not configured',
      });
      return;
    }
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 72);
    try {
      const telemetryId = await telemetryIdFor(req);
      if (!telemetryId) {
        res.status(404).json({ error: 'agent telemetry is not configured' });
        return;
      }
      res.json(await telemetryProvider.getInsights(telemetryId, hours));
    } catch (err: any) {
      logger.error('Failed to fetch agent insights', err);
      res.status(502).json({ error: 'telemetry query failed' });
    }
  });

  router.get('/runs/:entityRef', async (req, res) => {
    if (!telemetryProvider) {
      res.status(501).json({ error: 'telemetry not configured' });
      return;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 50);
    try {
      const telemetryId = await telemetryIdFor(req);
      res.json(
        telemetryId ? await telemetryProvider.getRuns(telemetryId, limit) : [],
      );
    } catch (err: any) {
      logger.error('Failed to fetch agent runs', err);
      res.status(502).json({ error: 'telemetry query failed' });
    }
  });

  router.get('/runs/:entityRef/:runId', async (req, res) => {
    if (!telemetryProvider) {
      res.status(501).json({ error: 'telemetry not configured' });
      return;
    }
    try {
      const telemetryId = await telemetryIdFor(req);
      if (!telemetryId) {
        res.status(404).json({ error: 'agent telemetry is not configured' });
        return;
      }
      const events = await telemetryProvider.getRunTimeline(
        telemetryId,
        decodeURIComponent(req.params.runId),
      );
      if (events === null) {
        res.status(404).json({ error: 'run not found' });
        return;
      }
      res.json(events);
    } catch (err: any) {
      logger.error('Failed to fetch agent run timeline', err);
      res.status(502).json({ error: 'telemetry query failed' });
    }
  });

  return router;
}

function refsParameterSplit(param: string): string[] {
  return param
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Form values from the request body; non-string entries are dropped. */
function stringFields(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input).filter(
      (e): e is [string, string] => typeof e[1] === 'string',
    ),
  );
}
