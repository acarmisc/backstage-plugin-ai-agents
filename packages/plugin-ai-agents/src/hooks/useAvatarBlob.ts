import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import { isSafeUrl } from '../types';

/**
 * `data:` URLs of proxied avatars, keyed by entity ref and kept for the
 * lifetime of the page: cards, the overview card, and the detail drawer
 * share one image per agent and never re-request it.
 *
 * `data:` rather than `blob:` object URLs because Backstage's default CSP
 * (`img-src 'self' data:`) blocks `blob:` images, which would make every
 * proxied avatar fall back to initials in a production app.
 */
const blobUrls = new Map<string, string>();

async function toDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const type = (blob.type || 'application/octet-stream').split(';')[0];
  return `data:${type};base64,${btoa(binary)}`;
}

/** Entity refs whose proxy fetch failed this session — never retried. */
const failedRefs = new Set<string>();

/** In-flight proxy requests, so avatars mounted together share one fetch. */
const pending = new Map<string, Promise<string | undefined>>();

/**
 * Fetches one agent's avatar through the proxy and records the outcome in
 * the module caches. Resolves to the `data:` URL, or undefined on failure.
 */
function loadAvatar(
  api: { getAvatar(entityRef: string): Promise<Blob | undefined> },
  entityRef: string,
): Promise<string | undefined> {
  let request = pending.get(entityRef);
  if (!request) {
    request = api
      .getAvatar(entityRef)
      .then(async blob => {
        if (!blob) return undefined;
        const url = await toDataUrl(blob);
        // Only image types `AgentAvatar` accepts; anything else falls back.
        return isSafeUrl(url) ? url : undefined;
      })
      .catch(() => undefined)
      .then(url => {
        if (url) blobUrls.set(entityRef, url);
        else failedRefs.add(entityRef);
        pending.delete(entityRef);
        return url;
      });
    pending.set(entityRef, request);
  }
  return request;
}

/**
 * Resolves the best `src` for an agent's avatar, safe to call with
 * `undefined` while the entity is still resolving (all hooks run
 * unconditionally, so callers may place it before conditional returns).
 *
 * Absolute http(s) avatar URLs are fetched through the backend proxy
 * (`fetchApi` attaches the Backstage identity token; the backend resolves
 * the image with its integration credentials, e.g. the GitLab token, and
 * caches it) and rendered as a `data:` URL; agents mounted together share
 * one request. `data:` URIs and app-relative paths are used directly since
 * they need no credentials. While the proxy request is in flight nothing is
 * returned (the avatar shows its initials) so the browser never hits the
 * upstream host directly — for private repos that request can only fail.
 * Only after the proxy has failed is the original URL returned, so public
 * URLs keep working, and `AgentAvatar`'s own fallback covers the rest.
 */
export function useAvatarSrc(
  entityRef: string | undefined,
  avatarUrl: string | undefined,
): string | undefined {
  const api = useApi(aiAgentsApiRef);
  const direct = avatarUrl && isSafeUrl(avatarUrl) ? avatarUrl : undefined;
  const needsProxy = !!entityRef && !!direct && /^https?:\/\//i.test(direct);
  const [, setBlobSrc] = useState<string | undefined>(() =>
    entityRef ? blobUrls.get(entityRef) : undefined,
  );
  // Bumped when a proxy fetch fails so the hook re-renders and falls back.
  const [, setFailureTick] = useState(0);

  useEffect(() => {
    if (!entityRef || !needsProxy) return undefined;
    // Sync state with the module cache: covers a cache warmed after mount
    // and, crucially, clears a stale blob when this hook instance is reused
    // for a different agent (state initializers don't re-run on prop change).
    // React bails out when the value is unchanged, so this never loops.
    setBlobSrc(blobUrls.get(entityRef));
    if (blobUrls.has(entityRef) || failedRefs.has(entityRef)) {
      return undefined;
    }
    let alive = true;
    loadAvatar(api, entityRef).then(url => {
      if (!alive) return;
      if (url) setBlobSrc(url);
      else setFailureTick(t => t + 1);
    });
    return () => {
      alive = false;
    };
  }, [api, entityRef, needsProxy]);

  if (!needsProxy) return direct;
  // Proxy still pending → no src; proxy failed → direct URL as a last resort.
  return (
    blobUrls.get(entityRef!) ??
    (failedRefs.has(entityRef!) ? direct : undefined)
  );
}
