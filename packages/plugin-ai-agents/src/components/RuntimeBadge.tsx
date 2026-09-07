import React from 'react';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MemoryIcon from '@mui/icons-material/Memory';
import FunctionsIcon from '@mui/icons-material/Functions';
import ExtensionIcon from '@mui/icons-material/Extension';
import type { AgentRuntimeName } from '../types';
import { AwsIcon } from './icons/AwsIcon';
import { KagentIcon } from './icons/KagentIcon';

export interface RuntimeDescriptor {
  label: string;
  icon: React.ReactNode;
}

// Internal registry Map - can be extended via registerRuntimeDescriptor()
const registry = new Map<string, RuntimeDescriptor>([
  ['bedrock-agentcore', { label: 'Bedrock AgentCore', icon: <AwsIcon /> }],
  ['kagent', { label: 'kagent', icon: <KagentIcon /> }],
  ['litellm', { label: 'LiteLLM', icon: <MemoryIcon fontSize="small" /> }],
  ['lambda', { label: 'AWS Lambda', icon: <FunctionsIcon fontSize="small" /> }],
  ['custom', { label: 'Custom', icon: <ExtensionIcon fontSize="small" /> }],
]);

/**
 * Registers or overwrites a runtime descriptor.
 * Later registrations override earlier ones, allowing provider modules to extend or customize.
 */
export function registerRuntimeDescriptor(
  runtime: string,
  descriptor: RuntimeDescriptor,
): void {
  registry.set(runtime, descriptor);
}

/**
 * Returns a read-only Map of currently registered runtime descriptors.
 * This is the primary way to access the live registry state.
 */
export function getRuntimeMetaRegistry(): ReadonlyMap<string, RuntimeDescriptor> {
  return registry;
}

export function getRuntimeMeta(runtime: AgentRuntimeName) {
  return (
    registry.get(runtime) ?? {
      label: String(runtime),
      icon: <ExtensionIcon fontSize="small" />,
    }
  );
}

export interface RuntimeBadgeProps {
  runtime: AgentRuntimeName;
  size?: 'small' | 'medium';
  onClick?: (runtime: string) => void;
  /**
   * 'chip' (default) for a standalone pill; 'text' for a quiet icon+caption,
   * matching footer-note styling; 'icon' for a bare icon with a tooltip,
   * for tight spaces like a card header.
   */
  variant?: 'chip' | 'text' | 'icon';
}

export const RuntimeBadge: React.FC<RuntimeBadgeProps> = ({
  runtime,
  size = 'small',
  onClick,
  variant = 'chip',
}) => {
  const meta = getRuntimeMeta(runtime);

  if (variant === 'icon') {
    return (
      <Tooltip title={meta.label}>
        <Box
          onClick={
            onClick
              ? e => {
                  e.stopPropagation();
                  onClick(runtime);
                }
              : undefined
          }
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'text.secondary',
            cursor: onClick ? 'pointer' : 'default',
            '& svg': { fontSize: 19 },
            '&:hover': onClick ? { color: 'text.primary' } : undefined,
          }}
        >
          {meta.icon}
        </Box>
      </Tooltip>
    );
  }

  if (variant === 'text') {
    return (
      <Box
        onClick={onClick ? () => onClick(runtime) : undefined}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          color: 'text.secondary',
          cursor: onClick ? 'pointer' : 'default',
          '& svg': { fontSize: 16 },
          '&:hover': onClick ? { color: 'text.primary' } : undefined,
        }}
      >
        {meta.icon}
        <Typography variant="caption" color="inherit" noWrap>
          {meta.label}
        </Typography>
      </Box>
    );
  }

  return (
    <Chip
      size={size}
      variant="outlined"
      label={
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          {meta.icon}
          {meta.label}
        </Box>
      }
      onClick={onClick ? () => onClick(runtime) : undefined}
      clickable={Boolean(onClick)}
    />
  );
};