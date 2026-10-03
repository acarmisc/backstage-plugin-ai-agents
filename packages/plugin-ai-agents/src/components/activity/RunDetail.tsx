import React, { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { useNow } from '../../hooks/useNow';
import { useRunTimeline } from '../../hooks/useWorkspaceData';
import { relativeTime } from '../../utils/formatting';
import { formatMs } from '../../utils/stats';
import { maxConcurrency, runDuration } from './format';
import { SectionCard } from './SectionCard';
import { StatusPill } from './StatusPill';
import { Waterfall } from './Waterfall';
import type { AgentRun } from '../../types';

export interface RunDetailProps {
  entityRef: string;
  run: AgentRun;
  onClose?: () => void;
}

const Fact: React.FC<{
  label: string;
  children: React.ReactNode;
  title?: string;
}> = ({ label, children, title }) => (
  <Box sx={{ minWidth: 0 }} title={title}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{
        display: 'block',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        fontSize: 10.5,
      }}
    >
      {label}
    </Typography>
    <Typography
      noWrap
      sx={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
    >
      {children}
    </Typography>
  </Box>
);

/** One run: facts, parallelism, and the waterfall of its tool calls. */
export const RunDetail: React.FC<RunDetailProps> = ({
  entityRef,
  run,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const running = run.state === 'running';
  const now = useNow(1000, running);
  const [selectedSeq, setSelectedSeq] = useState<number | undefined>();
  const {
    data: events,
    loading,
    error,
    refresh,
  } = useRunTimeline(entityRef, run.runId, running);

  useEffect(() => {
    setSelectedSeq(undefined);
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    ref.current?.scrollIntoView?.({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }, [run.runId]);

  const stats = useMemo(() => {
    const tools = (events ?? []).filter(e => e.tool);
    return {
      calls: tools.length,
      errors: tools.filter(e => e.outcome && e.outcome !== 'ok').length,
      parallel: events ? maxConcurrency(events) : 0,
      incomplete: events?.find(e => e.event === 'completed' && e.incomplete)
        ?.incomplete,
      selected: events?.find(e => e.seq === selectedSeq && e.tool),
    };
  }, [events, selectedSeq]);

  return (
    <Box ref={ref}>
      <SectionCard
        data-testid="run-detail"
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <StatusPill state={run.state} size="small" />
            <Box
              component="span"
              sx={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {run.target ?? run.runId.slice(0, 8)}
            </Box>
          </Box>
        }
        subtitle={run.project}
        action={
          onClose && (
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Close run details"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )
        }
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))',
            gap: 2,
            mb: 2,
          }}
        >
          <Fact label="Started" title={run.startedAt}>
            {relativeTime(run.startedAt)}
          </Fact>
          <Fact label={running ? 'Elapsed' : 'Duration'}>
            {formatMs(runDuration(run, now))}
          </Fact>
          <Fact label="Tool calls">{events ? stats.calls : '—'}</Fact>
          <Fact label="Errors">
            <Box
              component="span"
              sx={{ color: stats.errors > 0 ? 'error.main' : undefined }}
            >
              {events ? stats.errors : '—'}
            </Box>
          </Fact>
          <Fact label="Max parallel">{events ? stats.parallel : '—'}</Fact>
        </Box>

        {run.verdict && (
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              Verdict ·{' '}
            </Box>
            {run.verdict}
          </Typography>
        )}
        {stats.incomplete && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Run did not complete: {stats.incomplete}
          </Alert>
        )}

        {loading && !events && <Skeleton variant="rounded" height={160} />}
        {error && !events && (
          <Alert
            severity="error"
            action={
              <Button size="small" onClick={refresh}>
                Retry
              </Button>
            }
          >
            Could not load the timeline
          </Alert>
        )}
        {events && events.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No events recorded for this run
          </Typography>
        )}
        {events && events.length > 0 && (
          <>
            <Waterfall
              events={events}
              selectedSeq={selectedSeq}
              onSelect={setSelectedSeq}
            />
            {stats.selected && (
              <Box
                data-testid="tool-detail"
                sx={{
                  mt: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  backgroundColor: 'action.hover',
                  fontSize: 13,
                }}
              >
                <strong>{stats.selected.tool}</strong>
                {' · '}
                {formatMs(stats.selected.durationMs ?? 0)}
                {' · '}
                <Box
                  component="span"
                  sx={{
                    color:
                      stats.selected.outcome === 'ok'
                        ? 'success.main'
                        : 'error.main',
                  }}
                >
                  {stats.selected.outcome ?? 'ok'}
                </Box>
              </Box>
            )}
          </>
        )}
      </SectionCard>
    </Box>
  );
};
