import React from 'react';
import {
  Badge,
  Button,
  ButtonIcon,
  Text,
  Tooltip,
  TooltipTrigger,
} from '@backstage/ui';
import { RiCpuLine, RiFunctionLine, RiPuzzleLine } from '@remixicon/react';
import type { AgentRuntimeName } from '../types';
import { Hint } from '../ui';
import { AwsIcon } from './icons/AwsIcon';
import { KagentIcon } from './icons/KagentIcon';

export const RUNTIME_META: Record<
  string,
  { label: string; icon: React.ReactElement }
> = {
  'bedrock-agentcore': { label: 'Bedrock AgentCore', icon: <AwsIcon /> },
  kagent: { label: 'kagent', icon: <KagentIcon /> },
  litellm: { label: 'LiteLLM', icon: <RiCpuLine size={16} /> },
  lambda: { label: 'AWS Lambda', icon: <RiFunctionLine size={16} /> },
  custom: { label: 'Custom', icon: <RiPuzzleLine size={16} /> },
};

export function getRuntimeMeta(runtime: AgentRuntimeName) {
  return (
    RUNTIME_META[runtime] ?? {
      label: String(runtime),
      icon: <RiPuzzleLine size={16} />,
    }
  );
}

export interface RuntimeBadgeProps {
  runtime: AgentRuntimeName;
  size?: 'small' | 'medium';
  onClick?: (runtime: string) => void;
  /**
   * 'chip' (default) for a standalone badge; 'text' for a quiet icon+caption,
   * matching footer-note styling; 'icon' for a bare icon with a tooltip,
   * for tight spaces like a card header.
   */
  variant?: 'chip' | 'text' | 'icon';
}

export function RuntimeBadge({
  runtime,
  size = 'small',
  onClick,
  variant = 'chip',
}: RuntimeBadgeProps) {
  const meta = getRuntimeMeta(runtime);

  if (variant === 'icon') {
    if (onClick) {
      return (
        <TooltipTrigger>
          <ButtonIcon
            aria-label={meta.label}
            variant="tertiary"
            size="small"
            icon={meta.icon}
            onPress={() => onClick(runtime)}
          />
          <Tooltip>{meta.label}</Tooltip>
        </TooltipTrigger>
      );
    }
    return (
      <Hint label={meta.label}>
        <span
          role="img"
          aria-label={meta.label}
          tabIndex={0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--bui-fg-secondary)',
          }}
        >
          {meta.icon}
        </span>
      </Hint>
    );
  }

  if (variant === 'text') {
    if (onClick) {
      return (
        <Button
          variant="tertiary"
          size="small"
          iconStart={meta.icon}
          onPress={() => onClick(runtime)}
        >
          {meta.label}
        </Button>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--bui-space-1)',
          color: 'var(--bui-fg-secondary)',
        }}
      >
        {meta.icon}
        <Text variant="body-small" color="secondary" truncate>
          {meta.label}
        </Text>
      </span>
    );
  }

  if (onClick) {
    return (
      <Button
        variant="secondary"
        size={size}
        iconStart={meta.icon}
        onPress={() => onClick(runtime)}
      >
        {meta.label}
      </Button>
    );
  }
  return (
    <Badge icon={meta.icon} size={size}>
      {meta.label}
    </Badge>
  );
}
