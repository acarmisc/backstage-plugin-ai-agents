import React, { useMemo, useState } from 'react';
import { Badge, Flex, List, ListRow, SearchField, Text } from '@backstage/ui';
import { RiAlertLine, RiLayoutGridLine } from '@remixicon/react';
import { useAvatarSrc } from '../../hooks/useAvatarBlob';
import { relativeTime } from '../../utils/formatting';
import { AgentAvatar } from '../AgentAvatar';
import { Hint, TONE_BG, TONE_FG } from '../../ui';
import { StatusDot } from './StatusPill';
import type { AgentActivity, AgentRun } from '../../types';

export interface AgentRailProps {
  /** Fleet data for all agents. */
  fleet: AgentActivity[];
  /** Selected agent telemetryId; undefined selects the fleet overview. */
  selectedTelemetryId?: string;
  onSelectAgent: (telemetryId: string | undefined) => void;
}

/** Key of the "All agents" row. */
const ALL = '__all__';

function secondaryLine(activity: AgentActivity): string {
  const [latest] = activity.runs;
  if (!latest) return 'No runs yet';
  if (latest.state === 'running') return latest.currentActivity ?? 'Running…';
  const when = relativeTime(latest.updatedAt ?? latest.startedAt);
  return `${latest.state === 'failed' ? 'Failed' : 'Idle'} · ${when}`;
}

function aggregateState(activity: AgentActivity): AgentRun['state'] {
  if (activity.runs.some(r => r.state === 'running')) return 'running';
  return activity.runs[0]?.state ?? 'unknown';
}

function RunningChip({ count, label }: { count: number; label?: string }) {
  return (
    <Badge
      data-testid="running-chip"
      size="small"
      style={{
        background: TONE_BG.info,
        color: TONE_FG.info,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {count}
      {label ? ` ${label}` : ''}
    </Badge>
  );
}

function RailStatus({
  activity,
  running,
}: {
  activity: AgentActivity;
  running: number;
}) {
  if (activity.error) {
    return (
      <Hint label="Telemetry unavailable">
        <span
          role="img"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a tooltip trigger must be keyboard focusable
          tabIndex={0}
          aria-label="Telemetry unavailable"
          style={{ display: 'inline-flex', color: 'var(--bui-fg-disabled)' }}
        >
          <RiAlertLine size={18} />
        </span>
      </Hint>
    );
  }
  if (running > 0) return <RunningChip count={running} />;
  return <StatusDot state={aggregateState(activity)} size={8} />;
}

/** Avatar through the backend proxy, like the cards (private-repo images). */
function RailAvatar({
  activity,
  name,
}: {
  activity: AgentActivity;
  name: string;
}) {
  const src = useAvatarSrc(activity.entityRef, activity.avatarUrl);
  return <AgentAvatar name={name} avatarUrl={src} size={28} />;
}

/**
 * Left rail: "All agents" followed by the agents in a STABLE alphabetical
 * order (state changes never reorder it). A BUI list: selection and arrow-key
 * navigation come from the component.
 */
export function AgentRail({
  fleet,
  selectedTelemetryId,
  onSelectAgent,
}: AgentRailProps) {
  const [search, setSearch] = useState('');

  const agents = useMemo(() => {
    const sorted = [...fleet].sort((a, b) =>
      (a.title ?? a.telemetryId).localeCompare(b.title ?? b.telemetryId),
    );
    const q = search.trim().toLowerCase();
    return q
      ? sorted.filter(
          a =>
            (a.title ?? '').toLowerCase().includes(q) ||
            a.telemetryId.toLowerCase().includes(q),
        )
      : sorted;
  }, [fleet, search]);

  const totalRunning = fleet.reduce(
    (n, a) => n + a.runs.filter(r => r.state === 'running').length,
    0,
  );

  return (
    <Flex direction="column" gap="2" p="2" style={{ height: '100%' }}>
      <SearchField
        aria-label="Search agents"
        placeholder="Search agents"
        size="small"
        value={search}
        onChange={setSearch}
      />

      <List
        aria-label="Agents"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selectedTelemetryId ?? ALL]}
        onSelectionChange={keys => {
          const [key] = keys === 'all' ? [] : Array.from(keys);
          if (key === undefined) return;
          onSelectAgent(key === ALL ? undefined : String(key));
        }}
      >
        <ListRow
          id={ALL}
          icon={<RiLayoutGridLine size={18} />}
          description={`${fleet.length} monitored`}
          customActions={
            totalRunning > 0 ? (
              <RunningChip count={totalRunning} label="running" />
            ) : undefined
          }
        >
          All agents
        </ListRow>
        {agents.map(activity => {
          const running = activity.runs.filter(
            r => r.state === 'running',
          ).length;
          const title = activity.title ?? activity.telemetryId;
          return (
            <ListRow
              key={activity.telemetryId}
              id={activity.telemetryId}
              data-testid="rail-item"
              data-telemetry-id={activity.telemetryId}
              textValue={title}
              icon={<RailAvatar activity={activity} name={title} />}
              description={secondaryLine(activity)}
              customActions={
                <RailStatus activity={activity} running={running} />
              }
            >
              {title}
            </ListRow>
          );
        })}
      </List>
      {agents.length === 0 && (
        <Text
          variant="body-small"
          color="secondary"
          as="div"
          style={{ padding: 'var(--bui-space-4)', textAlign: 'center' }}
        >
          {fleet.length === 0
            ? 'No agents with telemetry'
            : 'No agent matches your search'}
        </Text>
      )}
    </Flex>
  );
}
