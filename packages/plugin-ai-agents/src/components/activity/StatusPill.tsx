import React from 'react';
import { Badge } from '@backstage/ui';
import { RunState } from '../../types';
import { StatusDot as Dot } from '../../ui';
import { stateLabel, stateTone } from './tokens';

export interface StatusDotProps {
  state: RunState;
  size?: number;
}

/**
 * A small colored dot indicating run state. A running state pulses (BUI's
 * animation, which BUI itself disables for reduced motion).
 */
export function StatusDot({ state, size = 10 }: StatusDotProps) {
  return (
    <span
      role="img"
      data-state={state}
      data-pulse={state === 'running' ? 'true' : 'false'}
      aria-label={stateLabel(state)}
      style={{ display: 'inline-flex' }}
    >
      <Dot
        tone={stateTone(state)}
        size={size}
        pulse={state === 'running'}
        hollow={state === 'unknown'}
      />
    </span>
  );
}

export interface StatusPillProps {
  state: RunState;
  size?: 'small' | 'medium';
}

/** A status indicator combining a colored dot and a label. */
export function StatusPill({ state, size = 'medium' }: StatusPillProps) {
  return (
    <Badge
      size={size}
      aria-label={stateLabel(state)}
      icon={
        <Dot
          tone={stateTone(state)}
          size={size === 'small' ? 8 : 10}
          pulse={state === 'running'}
          hollow={state === 'unknown'}
        />
      }
    >
      {stateLabel(state)}
    </Badge>
  );
}
