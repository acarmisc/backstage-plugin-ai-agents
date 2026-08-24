import React from 'react';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import MemoryIcon from '@mui/icons-material/Memory';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import FunctionsIcon from '@mui/icons-material/Functions';
import ExtensionIcon from '@mui/icons-material/Extension';
import type { AgentRuntimeName } from '../types';

const RUNTIME_META: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  'bedrock-agentcore': { label: 'Bedrock AgentCore', icon: <CloudQueueIcon fontSize="small" /> },
  litellm: { label: 'LiteLLM', icon: <MemoryIcon fontSize="small" /> },
  lambda: { label: 'AWS Lambda', icon: <FunctionsIcon fontSize="small" /> },
  custom: { label: 'Custom', icon: <ExtensionIcon fontSize="small" /> },
};

export interface RuntimeBadgeProps {
  runtime: AgentRuntimeName;
  size?: 'small' | 'medium';
  onClick?: (runtime: string) => void;
}

export const RuntimeBadge: React.FC<RuntimeBadgeProps> = ({
  runtime,
  size = 'small',
  onClick,
}) => {
  const meta = RUNTIME_META[runtime] ?? {
    label: String(runtime),
    icon: <ExtensionIcon fontSize="small" />,
  };
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