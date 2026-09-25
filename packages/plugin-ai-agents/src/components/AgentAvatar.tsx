import React, { useState } from 'react';
import Box from '@mui/material/Box';
import { isSafeUrl } from '../types';

const PALETTE = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
  '#c62828', '#0097a7', '#5d4037', '#455a64',
];

/**
 * URLs that failed to load, remembered for the lifetime of the page so a
 * dead avatar (e.g. one hosted in a private repo the browser cannot fetch)
 * is not re-requested on every card render.
 */
const brokenUrls = new Set<string>();

function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function initialsOf(name: string): string {
  const words = wordsOf(name);
  if (words.length === 0) return 'AI';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
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
  // Bumped when an image fails so the (set-backed) broken check re-renders.
  const [, setLoadEpoch] = useState(0);
  const showImage = isSafeUrl(avatarUrl) && !brokenUrls.has(avatarUrl);

  return (
    <Box
      role="img"
      aria-label={name}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        fontSize: size * 0.36,
        fontWeight: 700,
      }}
    >
      {/* Initials sit underneath the image at all times: they cover the
          loading state, the broken-image case, and dark-theme visibility of
          transparent-background SVG avatars. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: colorFor(name),
          color: 'common.white',
        }}
      >
        {initialsOf(name)}
      </Box>
      {showImage && (
        <Box
          component="img"
          src={avatarUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (avatarUrl) brokenUrls.add(avatarUrl);
            setLoadEpoch(e => e + 1);
          }}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            bgcolor: 'background.paper',
          }}
        />
      )}
    </Box>
  );
};
