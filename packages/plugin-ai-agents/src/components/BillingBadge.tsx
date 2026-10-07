import React from 'react';
import { Badge, Flex, Text } from '@backstage/ui';
import {
  RiCoinLine,
  RiForbid2Line,
  RiLoopRightLine,
  RiMoneyDollarCircleLine,
} from '@remixicon/react';
import type { AgentBilling } from '../types';
import { Hint } from '../ui';

const BILLING_ICON: Record<string, React.ReactElement> = {
  'per-invocation': <RiMoneyDollarCircleLine size={16} />,
  'per-token': <RiCoinLine size={16} />,
  subscription: <RiLoopRightLine size={16} />,
  free: <RiForbid2Line size={16} />,
};

function billingIcon(model: string): React.ReactElement {
  return BILLING_ICON[model] ?? <RiMoneyDollarCircleLine size={16} />;
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
  /** Badge only, with cost details in a tooltip. For tight layouts like cards. */
  compact?: boolean;
  /** 'chip' (default) for a standalone badge; 'text' for a quiet icon+caption, matching footer-note styling. */
  variant?: 'chip' | 'text';
}

export function BillingBadge({
  billing,
  compact = false,
  variant = 'chip',
}: BillingBadgeProps) {
  const lines = costSummary(billing);
  const summary = lines.join(' · ');

  if (variant === 'text') {
    const content = (
      <span
        // With cost details the badge becomes a tooltip trigger, which needs
        // an accessible name that includes them.
        {...(lines.length
          ? {
              role: 'img',
              tabIndex: 0,
              'aria-label': `${billing.model} (${summary})`,
            }
          : {})}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--bui-space-1)',
          color: 'var(--bui-fg-secondary)',
        }}
      >
        {billingIcon(billing.model)}
        <Text variant="body-small" color="secondary" truncate>
          {billing.model}
        </Text>
      </span>
    );
    return lines.length ? <Hint label={summary}>{content}</Hint> : content;
  }

  const badge = (
    <Badge icon={billingIcon(billing.model)}>{billing.model}</Badge>
  );

  if (compact) {
    return lines.length ? (
      <Hint label={summary}>
        <span
          role="img"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a tooltip trigger must be keyboard focusable
          tabIndex={0}
          aria-label={`${billing.model} (${summary})`}
        >
          {badge}
        </span>
      </Hint>
    ) : (
      badge
    );
  }

  return (
    <Flex direction="column" align="start" gap="0.5">
      {badge}
      {lines.map(line => (
        <Text key={line} variant="body-small" color="secondary">
          {line}
        </Text>
      ))}
    </Flex>
  );
}
