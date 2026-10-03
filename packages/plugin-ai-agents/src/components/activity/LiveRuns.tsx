import React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useNow } from '../../hooks/useNow';
import { formatMs } from '../../utils/stats';
import { elapsedSince } from './format';
import { SectionCard } from './SectionCard';
import { StatusDot } from './StatusPill';
import type { AgentRun } from '../../types';

export interface LiveRunsProps {
  runs: AgentRun[];
  selectedRunId?: string;
  onSelect?: (runId: string) => void;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * Every run currently in progress, side by side. Cards have a fixed size so a
 * run starting or finishing never shifts the others; selection is an outline.
 */
export const LiveRuns: React.FC<LiveRunsProps> = ({ runs, selectedRunId, onSelect }) => {
  const theme = useTheme();
  const running = runs.filter(r => r.state === 'running');
  const now = useNow(1000, running.length > 0);

  return (
    <SectionCard
      data-testid="live-runs"
      title={
        <>
          Running now
          <Box
            component="span"
            sx={{ ml: 1, color: running.length ? 'info.main' : 'text.disabled', fontVariantNumeric: 'tabular-nums' }}
          >
            {running.length}
          </Box>
        </>
      }
      subtitle={running.length > 1 ? 'concurrent executions' : undefined}
    >
      {running.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No runs in progress
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.5 }}>
          {running.map(run => {
            const selected = run.runId === selectedRunId;
            return (
              <Box
                key={run.runId}
                component="button"
                type="button"
                data-testid="live-run"
                data-run-id={run.runId}
                aria-pressed={selected}
                onClick={() => onSelect?.(run.runId)}
                sx={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  height: 104,
                  p: 1.5,
                  borderRadius: 1.5,
                  border: 1,
                  borderColor: alpha(theme.palette.info.main, 0.35),
                  backgroundColor: alpha(theme.palette.info.main, 0.05),
                  outline: selected ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                  outlineOffset: -1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  position: 'relative',
                  '&:hover': { backgroundColor: alpha(theme.palette.info.main, 0.1) },
                  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -1 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <StatusDot state="running" size={10} />
                  <Typography
                    noWrap
                    sx={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0 }}
                    title={run.target}
                  >
                    {run.target || 'run'}
                  </Typography>
                  <Typography
                    data-testid="live-elapsed"
                    sx={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'info.main' }}
                  >
                    {formatMs(elapsedSince(run.startedAt, now))}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  {run.project && (
                    <Typography noWrap variant="caption" color="text.secondary" sx={{ display: 'block' }} title={run.project}>
                      {run.project}
                    </Typography>
                  )}
                  <Typography noWrap variant="body2" sx={{ color: 'text.primary' }}>
                    {run.currentActivity ?? 'working…'}
                  </Typography>
                </Box>
                <LinearProgress
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 3,
                    '@media (prefers-reduced-motion: reduce)': {
                      '& .MuiLinearProgress-bar': { animation: 'none', width: '35%' },
                    },
                  }}
                />
              </Box>
            );
          })}
        </Box>
      )}
    </SectionCard>
  );
};
