import React from 'react';
import { Text } from '@backstage/ui';
import type { AgentStatus } from '../types';
import { relativeTime } from '../utils/formatting';
import type { AgentLive } from '../utils/live';
import { AgentStatusBadge } from './AgentStatusBadge';
import { StatusPill } from './activity/StatusPill';

export interface AgentLiveStatusProps {
  /** From the Activity telemetry; preferred when present. */
  live?: AgentLive;
  /** Health probe result, used when the agent has no activity. */
  status?: AgentStatus;
}

/**
 * The agent's state as the Activity view sees it (running, completed,
 * failed) with when it was last seen. Agents without telemetry fall back to
 * the health probe's dot.
 */
export function AgentLiveStatus({ live, status }: AgentLiveStatusProps) {
  if (!live) return <AgentStatusBadge status={status} />;

  return (
    <div
      data-testid="live-status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2,
      }}
    >
      {live.hasRuns ? (
        <StatusPill state={live.state} size="small" />
      ) : (
        <Text variant="body-small" color="secondary">
          No runs yet
        </Text>
      )}
      {live.hasRuns && (
        <Text
          variant="body-x-small"
          color="secondary"
          style={{ whiteSpace: 'nowrap' }}
        >
          {live.state === 'running'
            ? 'running now'
            : `last seen ${relativeTime(live.lastSeen)}`}
        </Text>
      )}
    </div>
  );
}
