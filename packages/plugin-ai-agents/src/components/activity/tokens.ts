import type { RunState } from '../../types';
import { TONE_FG, Tone } from '../../ui';

/** Semantic tone for a run state (drives dots, pills and text colors). */
export function stateTone(state: RunState): Tone {
  switch (state) {
    case 'running':
      return 'info';
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'unknown':
    default:
      return 'neutral';
  }
}

/** CSS color (a BUI token) for a run state. */
export function stateColor(state: RunState): string {
  return TONE_FG[stateTone(state)];
}

/**
 * Get the human-readable label for a run state.
 */
export function stateLabel(state: RunState): string {
  switch (state) {
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'unknown':
    default:
      return 'Unknown';
  }
}
