import React from 'react';
import { Text } from '@backstage/ui';
import type { AgentStatus, AgentStatusState } from '../types';
import { Hint, StatusDot, Tone } from '../ui';

const STATE_TONE: Record<AgentStatusState, Tone> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'danger',
  unknown: 'neutral',
};

export interface AgentStatusBadgeProps {
  status?: AgentStatus;
}

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const state = status?.state ?? 'unknown';

  const title = status
    ? [
        `Status: ${state}`,
        status.lastChecked
          ? `Last checked: ${new Date(status.lastChecked).toLocaleString()}`
          : null,
        status.latencyMs !== undefined && status.latencyMs !== null
          ? `Latency: ${status.latencyMs}ms`
          : null,
        status.message ? status.message : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Status: unknown';

  return (
    <Hint label={title}>
      <span
        role="img"
        aria-label={title}
        tabIndex={0}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--bui-space-1)',
          cursor: 'help',
        }}
      >
        <StatusDot
          tone={STATE_TONE[state]}
          size={10}
          hollow={state === 'unknown'}
        />
        {status &&
          status.latencyMs !== undefined &&
          status.latencyMs !== null && (
            <Text variant="body-small" color="secondary">
              {status.latencyMs}ms
            </Text>
          )}
      </span>
    </Hint>
  );
}
