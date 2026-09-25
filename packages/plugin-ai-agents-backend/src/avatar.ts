import { createHash } from 'node:crypto';
import type { CacheService, LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { NotModifiedError } from '@backstage/errors';

export interface AvatarProxyConfig {
  /** Kill-switch; false answers 404 and the frontend falls back to direct URLs. */
  enabled: boolean;
  /** Origin allowlist for upstream fetches, same matching as probeAllowlist. */
  allowlist: string[];
  /** How long a successfully fetched avatar may be served from cache. */
  ttlMs: number;
  /** How long a failed fetch is remembered (negative cache) before retrying. */
  negativeTtlMs: number;
  /** Reject avatars larger than this (bytes). */
  maxBytes: number;
}

export function readAvatarProxyConfig(config: import('@backstage/config').Config): AvatarProxyConfig {
  const cfg = config.getOptionalConfig('ai-agents');
  const proxy = cfg?.getOptionalConfig('avatarProxy');
  return {
    enabled: proxy?.getOptionalBoolean('enabled') ?? false,
    allowlist: proxy?.getOptionalStringArray('allowlist') ?? [],
    ttlMs: proxy?.getOptionalNumber('ttlMs') ?? 86_400_000,
    negativeTtlMs: proxy?.getOptionalNumber('negativeTtlMs') ?? 3_600_000,
    maxBytes: proxy?.getOptionalNumber('maxBytes') ?? 524_288,
  };
}

/** One cached avatar: either a fetched image or a negative (failed) marker. */
interface CachedAvatar {
  /** Etag from the upstream provider for conditional revalidation. */
  etag?: string;
  /** Detected image MIME type. */
  contentType: string;
  /** Image bytes, base64-encoded (CacheService values are JSON). */
  data: string;
  /** True when the upstream fetch failed; serve a redirect instead. */
  failed?: boolean;
  /** Absolute epoch ms after which the entry is stale. */
  expiresAt: number;
}

/** Cache-agnostic store so unit tests can run without a CacheService. */
export interface AvatarStore {
  get(key: string): Promise<CachedAvatar | undefined>;
  set(key: string, value: CachedAvatar, ttlMs: number): Promise<void>;
}

/** CacheService-backed store; per-entry TTL controls positive vs negative lifetime. */
export function createCacheStore(cache: CacheService): AvatarStore {
  type JsonValue = Parameters<CacheService['set']>[1];
  return {
    async get(key) {
      return (await cache.get(key)) as CachedAvatar | undefined;
    },
    async set(key, value, ttlMs) {
      await cache.set(key, value as unknown as JsonValue, { ttl: ttlMs });
    },
  };
}

/** In-process fallback (per pod) used when no CacheService is wired. */
export function createLocalStore(): AvatarStore {
  const map = new Map<string, CachedAvatar>();
  return {
    async get(key) {
      const v = map.get(key);
      if (v && v.expiresAt <= Date.now()) {
        map.delete(key);
        return undefined;
      }
      return v;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

/** Best-effort content sniffing; a non-image answer must never be proxied. */
export function sniffImageType(buf: Buffer): string | undefined {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 6 && buf.subarray(0, 3).toString('ascii') === 'GIF') {
    return 'image/gif';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (buf.length >= 2 && buf.subarray(0, 2).toString('ascii') === 'BM') {
    return 'image/bmp';
  }
  const head = buf.subarray(0, 256).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    return 'image/svg+xml';
  }
  return undefined;
}

function cacheKey(url: string): string {
  return `avatar:${createHash('sha256').update(url).digest('hex')}`;
}

export interface AvatarProxyDeps {
  config: AvatarProxyConfig;
  /** Backstage UrlReader: resolves fetches through the integrations' credentials. */
  urlReader?: Pick<UrlReaderService, 'readUrl'>;
  /** Pre-built store (createCacheStore/createLocalStore), owned by the router. */
  store: AvatarStore;
  logger: LoggerService;
}

export type AvatarResolution =
  | { kind: 'ok'; contentType: string; data: Buffer; maxAgeSec: number }
  | { kind: 'redirect'; location?: string; maxAgeSec: number };

/**
 * Fetch (or serve from cache) the image behind `url` using the backend's
 * integrations credentials. Never throws: any failure resolves as a
 * redirect so the browser can try the direct URL (today's behavior).
 */
export async function resolveAvatar(
  url: string,
  deps: AvatarProxyDeps,
): Promise<AvatarResolution> {
  const { config, urlReader, store, logger } = deps;
  const key = cacheKey(url);
  const now = Date.now();

  const cached = await store.get(key).catch(() => undefined);
  if (cached && cached.expiresAt > now) {
    if (cached.failed) {
      return { kind: 'redirect', location: url, maxAgeSec: Math.round((cached.expiresAt - now) / 1000) };
    }
    return {
      kind: 'ok',
      contentType: cached.contentType,
      data: Buffer.from(cached.data, 'base64'),
      maxAgeSec: Math.max(60, Math.round((cached.expiresAt - now) / 1000)),
    };
  }

  if (!urlReader) {
    return { kind: 'redirect', location: url, maxAgeSec: 0 };
  }

  try {
    const response = await urlReader.readUrl(url, { etag: cached?.etag });
    const buf = await response.buffer();
    if (buf.length === 0 || buf.length > config.maxBytes) {
      throw new Error(`avatar size ${buf.length} exceeds limit ${config.maxBytes}`);
    }
    const contentType = sniffImageType(buf);
    if (!contentType) {
      throw new Error('upstream did not return an image');
    }
    const entry: CachedAvatar = {
      etag: response.etag,
      contentType,
      data: buf.toString('base64'),
      expiresAt: now + config.ttlMs,
    };
    await store.set(key, entry, config.ttlMs).catch(err => {
      logger.warn(`avatar cache write failed: ${(err as any)?.message ?? err}`);
    });
    return { kind: 'ok', contentType, data: buf, maxAgeSec: Math.round(config.ttlMs / 1000) };
  } catch (err) {
    // Conditional revalidation hit: the cached copy is still current.
    if (err instanceof NotModifiedError && cached && !cached.failed) {
      const refreshed: CachedAvatar = { ...cached, expiresAt: now + config.ttlMs };
      await store.set(key, refreshed, config.ttlMs).catch(() => {});
      return {
        kind: 'ok',
        contentType: cached.contentType,
        data: Buffer.from(cached.data, 'base64'),
        maxAgeSec: Math.round(config.ttlMs / 1000),
      };
    }
    logger.warn(`avatar fetch failed for ${url}: ${(err as any)?.message ?? err}`);
    const entry: CachedAvatar = { failed: true, contentType: '', data: '', expiresAt: now + config.negativeTtlMs };
    await store.set(key, entry, config.negativeTtlMs).catch(() => {});
    return { kind: 'redirect', location: url, maxAgeSec: 0 };
  }
}
