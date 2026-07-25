import React from 'react';
import { Chip, Box, Typography } from '@mui/material';
import type { AgentBilling } from '../types';

const BILLING_COLOR: Record<string, 'primary' | 'secondary' | 'success' | 'default'> = {
  'per-invocation': 'primary',
  'per-token': 'secondary',
  subscription: 'success',
  free: 'default',
};

export interface BillingBadgeProps {
  billing: AgentBilling;
}

export const BillingBadge: React.FC<BillingBadgeProps> = ({ billing }) => {
  const color = BILLING_COLOR[billing.model] ?? 'default';
  const unitLabel =
    billing.model === 'per-token'
      ? 'per 1M tokens'
      : billing.model === 'per-invocation'
        ? 'per 1k calls'
        : null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Chip size="small" color={color} label={billing.model} variant="outlined" />
      {billing.unitCost != null && unitLabel && (
        <Typography variant="caption" color="text.secondary">
          ~${billing.unitCost} {unitLabel}
        </Typography>
      )}
      {billing.budget != null && (
        <Typography variant="caption" color="text.secondary">
          budget: ${billing.budget}
        </Typography>
      )}
    </Box>
  );
};