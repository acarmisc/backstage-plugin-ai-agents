import express, { Router, Request, Response } from 'express';
import { Config } from '@backstage/config';
import { AuthService, DiscoveryService, LoggerService } from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import {
  AI_AGENT_ANNOTATION_PREFIX,
  AI_AGENT_TYPE,
  AgentStatus,
  ProbeConfig,
  ProbeFn,
} from './types';
import { buildProbeFn, isAllowed, mapProbeResult, readProbeConfig } from './client';

export interface RouterOptions {
  config: Config;
  logger: LoggerService;
  auth: AuthService;
  discovery: DiscoveryService;
  /** Override the probe function (tests). Defaults to fetch-based. */
  probe?: ProbeFn;
  /** Override the catalog client (tests). Defaults to one built from discovery. */
  catalogClient?: { getEntitiesByRefs: (r: { entityRefs: string[] }) => Promise<{ items: (Entity | undefined)[] }> };
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
  const { config, logger, auth, discovery, probe: probeOverride } = options;
  const cfg: ProbeConfig = readProbeConfig(config);
  const probe = probeOverride ?? buildProbeFn(fetch);

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

  return router;
}

function refsParameterSplit(param: string): string[] {
  return param.split(',').map(s => s.trim()).filter(Boolean);
}