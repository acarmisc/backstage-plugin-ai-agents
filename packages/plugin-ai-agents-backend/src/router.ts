import express, { Router, Request, Response } from 'express';
import { Config } from '@backstage/config';
import { AuthService, DiscoveryService, HttpAuthService, LoggerService, DatabaseService } from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import {
  AI_AGENT_ANNOTATION_PREFIX,
  AI_AGENT_TYPE,
  AgentInvocationRequest,
  AgentInvoker,
  AgentStatus,
  ProbeConfig,
  ProbeFn,
  ReviewRecord,
  ReviewsSummary,
} from './types';
import { buildProbeFn, isAllowed, mapProbeResult, readProbeConfig } from './client';
import { InvocationStore, ReviewStore } from './store';
import { buildPrompt, makeSessionId } from './invocation';

export interface RouterOptions {
  config: Config;
  logger: LoggerService;
  auth: AuthService;
  discovery: DiscoveryService;
  /** Optional database service; required for invocation history. */
  database?: DatabaseService;
  /** Authenticated user resolution for invocation audit records. */
  httpAuth?: HttpAuthService;
  /** The invoker registered by a provider module (e.g. agentcore). */
  invoker?: AgentInvoker;
  /** Override the probe function (tests). Defaults to fetch-based. */
  probe?: ProbeFn;
  /** Override the catalog client (tests). Defaults to one built from discovery. */
  catalogClient?: { getEntitiesByRefs: (r: { entityRefs: string[] }) => Promise<{ items: (Entity | undefined)[] }> };
  /** Override the reviews store (tests). Defaults to one built from database. */
  reviews?: {
    insert(rec: ReviewRecord): Promise<number>;
    summaryFor(ref: string, limit?: number): Promise<ReviewsSummary>;
  };
}

interface CachedStatus {
  status: AgentStatus;
  expiresAt: number;
}

