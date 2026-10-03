import { useCallback, useEffect, useRef, useState } from 'react';

export interface UsePollingResult<T> {
  data: T | undefined;
  error?: Error;
  loading: boolean;
  /** Fetch now (no-op while a request is already in flight). */
  refresh(): void;
}

export interface UsePollingOptions<T> {
  /** Polling interval in ms, or a function of the latest data (re-evaluated after every fetch). */
  intervalMs: number | ((data: T | undefined) => number);
  /** Whether polling is enabled (default true). */
  enabled?: boolean;
  /** Changing any of these restarts polling with an immediate fetch; older responses are ignored. */
  deps?: unknown[];
}

/**
 * Polling hook: fetch -> wait -> fetch, so requests never overlap.
 * - `fetcher` and `intervalMs` may change identity on every render without
 *   restarting the loop (they are read through refs); only `enabled` and
 *   `deps` restart it.
 * - Nothing is scheduled while the tab is hidden; becoming visible fetches
 *   immediately.
 * - After a failed fetch the next delay is 4x; the last good data is kept.
 * - Responses that arrive after unmount or after `deps` changed are ignored.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  opts: UsePollingOptions<T>,
): UsePollingResult<T> {
  const { intervalMs, enabled = true, deps = [] } = opts;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(enabled);

  const fetcherRef = useRef(fetcher);
  const intervalRef = useRef(intervalMs);
  const dataRef = useRef<T>();
  const refreshRef = useRef<() => void>(() => undefined);
  fetcherRef.current = fetcher;
  intervalRef.current = intervalMs;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      refreshRef.current = () => undefined;
      return undefined;
    }

    let alive = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isVisible = () => document.visibilityState !== 'hidden';
    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };

    const run = async () => {
      if (inFlight) return;
      clearTimer();
      inFlight = true;
      let failed = false;
      try {
        const result = await fetcherRef.current();
        if (!alive) return;
        dataRef.current = result;
        setData(result);
        setError(undefined);
      } catch (err) {
        if (!alive) return;
        failed = true;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        inFlight = false;
        if (alive) setLoading(false);
      }
      if (!alive || !isVisible()) return;
      const spec = intervalRef.current;
      const base = typeof spec === 'function' ? spec(dataRef.current) : spec;
      timer = setTimeout(run, failed ? base * 4 : base);
    };

    const onVisibility = () => {
      clearTimer();
      if (isVisible()) run();
    };

    refreshRef.current = () => {
      clearTimer();
      run();
    };
    document.addEventListener('visibilitychange', onVisibility);
    run();

    return () => {
      alive = false;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return { data, error, loading, refresh };
}
