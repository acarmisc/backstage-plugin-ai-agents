import React from 'react';
import { TONE_FG, Tone } from './tone';

export interface MeterProps {
  value: number;
  max?: number;
  tone?: Tone;
  /** Accessible name (what is being measured). */
  label: string;
  height?: number;
}

/** Thin horizontal progress bar built on BUI tokens. */
export function Meter({
  value,
  max = 100,
  tone = 'info',
  label,
  height = 6,
}: MeterProps) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, 0), max)}
      style={{
        height,
        width: '100%',
        overflow: 'hidden',
        borderRadius: 'var(--bui-radius-full)',
        background: 'var(--bui-bg-neutral-3)',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${ratio * 100}%`,
          background: TONE_FG[tone],
          borderRadius: 'var(--bui-radius-full)',
        }}
      />
    </div>
  );
}