function annotation(entity: Entity, key: string): string | undefined {
  return entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX}/${key}`];
}

function probeUrlFor(entity: Entity): string | undefined {
  return annotation(entity, 'health') ?? annotation(entity, 'endpoint');
}

export async function createRouter(options: RouterOptions): Promise<Router> {
  const { config, logger, auth, discovery, probe: probeOverride, invoker, httpAuth } = options;
  const cfg: ProbeConfig = readProbeConfig(config);
  const probe = probeOverride ?? buildProbeFn(fetch);
  const invocationsEnabled =
    config.getOptionalBoolean('ai-agents.invocations.enabled') ?? true;

  const store = options.database
    ? await InvocationStore.create(await options.database.getClient())
    : undefined;

  const reviews = options.reviews
    ? options.reviews
    : options.database
      ? await ReviewStore.create(await options.database.getClient())
      : undefined;

  const cache = new Map<string, CachedStatus>();

  const catalogClient =
    options.catalogClient ??
    new CatalogClient({ discoveryApi: discovery });

  const router = Router();
  router.use(express.json());

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', enabled: cfg.enabled });
  });

  async function resolveEntities(refs: string[]): Promise<{ items: (Entity | undefined)[] }> {
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: await auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });
    return catalogClient.getEntitiesByRefs({ entityRefs: refs }, { token });
  }

  async function probeAndCache(ref: string, entity: Entity | undefined): Promise<AgentStatus | undefined> {
    if (!entity || entity.spec?.type !== AI_AGENT_TYPE) return undefined;
    const now = Date.now();
    const cached = cache.get(ref);
    if (cached && cached.expiresAt > now) return cached.status;
    const url = probeUrlFor(entity);
    if (!url || !isAllowed(url, cfg.probeAllowlist)) {
      const status: AgentStatus = { state: 'unknown', lastChecked: new Date().toISOString() };
      cache.set(ref, { status, expiresAt: now + cfg.statusCacheTtlMs });
      return status;
    }
    try {
      const result = await probe(url, {
        timeoutMs: cfg.probeTimeoutMs,
        authHeader: cfg.probeAuthHeader,
      });
      const status = mapProbeResult(result);
      cache.set(ref, { status, expiresAt: now + cfg.statusCacheTtlMs });
      return status;
    } catch (err: any) {
      const status = mapProbeResult({ error: err?.message ?? 'probe failed' });
      cache.set(ref, { status, expiresAt: now + cfg.statusCacheTtlMs });
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
    try {
      const { items } = await resolveEntities(refs);
      const out: Record<string, AgentStatus> = {};
      await Promise.all(
        items.map(async (entity, i) => {
          const ref = refs[i];
          const status = await probeAndCache(ref, entity);
          if (status) out[ref] = status;
        }),
      );
      res.json(out);
    } catch (err: any) {
      logger.error('Failed to fetch agent statuses', err);
      res.status(500).json({ error: err?.message ?? 'unknown error' });
    }
  });

  router.get('/status/:entityRef', async (req: Request, res: Response) => {
    if (!cfg.enabled) {
      res.json({ state: 'unknown' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const now = Date.now();
    const cached = cache.get(ref);
    if (cached && cached.expiresAt > now) {
      res.json(cached.status);
      return;
    }
    try {
      const { items } = await resolveEntities([ref]);
      const entity = items[0];
      if (!entity || entity.spec?.type !== AI_AGENT_TYPE) {
        res.status(404).json({ error: 'not an ai-agent entity' });
        return;
      }
      const status = await probeAndCache(ref, entity);
      res.json(status ?? { state: 'unknown' });
    } catch (err: any) {
      logger.error('Failed to probe agent', err);
      res.status(500).json({ error: err?.message ?? 'unknown error' });
    }
  });

  async function userRef(req: Request): Promise<string | undefined> {
    if (!httpAuth) return undefined;
    try {
      const credentials = await httpAuth.credentials(req, { allowLimitedAccess: true });
      const principal = credentials.principal as { type: string; userEntityRef?: string };
      return principal.type === 'user' ? principal.userEntityRef : undefined;
    } catch {
      return undefined;
    }
  }

  router.post('/invocations/:entityRef', async (req, res) => {
    if (!invocationsEnabled) {
      res.status(404).json({ error: 'invocations disabled' });
      return;
    }
    if (!invoker) {
      res.status(501).json({
        error:
          'no invoker registered — install a provider module such as @acarmisc/backstage-plugin-ai-agents-backend-module-agentcore',
      });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const values: Record<string, string> =
      req.body && typeof req.body.values === 'object' ? req.body.values : {};

    try {
      const { items } = await resolveEntities([ref]);
      const entity = items[0];
      if (!entity || entity.spec?.type !== AI_AGENT_TYPE) {
        res.status(404).json({ error: 'not an ai-agent entity' });
        return;
      }

      const request: AgentInvocationRequest = {
        entityRef: ref,
        sessionId: makeSessionId(entity.metadata.name),
        prompt: buildPrompt(entity, values),
        fields: values,
        target: {
          region: annotation(entity, 'region'),
          runtimeHandle: annotation(entity, 'runtime-handle'),
          endpoint: annotation(entity, 'endpoint'),
        },
      };
      const who = await userRef(req);

      let responseText: string;
      try {
        const result = await invoker.invoke(request);
        responseText = result.responseText;
        await store?.insert({
          entityRef: ref,
          userRef: who,
          sessionId: request.sessionId,
          prompt: request.prompt,
          status: 'ok',
          responseText,
          latencyMs: result.latencyMs || null,
        });
        res.json({
          sessionId: request.sessionId,
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
          prompt: request.prompt,
          status: 'error',
          errorMessage: message,
        });
        res.status(502).json({ error: message, sessionId: request.sessionId });
      }
    } catch (err: any) {
      logger.error('Failed to resolve agent for invocation', err);
      res.status(500).json({ error: err?.message ?? 'unknown error' });
    }
  });

  router.get('/invocations/:entityRef', async (req, res) => {
    if (!store) {
      res.status(501).json({ error: 'no database configured' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    try {
      res.json(await store.listForEntity(ref, limit));
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'unknown error' });
    }
  });

  router.post('/reviews/:entityRef', async (req, res) => {
    if (!reviews) {
      res.status(501).json({ error: 'no database configured' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const rating = Number(req.body?.rating);
    const comment =
      typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 2000) : null;
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      res.status(400).json({ error: 'rating must be an integer between 0 and 5' });
      return;
    }
    try {
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
      res.status(500).json({ error: err?.message ?? 'unknown error' });
    }
  });

  router.get('/reviews/:entityRef', async (req, res) => {
    if (!reviews) {
      res.status(501).json({ error: 'no database configured' });
      return;
    }
    const ref = decodeURIComponent(req.params.entityRef);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    try {
      res.json(await reviews.summaryFor(ref, limit));
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'unknown error' });
    }
  });

  return router;
}

function refsParameterSplit(param: string): string[] {
  return param.split(',').map(s => s.trim()).filter(Boolean);
}