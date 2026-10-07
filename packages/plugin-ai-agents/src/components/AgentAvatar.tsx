import React from 'react';
import { Avatar } from '@backstage/ui';
import { isSafeUrl } from '../types';

function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Two-word form of `name` whose initials are what we want to show: first and
 * last word ("support-triage-agent" -> "SA"), or the first two letters of a
 * single word. BUI's `Avatar` derives its initials from the words it gets.
 */
function initialsName(name: string): string {
  const words = wordsOf(name);
  if (words.length === 0) return 'A I';
  if (words.length === 1) return `${words[0][0]} ${words[0][1] ?? ''}`.trim();
  return `${words[0][0]} ${words[words.length - 1][0]}`;
}

type BuiAvatarSize = 'x-small' | 'small' | 'medium' | 'large' | 'x-large';

/** BUI avatar sizes are 20/24/32/40/48px; pick the closest one at or above. */
function sizeFor(px: number): BuiAvatarSize {
  if (px <= 20) return 'x-small';
  if (px <= 24) return 'small';
  if (px <= 32) return 'medium';
  if (px <= 40) return 'large';
  return 'x-large';
}

export interface AgentAvatarProps {
  name: string;
  avatarUrl?: string;
  /** Approximate size in px; mapped to the nearest BUI avatar size. */
  size?: number;
}

/**
 * Agent avatar: the image when `avatarUrl` is a safe URL and loads, initials
 * otherwise (BUI's `Avatar` shows them while loading and when the image
 * fails). The wrapper carries the accessible name.
 */
export function AgentAvatar({ name, avatarUrl, size = 44 }: AgentAvatarProps) {
  const src = isSafeUrl(avatarUrl) ? avatarUrl : '';
  return (
    <span
      role="img"
      aria-label={name}
      style={{ display: 'inline-flex', flexShrink: 0 }}
    >
      <Avatar
        src={src}
        name={initialsName(name)}
        size={sizeFor(size)}
        purpose="decoration"
      />
    </span>
  );
}
