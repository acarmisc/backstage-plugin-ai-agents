import React from 'react';
import { TONE_FG, Tone } from './tone';

export interface StatusDotProps {
  tone: Tone;
  /** Diameter in px. */
  size?: number;
  /** Pulse while something is in progress (BUI's own `pulse` animation). */
  pulse?: boolean;
  /** Dashed outline instead of a fill, for "no data / unknown". */
  hollow?: boolean;
}

/**
 * Small status dot. Decorative: always pair it with text or a labelled
 * wrapper so the state is not conveyed by color alone.
 */
export function StatusDot({
  tone,
  size = 8,
  pulse = false,
  hollow = false,
}: StatusDotProps) {
  const color = TONE_FG[tone];
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 'var(--bui-radius-full)',
        background: hollow ? 'transparent' : color,
        border: hollow ? `1px dashed ${color}` : 'none',
        animation: pulse ? 'var(--bui-animate-pulse)' : undefined,
      }}
    />
  );
}
