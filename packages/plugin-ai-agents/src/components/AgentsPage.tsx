import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { EmptyState } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { AiAgent, AgentStatus } from '../types';
import { useAgents } from '../hooks/useAgents';
import { AgentFiltersBar } from './AgentFilters';
import { AgentsGrid } from './AgentsGrid';
import { AgentDetailDrawer } from './AgentDetailDrawer';
import { HireAgentDialog } from './HireAgentDialog';

const POLL_INTERVAL_MS = 30_000;

export const AgentsPage: React.FC = () => {
  const api = useApi(aiAgentsApiRef);
  const { agents, allAgents, loading, error, retry, filters, update, reset } =
    useAgents();

  const [selected, setSelected] = useState<AiAgent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hireAgent, setHireAgent] = useState<AiAgent | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});

  const refs = allAgents.map(a => a.entityRef);

  // Initial + on-ref-change status fetch. Polling runs separately below.
  useEffect(() => {
    let cancelled = false;
    if (!refs.length) return;
    api.getStatuses(refs).then(result => {
      if (!cancelled) setStatuses(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, refs.join(',')]);

  // Best-effort polling for live status while the page is mounted.
  useEffect(() => {
    if (!refs.length) return;
    const id = setInterval(async () => {
      const result = await api.getStatuses(refs);
      setStatuses(prev => ({ ...prev, ...result }));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, refs.length]);

  const agentsWithStatus = agents.map(a => ({
    ...a,
    status: statuses[a.entityRef] ?? a.status,
  }));

  const handleCardClick = useCallback((agent: AiAgent) => {
    setSelected(agent);
    setDrawerOpen(true);
  }, []);

  const handleHire = useCallback((agent: AiAgent) => {
    setHireAgent(agent);
    setHireOpen(true);
  }, []);

  const handleRuntimeClick = useCallback(
    (runtime: string) => {
      if (!filters.runtime.includes(runtime)) {
        update({ runtime: [...filters.runtime, runtime] });
      }
    },
    [filters.runtime, update],
  );

  const handleRefreshStatus = useCallback(
    async (entityRef: string) => {
      const result = await api.getStatuses([entityRef]);
      setStatuses(prev => ({ ...prev, ...result }));
      setSelected(prev =>
        prev && prev.entityRef === entityRef
          ? { ...prev, status: result[entityRef] ?? prev.status }
          : prev,
      );
    },
    [api],
  );

  if (loading && !allAgents.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load AI agents"
        description={error.message}
        missing="content"
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4">AI Agents</Typography>
        <Typography variant="body2" color="text.secondary">
          AI agents registered in the catalog as <code>Component</code> entities
          with <code>spec.type: ai-agent</code>.
        </Typography>
      </Box>

      <AgentFiltersBar
        agents={allAgents}
        filters={filters}
        onChange={update}
        onReset={reset}
      />

      {agentsWithStatus.length === 0 ? (
        <EmptyState
          title="No AI agents registered"
          description="Add a Component with spec.type: ai-agent to the catalog, or adjust your filters."
          missing="content"
          action={<button onClick={() => retry()}>Retry</button>}
        />
      ) : (
        <AgentsGrid
          agents={agentsWithStatus}
          onAgentClick={handleCardClick}
          onRuntimeClick={handleRuntimeClick}
          onHire={handleHire}
        />
      )}

      <AgentDetailDrawer
        agent={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRefreshStatus={handleRefreshStatus}
        onHire={handleHire}
      />

      <HireAgentDialog
        agent={hireAgent}
        open={hireOpen}
        onClose={() => setHireOpen(false)}
      />
    </Box>
  );
};