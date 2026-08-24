import React from 'react';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { AgentBilling } from '../types';

const BILLING_COLOR: Record<string, 'primary' | 'secondary' | 'success' | 'default'> = {
  'per-invocation': 'primary',
  'per-token': 'secondary',
  subscription: 'success',
  free: 'default',
};

function unitLabel(billing: AgentBilling): string | null {
  if (billing.model === 'per-token') return 'per 1M tokens';
  if (billing.model === 'per-invocation') return 'per 1k calls';
  return null;
}

function costSummary(billing: AgentBilling): string[] {
  const lines: string[] = [];
  const unit = unitLabel(billing);
  if (billing.unitCost !== undefined && billing.unitCost !== null && unit) {
    lines.push(`~$${billing.unitCost} ${unit}`);
  }
  if (billing.budget !== undefined && billing.budget !== null) {
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
