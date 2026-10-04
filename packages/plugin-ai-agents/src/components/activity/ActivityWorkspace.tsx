import React, { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useSearchParams } from 'react-router-dom';
import { useAvatarSrc } from '../../hooks/useAvatarBlob';
import { useFleetActivity } from '../../hooks/useFleetActivity';
import { AgentRail } from './AgentRail';
import { AgentWorkspacePanel } from './AgentWorkspacePanel';
import { FleetOverview } from './FleetOverview';

const HOURS = [6, 24, 72];
const ALL = '__all__';

/**
 * Master-detail workspace: agents in a left rail, the selected agent (or the
 * fleet overview) in the body. Selection lives in the URL so views can be
 * shared and the back button works: `agent` (telemetry id), `run`, `hours`.
 * Below the `md` breakpoint the rail becomes a select.
 *
 * @public
 */
export function ActivityWorkspace() {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const [params, setParams] = useSearchParams();
  const { data: fleet, error, loading, refresh } = useFleetActivity(5000, 30);

  const agentParam = params.get('agent') ?? undefined;
  const runParam = params.get('run') ?? undefined;
  const requestedHours = Number(params.get('hours'));
  const hours = HOURS.includes(requestedHours) ? requestedHours : 24;

  const selected = useMemo(
    () =>
      agentParam ? fleet?.find(a => a.telemetryId === agentParam) : undefined,
    [fleet, agentParam],
  );
  const selectedAvatar = useAvatarSrc(selected?.entityRef, selected?.avatarUrl);

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next);
  };
  const selectAgent = (telemetryId: string | undefined) =>
    update(next => {
      next.delete('run');
      if (telemetryId) next.set('agent', telemetryId);
      else next.delete('agent');
    });
  const selectRun = (runId: string | undefined) =>
    update(next => {
      if (runId) next.set('run', runId);
      else next.delete('run');
    });
  const selectFleetRun = (telemetryId: string, runId: string) =>
    update(next => {
      next.set('agent', telemetryId);
      next.set('run', runId);
    });
  const changeHours = (h: number) =>
    update(next => next.set('hours', String(h)));

  if (!fleet && loading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : '300px 1fr',
          gap: 3,
        }}
        aria-busy="true"
      >
        {!compact && <Skeleton variant="rounded" height={420} />}
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Skeleton variant="rounded" height={96} />
          <Skeleton variant="rounded" height={160} />
          <Skeleton variant="rounded" height={280} />
        </Box>
      </Box>
    );
  }

  if (!fleet) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={refresh}>
            Retry
          </Button>
        }
      >
        Failed to load fleet activity{error ? `: ${error.message}` : ''}
      </Alert>
    );
  }

  const body = selected ? (
    <AgentWorkspacePanel
      key={selected.telemetryId}
      entityRef={selected.entityRef}
      telemetryId={selected.telemetryId}
      title={selected.title}
      avatarUrl={selectedAvatar}
      selectedRunId={runParam}
      onSelectRun={selectRun}
      hours={hours}
      onHoursChange={changeHours}
    />
  ) : (
    <FleetOverview fleet={fleet} onSelectRun={selectFleetRun} />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && (
        <Alert severity="warning">
          Showing last known data — the latest refresh failed
        </Alert>
      )}
      {fleet.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
          <Box sx={{ typography: 'h6', mb: 1 }}>No fleet activity</Box>
          <Box sx={{ typography: 'body2', color: 'text.secondary' }}>
            Agents need the ai-agent.io/telemetry-id annotation and a telemetry
            module to show activity.
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: compact
              ? 'minmax(0, 1fr)'
              : '300px minmax(0, 1fr)',
            gap: compact ? 2 : 3,
            alignItems: 'start',
          }}
        >
          {compact ? (
            <Select
              size="small"
              fullWidth
              value={selected?.telemetryId ?? ALL}
              onChange={e =>
                selectAgent(
                  e.target.value === ALL ? undefined : String(e.target.value),
                )
              }
              inputProps={{ 'aria-label': 'Agent' }}
            >
              <MenuItem value={ALL}>All agents</MenuItem>
              {[...fleet]
                .sort((a, b) =>
                  (a.title ?? a.telemetryId).localeCompare(
                    b.title ?? b.telemetryId,
                  ),
                )
                .map(a => (
                  <MenuItem key={a.telemetryId} value={a.telemetryId}>
                    {a.title ?? a.telemetryId}
                  </MenuItem>
                ))}
            </Select>
          ) : (
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                maxHeight: 'calc(100vh - 160px)',
                minHeight: 320,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <AgentRail
                fleet={fleet}
                selectedTelemetryId={selected?.telemetryId}
                onSelectAgent={selectAgent}
              />
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>{body}</Box>
        </Box>
      )}
    </Box>
  );
}
