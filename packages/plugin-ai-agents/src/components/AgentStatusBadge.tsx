import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import type { AgentStatus, AgentStatusState } from '../types';

const STATE_COLOR: Record<AgentStatusState, string> = {
  healthy: 'success.main',
  degraded: 'warning.main',
  down: 'error.main',
  unknown: 'text.disabled',
};

export interface AgentStatusBadgeProps {
  status?: AgentStatus;
}

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({ status }) => {
  const state = status?.state ?? 'unknown';
  const color = STATE_COLOR[state];
  const ring = state === 'unknown' ? `1px dashed ${color}` : 'none';

  const title = status
    ? [
        `Status: ${state}`,
        status.lastChecked ? `Last checked: ${new Date(status.lastChecked).toLocaleString()}` : null,
        status.latencyMs != null ? `Latency: ${status.latencyMs}ms` : null,
        status.message ? status.message : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Status: unknown';

  return (
    <Tooltip title={title} arrow>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          cursor: 'help',
        }}
      >
        <Box
          component="span"
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: color,
            border: ring,
            flexShrink: 0,
          }}
        />
        {status?.latencyMs != null && (
          <Typography variant="caption" color="text.secondary">
            {status.latencyMs}ms
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};