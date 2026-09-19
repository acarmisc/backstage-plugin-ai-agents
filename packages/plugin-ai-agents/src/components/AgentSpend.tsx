import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { SpendSummary } from '../api';

function formatUsd(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/**
 * LiteLLM spend attributed to this agent (all threads) or a single
 * conversation thread. Renders nothing when LiteLLM is not configured, so
 * static setups stay clean.
 */
export const AgentSpend: React.FC<{
  entityRef: string;
  /** When set, the spend is scoped to this conversation thread. */
  threadId?: string;
  days?: number;
}> = ({ entityRef, threadId, days = 30 }) => {
  const api = useApi(aiAgentsApiRef);
  const [summary, setSummary] = useState<SpendSummary | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getSpend(entityRef, { threadId, days })
      .then(s => alive && setSummary(s))
      .catch(() => alive && setSummary(null));
    return () => {
      alive = false;
    };
  }, [api, entityRef, threadId, days]);

  if (!summary || summary.requests === 0) return null;

  const models = Object.entries(summary.byModel)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <Box sx={{ mt: 2 }} data-testid="agent-spend">
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {threadId ? 'Conversation cost' : `Cost (last ${days}d)`}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatUsd(summary.spend)}
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={`${summary.requests} calls`}
          sx={{ height: 18, fontSize: '0.65rem' }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`${formatTokens(summary.totalTokens)} tok`}
          sx={{ height: 18, fontSize: '0.65rem' }}
        />
      </Stack>
      {models.length > 0 && (
        <Stack spacing={0.25}>
          {models.map(([model, spend]) => (
            <Box key={model} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                {model}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatUsd(spend)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};
