import React, { useState } from 'react';
import { Box } from '@mui/material';

const PALETTE = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
  '#c62828', '#0097a7', '#5d4037', '#455a64',
];

function initialsOf(name: string): string {
  const parts = name.replace(/[-_]+/g, ' ').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export interface AgentAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: number;
}

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  name,
  avatarUrl,
  size = 44,
}) => {
  const [broken, setBroken] = useState(false);
  const showImage = avatarUrl && !broken;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: showImage ? 'transparent' : colorFor(name),
        color: 'common.white',
        fontSize: size * 0.36,
        fontWeight: 700,
      }}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name}
          width={size}
          height={size}
          onError={() => setBroken(true)}
          style={{ objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        initialsOf(name)
      )}
    </Box>
  );
};