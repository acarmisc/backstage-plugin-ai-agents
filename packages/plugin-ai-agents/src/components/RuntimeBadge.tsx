import React from 'react';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MemoryIcon from '@mui/icons-material/Memory';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import FunctionsIcon from '@mui/icons-material/Functions';
import ExtensionIcon from '@mui/icons-material/Extension';
import type { AgentRuntimeName } from '../types';

export const RUNTIME_META: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  'bedrock-agentcore': { label: 'Bedrock AgentCore', icon: <CloudQueueIcon fontSize="small" /> },
  litellm: { label: 'LiteLLM', icon: <MemoryIcon fontSize="small" /> },
  lambda: { label: 'AWS Lambda', icon: <FunctionsIcon fontSize="small" /> },
  custom: { label: 'Custom', icon: <ExtensionIcon fontSize="small" /> },
};

export function getRuntimeMeta(runtime: AgentRuntimeName) {
  return (
    RUNTIME_META[runtime] ?? {
      label: String(runtime),
      icon: <ExtensionIcon fontSize="small" />,
    }
  );
}

export interface RuntimeBadgeProps {
  runtime: AgentRuntimeName;
  size?: 'small' | 'medium';
  onClick?: (runtime: string) => void;
  /** 'chip' (default) for a standalone pill; 'text' for a quiet icon+caption, matching footer-note styling. */
  variant?: 'chip' | 'text';
}

export const RuntimeBadge: React.FC<RuntimeBadgeProps> = ({
  runtime,
  size = 'small',
  onClick,
  variant = 'chip',
}) => {
  const meta = getRuntimeMeta(runtime);

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