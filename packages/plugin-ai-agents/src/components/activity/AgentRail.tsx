import React, { useMemo, useState } from 'react';
import { Badge, Flex, SearchField, Text } from '@backstage/ui';
import { RiAlertLine, RiLayoutGridLine } from '@remixicon/react';
import { aggregateState } from '../../utils/live';
import { useAvatarSrc } from '../../hooks/useAvatarBlob';
import { relativeTime } from '../../utils/formatting';
import { AgentAvatar } from '../AgentAvatar';
import { Hint, TONE_BG, TONE_FG } from '../../ui';
import { StatusDot } from './StatusPill';
import type { AgentActivity } from '../../types';

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
          <RiAlertLine size={20} />
        </span>
      </Hint>
    );
  }
  if (running > 0) return <RunningChip count={running} />;
  return <StatusDot state={aggregateState(activity)} size={12} />;
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
  return <AgentAvatar name={name} avatarUrl={src} size={36} />;
}

function RailRow({
  id,
  selected,
  icon,
  title,
  description,
  trailing,
  testId,
  onSelect,
  onKeyDown,
}: {
  id: string;
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  trailing?: React.ReactNode;
  testId?: string;
  onSelect: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <li style={{ listStyle: 'none' }}>
      <button
        type="button"
        data-testid={testId}
        data-telemetry-id={id}
        data-selected={selected ? 'true' : 'false'}
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        style={{
          all: 'unset',
          boxSizing: 'border-box',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--bui-space-3)',
          padding: 'var(--bui-space-2) var(--bui-space-3)',
          borderRadius: 'var(--bui-radius-3)',
          cursor: 'pointer',
          // The selection never changes the row's size or content: only the
          // tint and an inset bar, so nothing moves when you click.
          background: selected ? 'var(--bui-bg-neutral-3)' : 'transparent',
          boxShadow: selected
            ? 'inset 3px 0 0 var(--bui-bg-solid)'
            : 'inset 3px 0 0 transparent',
        }}
        className="ai-agents-rail-row"
      >
        <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <Text
            as="span"
            variant="body-medium"
            weight="bold"
            truncate
            style={{ display: 'block' }}
          >
            {title}
          </Text>
          <Text
            as="span"
            variant="body-small"
            color="secondary"
            truncate
            style={{ display: 'block' }}
          >
            {description}
          </Text>
        </span>
        {trailing && (
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>
            {trailing}
          </span>
        )}
      </button>
    </li>
  );
}

const RAIL_CSS = `
.ai-agents-rail-row:hover { background: var(--bui-bg-neutral-2) !important; }
.ai-agents-rail-row[data-selected='true']:hover { background: var(--bui-bg-neutral-3) !important; }
.ai-agents-rail-row:focus-visible { outline: 2px solid var(--bui-ring); outline-offset: -2px; }
`;

/**
 * Left rail: "All agents" followed by the agents in a STABLE alphabetical
 * order (state changes never reorder it). Plain buttons in a list, with the
 * arrow keys moving focus between them.
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

  const moveFocus = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = Array.from(
      e.currentTarget
        .closest('ul')!
        .querySelectorAll<HTMLElement>('button[data-telemetry-id]'),
    );
    const at = rows.indexOf(document.activeElement as HTMLElement);
    if (at === -1) return;
    e.preventDefault();
    rows[
      Math.max(
        0,
        Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)),
      )
    ]?.focus();
  };

  return (
    <Flex direction="column" gap="2" p="2" style={{ height: '100%' }}>
      <style>{RAIL_CSS}</style>
      <SearchField
        aria-label="Search agents"
        placeholder="Search agents"
        size="small"
        value={search}
        onChange={setSearch}
      />

      <nav aria-label="Agents" style={{ overflowY: 'auto' }}>
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          <RailRow
            id={ALL}
            selected={!selectedTelemetryId}
            icon={<RiLayoutGridLine size={22} />}
            title="All agents"
            description={`${fleet.length} monitored`}
            trailing={
              totalRunning > 0 ? (
                <RunningChip count={totalRunning} label="running" />
              ) : undefined
            }
            onSelect={() => onSelectAgent(undefined)}
            onKeyDown={moveFocus}
          />
          {agents.map(activity => {
            const running = activity.runs.filter(
              r => r.state === 'running',
            ).length;
            const title = activity.title ?? activity.telemetryId;
            return (
              <RailRow
                key={activity.telemetryId}
                id={activity.telemetryId}
                testId="rail-item"
                selected={activity.telemetryId === selectedTelemetryId}
                icon={<RailAvatar activity={activity} name={title} />}
                title={title}
                description={secondaryLine(activity)}
                trailing={<RailStatus activity={activity} running={running} />}
                onSelect={() => onSelectAgent(activity.telemetryId)}
                onKeyDown={moveFocus}
              />
            );
          })}
        </ul>
      </nav>
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
