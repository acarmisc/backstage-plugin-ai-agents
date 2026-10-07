import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Grid, Skeleton } from '@backstage/ui';
import { RiRobot2Line, RiSearchLine } from '@remixicon/react';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { AiAgent, AgentStatus } from '../types';
import { useAgents } from '../hooks/useAgents';
import { useFleetActivity } from '../hooks/useFleetActivity';
import { liveByEntityRef } from '../utils/live';
import { AgentFiltersBar } from './AgentFilters';
import { AgentsGrid } from './AgentsGrid';
import { AgentDetailDrawer } from './AgentDetailDrawer';
import { HireAgentDialog } from './HireAgentDialog';
import { EmptyState } from '../ui';

const POLL_INTERVAL_MS = 30_000;

/** @public */
export interface AgentsGalleryProps {
  /**
   * Where the detail drawer's "Open activity" goes for a telemetry id.
   * Defaults to the Activity sub-page of the `/ai-agents` page.
   */
  activityHref?: (telemetryId: string) => string;
}

/**
 * The agent gallery: filters, one card per agent, the detail drawer and the
 * Hire dialog. This is the content of the "Agents" tab.
 *
 * @public
 */
export function AgentsGallery({ activityHref }: AgentsGalleryProps) {
  const api = useApi(aiAgentsApiRef);
  const {
    agents,
    allAgents,
    loading,
    error,
    retry,
    filters,
    update,
    reset,
    groupBy,
    setGroupBy,
  } = useAgents();
  // Same source as the Activity tab; absent (501) means "no telemetry" and
  // the cards show the health probe instead.
  const { data: fleet } = useFleetActivity(15_000, 5);
  const live = liveByEntityRef(fleet);

  const [selected, setSelected] = useState<AiAgent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hireAgent, setHireAgent] = useState<AiAgent | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const [invocationNonce, setInvocationNonce] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});

  const refs = allAgents.map(a => a.entityRef);

  // Initial + on-ref-change status fetch. Polling runs separately below.
  useEffect(() => {
    let cancelled = false;
    if (!refs.length) return undefined;
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
    if (!refs.length) return undefined;
    const id = setInterval(async () => {
      const result = await api.getStatuses(refs);
      setStatuses(prev => ({ ...prev, ...result }));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, refs.join(',')]);

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
      <div aria-busy="true" aria-label="Loading AI agents">
        <Grid.Root
          gap="4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={200} rounded />
          ))}
        </Grid.Root>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        status="danger"
        icon
        title="Failed to load AI agents"
        description={error.message}
        customActions={
          <Button size="small" variant="secondary" onPress={() => retry()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <>
      <AgentFiltersBar
        agents={allAgents}
        filters={filters}
        onChange={update}
        onReset={reset}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />

      {allAgents.length === 0 && (
        <EmptyState
          title="No AI agents registered"
          description="Add a Component with spec.type: ai-agent to the catalog."
          icon={<RiRobot2Line size={40} />}
          action={
            <Button variant="secondary" onPress={() => retry()}>
              Retry
            </Button>
          }
        />
      )}
      {allAgents.length > 0 && agentsWithStatus.length === 0 && (
        <EmptyState
          title="No agents match these filters"
          description="Try loosening or clearing your search and filters."
          icon={<RiSearchLine size={40} />}
          action={
            <Button variant="secondary" onPress={() => reset()}>
              Clear filters
            </Button>
          }
        />
      )}
      {agentsWithStatus.length > 0 && (
        <AgentsGrid
          agents={agentsWithStatus}
          live={live}
          groupBy={groupBy}
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
        historyReloadKey={invocationNonce}
        activityHref={activityHref}
      />

      <HireAgentDialog
        agent={hireAgent}
        open={hireOpen}
        onClose={() => setHireOpen(false)}
        onInvoke={async (values, opts) => {
          const result = await api.invokeAgent(
            hireAgent!.entityRef,
            values,
            opts,
          );
          setInvocationNonce(n => n + 1);
          return result;
        }}
      />
    </>
  );
}
