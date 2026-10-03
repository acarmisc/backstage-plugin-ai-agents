import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { RunState } from '../../types';
import { stateColor, stateLabel } from './tokens';

export interface StatusDotProps {
  state: RunState;
  size?: number;
}

/**
 * A small colored dot indicating run state.
 * When state==='running', includes a pulse animation (respects prefers-reduced-motion).
 */
export const StatusDot: React.FC<StatusDotProps> = ({ state, size = 10 }) => {
  const theme = useTheme();
  const color = stateColor(theme, state);

  return (
    <Box
      data-state={state}
      data-pulse={state === 'running' ? 'true' : 'false'}
      aria-label={stateLabel(state)}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
        ...(state === 'running' && {
          animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
          },
          '@keyframes pulse-ring': {
            '0%': {
              boxShadow: `0 0 0 0 ${color}`,
            },
            '70%': {
              boxShadow: `0 0 0 6px rgba(0, 0, 0, 0)`,
            },
            '100%': {
              boxShadow: `0 0 0 0 rgba(0, 0, 0, 0)`,
            },
          },
        }),
      }}
    />
  );
};

export interface StatusPillProps {
  state: RunState;
  size?: 'small' | 'medium';
}

/**
 * A status indicator combining a colored dot and a label.
 * Supports pulse animation for running state (enabled by default unless pulse === false).
 */
export const StatusPill: React.FC<StatusPillProps> = ({
  state,
  size = 'medium',
}) => {
  const theme = useTheme();
  const label = stateLabel(state);
  const dotSize = size === 'small' ? 8 : 10;

  return (
    <Box
      aria-label={label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'small' ? '6px' : '8px',
        paddingX: size === 'small' ? '8px' : '12px',
        paddingY: size === 'small' ? '4px' : '6px',
        borderRadius: '16px',
        backgroundColor:
          theme.palette.mode === 'dark'
            ? theme.palette.divider
            : theme.palette.action.hover,
        fontSize: size === 'small' ? '12px' : '14px',
      }}
    >
      <StatusDot state={state} size={dotSize} />
      <Typography
        component="span"
        sx={{
          fontSize: 'inherit',
          fontWeight: 500,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};
