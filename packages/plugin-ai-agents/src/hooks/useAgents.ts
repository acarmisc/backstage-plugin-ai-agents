import { useCallback, useMemo, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useAsyncRetry } from 'react-use';
import { aiAgentsApiRef } from '../api';
import type { AiAgent } from '../types';

export interface AgentFilters {
  search: string;
  runtime: string[];
  capability: string[];
  lifecycle: string[];
  owner: string[];
}

export const initialFilters: AgentFilters = {
  search: '',
  runtime: [],
  capability: [],
  lifecycle: [],
  owner: [],
};

export function applyFilters(
  agents: AiAgent[],
  filters: AgentFilters,
): AiAgent[] {
  const search = filters.search.trim().toLowerCase();
  return agents.filter(a => {
    if (search) {
      const haystack = [a.name, a.title, a.description, a.purpose]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.runtime.length && !filters.runtime.includes(a.runtime.runtime)) {
      return false;
    }
    if (filters.capability.length) {
      const caps = a.capabilities.map(c => c.label);
      if (!filters.capability.every(c => caps.includes(c))) return false;
    }
    if (filters.lifecycle.length && !filters.lifecycle.includes(a.lifecycle ?? '')) {
      return false;
    }
    if (filters.owner.length && !filters.owner.includes(a.owner ?? '')) {
      return false;
    }
    return true;
  });
}

export function useAgents() {
  const api = useApi(aiAgentsApiRef);
  const {
    value: agents,
    loading,
    error,
    retry,
  } = useAsyncRetry(() => api.listAgents(), [api]);

  const [filters, setFilters] = useState<AgentFilters>(initialFilters);

  const filtered = useMemo(
    () => applyFilters(agents ?? [], filters),
    [agents, filters],
  );

  const update = useCallback(
    (patch: Partial<AgentFilters>) =>
      setFilters(prev => ({ ...prev, ...patch })),
    [],
  );

  const reset = useCallback(() => setFilters(initialFilters), []);

  return {
    agents: filtered,
    allAgents: agents ?? [],
    loading,
    error,
    retry,
    filters,
    update,
    reset,
  };
}