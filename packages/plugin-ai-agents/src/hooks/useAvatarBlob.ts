import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import { isSafeUrl } from '../types';

/**
 * Object URLs minted from proxied avatar blobs, keyed by entity ref and kept
 * for the lifetime of the page: cards, the overview card, and the detail
 * drawer share one blob per agent and never re-request it.
 */
const blobUrls = new Map<string, string>();

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
 * caches it). `data:` URIs and app-relative paths are used directly since
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
      .then(blob => {
        if (!alive) return;
        if (!blob) {
          markFailed(entityRef);
          return;
        }
        const url = URL.createObjectURL(blob);
        blobUrls.set(entityRef, url);
        setBlobSrc(url);
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
