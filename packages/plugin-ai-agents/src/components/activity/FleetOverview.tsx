import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useNow } from '../../hooks/useNow';
import { relativeTime } from '../../utils/formatting';
import { formatMs } from '../../utils/stats';
import { elapsedSince, formatRunDuration } from './format';
import { KpiTile } from './KpiTile';
import { SectionCard } from './SectionCard';
import { StatusDot, StatusPill } from './StatusPill';
import type { AgentActivity, AgentRun } from '../../types';

export interface FleetOverviewProps {
  fleet: AgentActivity[];
  onSelectRun?: (agentTelemetryId: string, runId: string) => void;
}

interface Row {
  agent: AgentActivity;
  run: AgentRun;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const headSx = {
  '& th': {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    color: 'text.secondary',
  },
};

/** Fleet level view: totals, every run in progress across agents, latest runs. */
export const FleetOverview: React.FC<FleetOverviewProps> = ({ fleet, onSelectRun }) => {
  const theme = useTheme();

  const { running, recent, failed, errors } = useMemo(() => {
    const rows: Row[] = fleet.flatMap(agent => agent.runs.map(run => ({ agent, run })));
    const byStart = (a: Row, b: Row) => Date.parse(b.run.startedAt ?? '') - Date.parse(a.run.startedAt ?? '') || 0;
    return {
      running: rows.filter(r => r.run.state === 'running').sort(byStart),
      recent: [...rows].sort(byStart).slice(0, 15),
      failed: rows.filter(r => r.run.state === 'failed').length,
      errors: fleet.filter(a => a.error).length,
    };
  }, [fleet]);

  const now = useNow(1000, running.length > 0);
  const select = (row: Row) => onSelectRun?.(row.agent.telemetryId, row.run.runId);
  const rowSx = {
    height: 48,
    cursor: onSelectRun ? 'pointer' : 'default',
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>All agents</Typography>
        <Typography variant="body2" color="text.secondary">Fleet overview · latest runs of every agent</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 2 }}>
        <KpiTile label="Agents" value={fleet.length} />
        <KpiTile label="Running now" value={running.length} tone={running.length > 0 ? 'info' : 'default'} hint={running.length > 1 ? 'concurrent' : undefined} />
        <KpiTile label="Failed (recent runs)" value={failed} tone={failed > 0 ? 'error' : 'default'} />
        <KpiTile label="Telemetry errors" value={errors} tone={errors > 0 ? 'warning' : 'default'} />
      </Box>

      <SectionCard
        data-testid="fleet-running"
        title={<>Running now <Box component="span" sx={{ ml: 1, color: running.length ? 'info.main' : 'text.disabled' }}>{running.length}</Box></>}
        flush
      >
        {running.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No runs in progress</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={headSx}>
                <TableCell sx={{ width: 180 }}>Agent</TableCell>
                <TableCell sx={{ width: 220 }}>Target</TableCell>
                <TableCell sx={{ width: 100 }}>Elapsed</TableCell>
                <TableCell>Doing</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {running.map(row => (
                <TableRow
                  key={row.run.runId}
                  data-testid="fleet-running-row"
                  tabIndex={0}
                  onClick={() => select(row)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      select(row);
                    }
                  }}
                  sx={{ ...rowSx, backgroundColor: alpha(theme.palette.info.main, 0.04) }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StatusDot state="running" size={9} />
                      <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>{row.agent.title ?? row.agent.telemetryId}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography noWrap sx={{ fontFamily: MONO, fontSize: 13 }}>{row.run.target ?? '—'}</Typography>
                    {row.run.project && <Typography noWrap variant="caption" color="text.secondary">{row.run.project}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: 'info.main', fontWeight: 600 }}>
                    {formatMs(elapsedSince(row.run.startedAt, now))}
                  </TableCell>
                  <TableCell><Typography noWrap sx={{ fontSize: 13 }}>{row.run.currentActivity ?? 'working…'}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Recent runs" subtitle="across all agents" flush>
        {recent.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No runs yet</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={headSx}>
                <TableCell sx={{ width: 180 }}>Agent</TableCell>
                <TableCell sx={{ width: 130 }}>Status</TableCell>
                <TableCell sx={{ width: 220 }}>Target</TableCell>
                <TableCell sx={{ width: 110 }}>Started</TableCell>
                <TableCell sx={{ width: 90 }}>Duration</TableCell>
                <TableCell>Verdict</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recent.map(row => (
                <TableRow
                  key={row.run.runId}
                  data-testid="fleet-recent-row"
                  tabIndex={0}
                  onClick={() => select(row)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      select(row);
                    }
                  }}
                  sx={rowSx}
                >
                  <TableCell><Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>{row.agent.title ?? row.agent.telemetryId}</Typography></TableCell>
                  <TableCell><StatusPill state={row.run.state} size="small" /></TableCell>
                  <TableCell><Typography noWrap sx={{ fontFamily: MONO, fontSize: 13 }}>{row.run.target ?? '—'}</Typography></TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{relativeTime(row.run.startedAt)}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.run.state === 'running' ? 'running…' : formatRunDuration(row.run)}</TableCell>
                  <TableCell><Typography noWrap sx={{ fontSize: 13 }}>{row.run.verdict ?? ''}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </Box>
  );
};
