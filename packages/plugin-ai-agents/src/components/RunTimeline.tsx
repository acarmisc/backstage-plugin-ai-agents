import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { AgentRun, RunEvent } from '../types';

function EventIcon({ event }: { event: RunEvent }) {
  if (event.event === 'start') return <PlayArrowIcon color="info" sx={{ fontSize: 16 }} />;
  if (event.event === 'completed') {
    return event.incomplete
      ? <ErrorIcon color="warning" sx={{ fontSize: 16 }} />
      : <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />;
  }
  return event.outcome && event.outcome !== 'ok'
    ? <ErrorIcon color="error" sx={{ fontSize: 16 }} />
    : <InfoIcon color="action" sx={{ fontSize: 16 }} />;
}

function eventLabel(event: RunEvent): string {
  if (event.event === 'start') return 'Run started';
  if (event.event === 'completed') {
    return event.incomplete ? `Completed: ${event.incomplete}` : 'Run completed';
  }
  return event.tool ?? event.event;
}

export const RunTimelineView: React.FC<{ run?: AgentRun; events: RunEvent[] }> = ({ run, events }) => {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  return (
    <Box data-testid="run-timeline">
      {run && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            {run.target ? `Working on ${run.target}` : 'Latest run'}
          </Typography>
          <Chip size="small" label={run.state} color={run.state === 'running' ? 'info' : 'default'} />
        </Box>
      )}
      <Stack spacing={0}>
        {ordered.map((event, index) => (
          <Box key={event.seq} sx={{ display: 'flex', gap: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5 }}>
              <EventIcon event={event} />
              {index < ordered.length - 1 && <Box sx={{ width: 2, flexGrow: 1, bgcolor: 'divider', my: 0.25 }} />}
            </Box>
            <Box sx={{ pb: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap title={eventLabel(event)}>{eventLabel(event)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {[event.outcome !== 'ok' ? event.outcome : null, event.ts ?? `#${event.seq}`].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export const RunTimeline: React.FC<{ entityRef: string; pollMs?: number }> = ({ entityRef, pollMs = 10000 }) => {
  const api = useApi(aiAgentsApiRef);
  const [run, setRun] = useState<AgentRun>();
  const [events, setEvents] = useState<RunEvent[] | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const latest = (await api.getRuns(entityRef, 1))[0];
      if (!latest) {
        if (alive) setEvents([]);
        return;
      }
      const timeline = latest.events ?? await api.getRunTimeline(entityRef, latest.runId) ?? [];
      if (alive) {
        setRun(latest);
        setEvents(timeline);
      }
    })().catch(() => alive && setEvents([]));
    return () => { alive = false; };
  }, [api, entityRef, nonce]);

  useEffect(() => {
    if (!pollMs || run?.state !== 'running') return undefined;
    const timer = setInterval(() => setNonce(value => value + 1), pollMs);
    return () => clearInterval(timer);
  }, [pollMs, run?.state]);

  if (events === null) return <CircularProgress size={20} />;
  if (!events.length) return null;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton size="small" title="Refresh" onClick={() => setNonce(value => value + 1)}>
          <RefreshIcon fontSize="inherit" />
        </IconButton>
      </Box>
      <RunTimelineView run={run} events={events} />
    </Box>
  );
};
