import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { AgentActivity } from '../types';

export interface UseFleetActivityResult {
  data: AgentActivity[] | null;
  error?: Error;
  loading: boolean;
  refresh(): void;
}

export function useFleetActivity(
  pollMs: number = 5000,
  limit: number = 20,
): UseFleetActivityResult {
  const api = useApi(aiAgentsApiRef);
  const [data, setData] = useState<AgentActivity[] | null>(null);
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isMountedRef = useRef(true);
  const currentIntervalRef = useRef(pollMs);
  const errorCountRef = useRef(0);

  const fetchActivity = useCallback(async () => {
    try {
      const result = await api.getActivity(limit);
      if (isMountedRef.current) {
        setData(result);
        setError(undefined);
        setLoading(false);
        errorCountRef.current = 0;
        // Reset interval on success
        currentIntervalRef.current = pollMs;
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        // Back off to 4x interval after error
        errorCountRef.current += 1;
        currentIntervalRef.current = pollMs * 4;
      }
    }
  }, [api, limit, pollMs]);

  // Poll as fetch -> wait -> fetch: requests never overlap and the (possibly
  // backed-off) interval is read after each fetch settles. Nothing is
  // scheduled while the tab is hidden; becoming visible fetches immediately.
  useEffect(() => {
    isMountedRef.current = true;
    const isVisible = () => document.visibilityState !== 'hidden';

    const cycle = async () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      await fetchActivity();
      if (!isMountedRef.current || !isVisible()) return;
      timerRef.current = setTimeout(cycle, currentIntervalRef.current);
    };

    const handleVisibilityChange = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (isMountedRef.current && isVisible()) cycle();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    cycle();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchActivity]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchActivity();
  }, [fetchActivity]);

  return { data, error, loading, refresh };
}
