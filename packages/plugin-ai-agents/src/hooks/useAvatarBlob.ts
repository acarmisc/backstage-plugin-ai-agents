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

/**
 * Resolves the best `src` for an agent's avatar, safe to call with
 * `undefined` while the entity is still resolving (all hooks run
 * unconditionally, so callers may place it before conditional returns).
 *
 * Absolute http(s) avatar URLs are fetched through the backend proxy
 * (`fetchApi` attaches the Backstage identity token; the backend resolves
 * the image with its integration credentials, e.g. the GitLab token, and
 * caches it) and rendered as a `data:` URL. `data:` URIs and app-relative paths are used directly since
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
  const markFailed = (ref: string) => {
    failedRefs.add(ref);
    setFailureTick(t => t + 1);
  };

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
    api
      .getAvatar(entityRef)
      .then(async blob => {
        if (!blob) {
          if (alive) markFailed(entityRef);
          else failedRefs.add(entityRef);
          return;
        }
        const url = await toDataUrl(blob);
        // Only image types `AgentAvatar` accepts; anything else falls back.
        if (!isSafeUrl(url)) throw new Error('not an image');
        blobUrls.set(entityRef, url);
        if (alive) setBlobSrc(url);
      })
      .catch(() => {
        if (alive) markFailed(entityRef);
        else failedRefs.add(entityRef);
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
