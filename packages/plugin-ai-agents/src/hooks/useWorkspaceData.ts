import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { AgentRun, AgentInsights, RunEvent } from '../types';
import { usePolling } from './usePolling';

/**
 * Hook to fetch recent runs for an agent with adaptive polling.
 * Polls at 3000ms when any run is `running`, otherwise at 10000ms.
 */
export function useAgentRuns(
  entityRef: string,
  limit = 30,
): {
  data: AgentRun[] | undefined;
  error?: Error;
  loading: boolean;
  refresh(): void;
} {
  const api = useApi(aiAgentsApiRef);

  const { data: runs, error, loading, refresh } = usePolling(
    () => api.getRuns(entityRef, limit),
    {
      intervalMs: (data) => {
        // Poll more frequently if any run is running
        const hasRunning = data?.some(r => r.state === 'running') ?? false;
        return hasRunning ? 3000 : 10000;
      },
      deps: [entityRef, limit],
    },
  );

  return { data: runs, error, loading, refresh };
}

/**
 * Hook to fetch insights for an agent.
 * Polls at 30000ms (30 seconds).
 */
export function useAgentInsights(
  entityRef: string,
  hours = 24,
): {
  data: AgentInsights | null | undefined;
  error?: Error;
  loading: boolean;
  refresh(): void;
} {
  const api = useApi(aiAgentsApiRef);

  const { data: insights, error, loading, refresh } = usePolling(
    () => api.getInsights(entityRef, hours),
    {
      intervalMs: 30000,
      deps: [entityRef, hours],
    },
  );

  return { data: insights, error, loading, refresh };
}

/**
 * Hook to fetch the timeline (events) for a specific run.
 * Polls at 3000ms while running is true, otherwise fetches once.
 * Disabled when runId is undefined.
 */
export function useRunTimeline(
  entityRef: string,
  runId: string | undefined,
  running: boolean,
): {
  data: RunEvent[] | null | undefined;
  error?: Error;
  loading: boolean;
  refresh(): void;
} {
  const api = useApi(aiAgentsApiRef);

  const { data: events, error, loading, refresh } = usePolling(
    () => {
      if (!runId) return Promise.resolve(null);
      return api.getRunTimeline(entityRef, runId);
    },
    {
      intervalMs: running ? 3000 : 30000,
      enabled: !!runId,
      deps: [entityRef, runId, running],
    },
  );

  return { data: events, error, loading, refresh };
}
