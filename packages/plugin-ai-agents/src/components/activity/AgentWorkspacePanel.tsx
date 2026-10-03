import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import { AgentAvatar } from '../AgentAvatar';
import { useAgentInsights, useAgentRuns } from '../../hooks/useWorkspaceData';
import { formatMs, formatPct } from '../../utils/stats';
import { toneForSuccessRate } from './format';
import { HourlyBars } from './HourlyBars';
import { KpiTile } from './KpiTile';
import { LiveRuns } from './LiveRuns';
import { RecentRuns } from './RecentRuns';
import { RunDetail } from './RunDetail';
import { SectionCard } from './SectionCard';
import { StatusPill } from './StatusPill';
import { ToolBars } from './ToolBars';
import type { RunState } from '../../types';

export interface AgentWorkspacePanelProps {
  entityRef: string;
  telemetryId: string;
  title?: string;
  avatarUrl?: string;
  /** Hide the avatar header (used when embedded in a page that already has one). */
  embedded?: boolean;
  selectedRunId?: string;
  onSelectRun?: (runId: string | undefined) => void;
  hours?: number;
  onHoursChange?: (h: number) => void;
}

/**
 * Everything about one agent: KPIs, runs in progress, recent runs with the
 * selected run's detail next to them, and the window's charts below.
 * Reusable: the activity workspace and the catalog entity tab both render it.
 */
export function AgentWorkspacePanel({
  entityRef,
  telemetryId,
  title,
  avatarUrl,
  embedded,
  selectedRunId,
  onSelectRun,
  hours = 24,
  onHoursChange,
}: AgentWorkspacePanelProps) {
  const [internalRunId, setInternalRunId] = useState<string | undefined>();
  const controlled = onSelectRun !== undefined;
  const runId = controlled ? selectedRunId : internalRunId;
  const setRunId = controlled ? onSelectRun : setInternalRunId;

  const {
    data: runs,
    loading: runsLoading,
    refresh: refreshRuns,
  } = useAgentRuns(entityRef);
  const {
    data: insights,
    error: insightsError,
    loading: insightsLoading,
    refresh: refreshInsights,
  } = useAgentInsights(entityRef, hours);

  const selectedRun = useMemo(
    () => runs?.find(r => r.runId === runId),
    [runs, runId],
  );
  const runningNow = useMemo(
    () => (runs ?? []).filter(r => r.state === 'running').length,
    [runs],
  );

  const aggregate: RunState =
    runningNow > 0 ? 'running' : (runs?.[0]?.state ?? 'unknown');

  const kpis = useMemo(() => {
    if (!insights) return undefined;
    const finished = insights.totals.completed + insights.totals.failed;
    const rate =
      finished > 0 ? insights.totals.completed / finished : undefined;
    return { rate, trend: insights.histogram.map(b => b.runs) };
  }, [insights]);

  const hasRunDetail = selectedRun !== undefined;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}
        >
          {!embedded && (
            <AgentAvatar
              name={title ?? telemetryId}
              avatarUrl={avatarUrl}
              size={40}
            />
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              noWrap
              sx={{ fontWeight: 600, lineHeight: 1.25 }}
            >
              {title ?? telemetryId}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StatusPill state={aggregate} size="small" />
              <Typography variant="caption" color="text.secondary">
                {telemetryId}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            aria-label="Refresh"
            title="Refresh"
            onClick={() => {
              refreshRuns();
              refreshInsights();
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
          {onHoursChange && (
            <ToggleButtonGroup
              value={hours}
              exclusive
              size="small"
              aria-label="Time window"
              onChange={(_, v) => v !== null && onHoursChange(v)}
            >
              {[6, 24, 72].map(h => (
                <ToggleButton
                  key={h}
                  value={h}
                  sx={{ px: 1.5, py: 0.25, textTransform: 'none' }}
                >
                  {h}h
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Box>
      </Box>

      {insightsError && !insights && (
        <Alert severity="warning">Statistics are temporarily unavailable</Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 2,
        }}
      >
        <KpiTile
          label={`Runs · ${hours}h`}
          value={insights?.totals.runs ?? '—'}
          trend={kpis?.trend}
          loading={insightsLoading && !insights}
        />
        <KpiTile
          label="Success rate"
          value={kpis?.rate === undefined ? '—' : formatPct(kpis.rate)}
          tone={
            kpis?.rate === undefined ? 'default' : toneForSuccessRate(kpis.rate)
          }
          loading={insightsLoading && !insights}
        />
        <KpiTile
          label="Typical run (p50)"
          value={insights ? formatMs(insights.durationMs.p50) : '—'}
          loading={insightsLoading && !insights}
        />
        <KpiTile
          label="Slow run (p95)"
          value={insights ? formatMs(insights.durationMs.p95) : '—'}
          tone={
            insights && insights.durationMs.p95 > insights.durationMs.p50 * 3
              ? 'warning'
              : 'default'
          }
          loading={insightsLoading && !insights}
        />
        <KpiTile
          label="Running now"
          value={runs ? runningNow : '—'}
          tone={runningNow > 0 ? 'info' : 'default'}
          hint={runningNow > 1 ? 'concurrent' : undefined}
          loading={runsLoading && !runs}
        />
      </Box>

      {runs && (
        <LiveRuns runs={runs} selectedRunId={runId} onSelect={setRunId} />
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          alignItems: 'start',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            xl: hasRunDetail
              ? 'minmax(0, 1.15fr) minmax(0, 1fr)'
              : 'minmax(0, 1fr)',
          },
        }}
      >
        <SectionCard title="Recent runs" subtitle="newest first" flush>
          <RecentRuns
            runs={runs ?? []}
            selectedRunId={runId}
            onSelect={setRunId}
            loading={runsLoading}
          />
        </SectionCard>
        {selectedRun && (
          <RunDetail
            entityRef={entityRef}
            run={selectedRun}
            onClose={() => setRunId(undefined)}
          />
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          alignItems: 'start',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'repeat(2, minmax(0, 1fr))',
          },
        }}
      >
        <SectionCard
          title="Runs per hour"
          subtitle={`last ${hours}h · failures in red`}
        >
          {insights ? (
            <HourlyBars buckets={insights.histogram} height={150} />
          ) : (
            <Skeleton variant="rounded" height={150} />
          )}
        </SectionCard>
        <SectionCard title="Tools" subtitle="calls, errors and latency">
          {insights ? (
            <ToolBars tools={insights.tools} />
          ) : (
            <Skeleton variant="rounded" height={150} />
          )}
        </SectionCard>
      </Box>
    </Box>
  );
}
