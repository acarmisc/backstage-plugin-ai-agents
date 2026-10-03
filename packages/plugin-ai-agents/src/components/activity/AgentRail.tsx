import React, { useCallback, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { alpha, useTheme } from '@mui/material/styles';
import { AgentAvatar } from '../AgentAvatar';
import { relativeTime } from '../../utils/formatting';
import { StatusDot } from './StatusPill';
import type { AgentActivity, AgentRun } from '../../types';

export interface AgentRailProps {
  /** Fleet data for all agents. */
  fleet: AgentActivity[];
  /** Selected agent telemetryId; undefined selects the fleet overview. */
  selectedTelemetryId?: string;
  onSelectAgent: (telemetryId: string | undefined) => void;
}

const ITEM_HEIGHT = 56;

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
    <Box
      data-testid="running-chip"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        height: 20,
        px: 0.75,
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color: 'info.main',
        backgroundColor: theme => alpha(theme.palette.info.main, 0.14),
        whiteSpace: 'nowrap',
      }}
    >
      {count}
      {label ? ` ${label}` : ''}
    </Box>
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
      <Tooltip title="Telemetry unavailable">
        <WarningAmberIcon
          aria-label="Telemetry unavailable"
          sx={{ fontSize: 18, color: 'text.disabled' }}
        />
      </Tooltip>
    );
  }
  if (running > 0) return <RunningChip count={running} />;
  return <StatusDot state={aggregateState(activity)} size={8} />;
}

/**
 * Left rail: "All agents" followed by the agents in a STABLE alphabetical
 * order (state changes never reorder it). Items have a fixed height and
 * selection only changes colours, so nothing moves when you click.
 */
export function AgentRail({
  fleet,
  selectedTelemetryId,
  onSelectAgent,
}: AgentRailProps) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [focus, setFocus] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

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
  const itemCount = agents.length + 1;

  const choose = useCallback(
    (index: number) =>
      onSelectAgent(index === 0 ? undefined : agents[index - 1].telemetryId),
    [agents, onSelectAgent],
  );

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(itemCount - 1, next));
    setFocus(clamped);
    (
      listRef.current?.querySelectorAll('[role="option"]')[clamped] as
        HTMLElement | undefined
    )?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(focus + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(focus - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(focus);
    }
  };

  const itemSx = (selected: boolean) => ({
    boxSizing: 'border-box' as const,
    height: ITEM_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    gap: 1.25,
    px: 1.5,
    borderRadius: 1.5,
    cursor: 'pointer',
    // Selection = background + inset accent. Nothing changes size or padding.
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.1)
      : 'transparent',
    boxShadow: selected
      ? `inset 3px 0 0 ${theme.palette.primary.main}`
      : 'none',
    '&:hover': {
      backgroundColor: selected
        ? alpha(theme.palette.primary.main, 0.14)
        : theme.palette.action.hover,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: -2,
    },
  });

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      <Box sx={{ p: 1.5, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.25,
            height: 36,
            borderRadius: 1.5,
            backgroundColor: theme.palette.action.hover,
            '&:focus-within': {
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.5)}`,
            },
          }}
        >
          <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <InputBase
            fullWidth
            placeholder="Search agents"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setFocus(0);
            }}
            inputProps={{ 'aria-label': 'Search agents' }}
            sx={{ fontSize: 13 }}
          />
        </Box>
      </Box>

      <Box
        ref={listRef}
        role="listbox"
        aria-label="Agents"
        onKeyDown={onKeyDown}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 1,
          pb: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
        }}
      >
        <Box
          role="option"
          aria-selected={selectedTelemetryId === undefined}
          tabIndex={focus === 0 ? 0 : -1}
          onClick={() => onSelectAgent(undefined)}
          onFocus={() => setFocus(0)}
          sx={itemSx(selectedTelemetryId === undefined)}
        >
          <DashboardOutlinedIcon
            sx={{ fontSize: 22, color: 'text.secondary', mx: '3px' }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              All agents
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {fleet.length} monitored
            </Typography>
          </Box>
          {totalRunning > 0 && (
            <RunningChip count={totalRunning} label="running" />
          )}
        </Box>

        {agents.map((activity, i) => {
          const index = i + 1;
          const selected = selectedTelemetryId === activity.telemetryId;
          const running = activity.runs.filter(
            r => r.state === 'running',
          ).length;
          const title = activity.title ?? activity.telemetryId;
          return (
            <Box
              key={activity.telemetryId}
              role="option"
              aria-selected={selected}
              aria-label={title}
              data-testid="rail-item"
              data-telemetry-id={activity.telemetryId}
              tabIndex={focus === index ? 0 : -1}
              onClick={() => onSelectAgent(activity.telemetryId)}
              onFocus={() => setFocus(index)}
              sx={itemSx(selected)}
            >
              <AgentAvatar name={title} size={28} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{
                    fontSize: 14,
                    fontWeight: selected ? 600 : 500,
                    lineHeight: 1.3,
                  }}
                  title={title}
                >
                  {title}
                </Typography>
                <Typography
                  noWrap
                  sx={{
                    fontSize: 12,
                    color: 'text.secondary',
                    lineHeight: 1.3,
                  }}
                  title={secondaryLine(activity)}
                >
                  {secondaryLine(activity)}
                </Typography>
              </Box>
              <RailStatus activity={activity} running={running} />
            </Box>
          );
        })}

        {agents.length === 0 && (
          <Typography
            sx={{
              p: 2,
              textAlign: 'center',
              fontSize: 12,
              color: 'text.secondary',
            }}
          >
            {fleet.length === 0
              ? 'No agents with telemetry'
              : 'No agent matches your search'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
