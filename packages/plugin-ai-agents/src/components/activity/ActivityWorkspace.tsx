import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Flex, Select, Skeleton } from '@backstage/ui';
import { useSearchParams } from 'react-router-dom';
import { useAvatarSrc } from '../../hooks/useAvatarBlob';
import { useFleetActivity } from '../../hooks/useFleetActivity';
import { EmptyState } from '../../ui';
import { AgentRail } from './AgentRail';
import { AgentWorkspacePanel } from './AgentWorkspacePanel';
import { FleetOverview } from './FleetOverview';

const HOURS = [6, 24, 72];
const ALL = '__all__';
const COMPACT_QUERY = '(max-width: 899.95px)';

/** True below the breakpoint where the agent rail no longer fits. */
function useCompact(): boolean {
  const [compact, setCompact] = useState(
    () => window.matchMedia?.(COMPACT_QUERY).matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.(COMPACT_QUERY);
    if (!query) return undefined;
    const onChange = () => setCompact(query.matches);
    onChange();
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);
  return compact;
}

/**
 * Master-detail workspace: agents in a left rail, the selected agent (or the
 * fleet overview) in the body. Selection lives in the URL so views can be
 * shared and the back button works: `agent` (telemetry id), `run`, `hours`.
 * Below 900px the rail becomes a select.
 *
 * @public
 */
export function ActivityWorkspace() {
  const compact = useCompact();
  const [params, setParams] = useSearchParams();
  const { data: fleet, error, loading, refresh } = useFleetActivity(5000, 30);

  const agentParam = params.get('agent') ?? undefined;
  const runParam = params.get('run') ?? undefined;
  const requestedHours = Number(params.get('hours'));
  const hours = HOURS.includes(requestedHours) ? requestedHours : 24;

  const selected = useMemo(
    () =>
      agentParam ? fleet?.find(a => a.telemetryId === agentParam) : undefined,
    [fleet, agentParam],
  );
  const selectedAvatar = useAvatarSrc(selected?.entityRef, selected?.avatarUrl);

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next);
  };
  const selectAgent = (telemetryId: string | undefined) =>
    update(next => {
      next.delete('run');
      if (telemetryId) next.set('agent', telemetryId);
      else next.delete('agent');
    });
  const selectRun = (runId: string | undefined) =>
    update(next => {
      if (runId) next.set('run', runId);
      else next.delete('run');
    });
  const selectFleetRun = (telemetryId: string, runId: string) =>
    update(next => {
      next.set('agent', telemetryId);
      next.set('run', runId);
    });
  const changeHours = (h: number) =>
    update(next => next.set('hours', String(h)));

  if (!fleet && loading) {
    return (
      <div
        aria-busy="true"
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : '300px 1fr',
          gap: 'var(--bui-space-5)',
        }}
      >
        {!compact && <Skeleton height={420} rounded />}
        <Flex direction="column" gap="4">
          <Skeleton height={96} rounded />
          <Skeleton height={160} rounded />
          <Skeleton height={280} rounded />
        </Flex>
      </div>
    );
  }

  if (!fleet) {
    return (
      <Alert
        status="danger"
        title={`Failed to load fleet activity${error ? `: ${error.message}` : ''}`}
        customActions={
          <Button size="small" variant="secondary" onPress={refresh}>
            Retry
          </Button>
        }
      />
    );
  }

  const body = selected ? (
    <AgentWorkspacePanel
      key={selected.telemetryId}
      entityRef={selected.entityRef}
      telemetryId={selected.telemetryId}
      title={selected.title}
      avatarUrl={selectedAvatar}
      selectedRunId={runParam}
      onSelectRun={selectRun}
      hours={hours}
      onHoursChange={changeHours}
    />
  ) : (
    <FleetOverview fleet={fleet} onSelectRun={selectFleetRun} />
  );

  const options = [
    { value: ALL, label: 'All agents' },
    ...[...fleet]
      .sort((a, b) =>
        (a.title ?? a.telemetryId).localeCompare(b.title ?? b.telemetryId),
      )
      .map(a => ({ value: a.telemetryId, label: a.title ?? a.telemetryId })),
  ];

  return (
    <Flex direction="column" gap="4">
      {error && (
        <Alert
          status="warning"
          title="Showing last known data — the latest refresh failed"
        />
      )}
      {fleet.length === 0 ? (
        <EmptyState
          title="No fleet activity"
          description="Agents need the ai-agent.io/telemetry-id annotation and a telemetry module to show activity."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact
              ? 'minmax(0, 1fr)'
              : '300px minmax(0, 1fr)',
            gap: compact ? 'var(--bui-space-4)' : 'var(--bui-space-5)',
            alignItems: 'start',
          }}
        >
          {compact ? (
            <Select
              aria-label="Agent"
              options={options}
              selectedKey={selected?.telemetryId ?? ALL}
              onSelectionChange={key =>
                selectAgent(key === ALL ? undefined : String(key))
              }
            />
          ) : (
            <div
              style={{
                position: 'sticky',
                top: 0,
                maxHeight: 'calc(100vh - 160px)',
                minHeight: 320,
                overflow: 'hidden',
              }}
            >
              <AgentRail
                fleet={fleet}
                selectedTelemetryId={selected?.telemetryId}
                onSelectAgent={selectAgent}
              />
            </div>
          )}
          <div style={{ minWidth: 0 }}>{body}</div>
        </div>
      )}
    </Flex>
  );
}
