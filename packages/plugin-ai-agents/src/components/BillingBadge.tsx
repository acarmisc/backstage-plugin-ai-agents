import React from 'react';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PaidIcon from '@mui/icons-material/Paid';
import TokenIcon from '@mui/icons-material/Token';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import type { AgentBilling } from '../types';

const BILLING_COLOR: Record<string, 'primary' | 'secondary' | 'success' | 'default'> = {
  'per-invocation': 'primary',
  'per-token': 'secondary',
  subscription: 'success',
  free: 'default',
};

const BILLING_ICON: Record<string, React.ReactElement> = {
  'per-invocation': <PaidIcon fontSize="small" />,
  'per-token': <TokenIcon fontSize="small" />,
  subscription: <AutorenewIcon fontSize="small" />,
  free: <MoneyOffIcon fontSize="small" />,
};

function billingIcon(model: string): React.ReactElement {
  return BILLING_ICON[model] ?? <PaidIcon fontSize="small" />;
}

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
  /** 'chip' (default) for a standalone pill; 'text' for a quiet icon+caption, matching footer-note styling. */
  variant?: 'chip' | 'text';
}

export const BillingBadge: React.FC<BillingBadgeProps> = ({
  billing,
  compact = false,
  variant = 'chip',
}) => {
  const color = BILLING_COLOR[billing.model] ?? 'default';
  const lines = costSummary(billing);

  if (variant === 'text') {
    const content = (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          color: 'text.secondary',
          '& svg': { fontSize: 16 },
        }}
      >
        {billingIcon(billing.model)}
        <Typography variant="caption" color="inherit" noWrap>
          {billing.model}
        </Typography>
      </Box>
    );
    return lines.length ? <Tooltip title={lines.join(' · ')}>{content}</Tooltip> : content;
  }

  const chip = (
    <Chip
      size="small"
      color={color}
      icon={billingIcon(billing.model)}
      label={billing.model}
      variant="outlined"
    />
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
