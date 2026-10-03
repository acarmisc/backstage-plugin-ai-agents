import { Theme } from '@mui/material/styles';
import { RunState } from '../../types';

/**
 * Get the color for a run state based on the theme.
 * running -> info.main, completed -> success.main, failed -> error.main, unknown -> text.disabled
 */
export function stateColor(theme: Theme, state: RunState): string {
  switch (state) {
    case 'running':
      return theme.palette.info.main;
    case 'completed':
      return theme.palette.success.main;
    case 'failed':
      return theme.palette.error.main;
    case 'unknown':
    default:
      return theme.palette.text.disabled;
  }
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
