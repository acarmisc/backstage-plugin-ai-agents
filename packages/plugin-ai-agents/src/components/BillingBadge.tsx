import React from 'react';
import { Chip, Box, Tooltip, Typography } from '@mui/material';
import type { AgentBilling } from '../types';

const BILLING_COLOR: Record<string, 'primary' | 'secondary' | 'success' | 'default'> = {
  'per-invocation': 'primary',
  'per-token': 'secondary',
  subscription: 'success',
  free: 'default',
};

function unitLabel(billing: AgentBilling): string | null {
  return billing.model === 'per-token'
    ? 'per 1M tokens'
    : billing.model === 'per-invocation'
      ? 'per 1k calls'
      : null;
}

function costSummary(billing: AgentBilling): string[] {
  const lines: string[] = [];
  const unit = unitLabel(billing);
  if (billing.unitCost != null && unit) {
    lines.push(`~$${billing.unitCost} ${unit}`);
  }
  if (billing.budget != null) {
    lines.push(`budget: $${billing.budget}`);
  }
  return lines;
}

export interface BillingBadgeProps {
  billing: AgentBilling;
  /** Chip only, with cost details in a tooltip. For tight layouts like cards. */
  compact?: boolean;
}

export const BillingBadge: React.FC<BillingBadgeProps> = ({
  billing,
  compact = false,
}) => {
  const color = BILLING_COLOR[billing.model] ?? 'default';
  const lines = costSummary(billing);
  const chip = (
    <Chip size="small" color={color} label={billing.model} variant="outlined" />
  );

  if (compact) {
    return lines.length ? <Tooltip title={lines.join(' · ')}>{chip}</Tooltip> : chip;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
      {chip}
      {lines.map(line => (
        <Typography key={line} variant="caption" color="text.secondary">
          {line}
        </Typography>
      ))}
    </Box>
  );
};
