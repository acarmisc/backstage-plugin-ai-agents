import React, { useMemo, useState } from 'react';
import {
  Alert,
  ButtonIcon,
  Flex,
  Grid,
  Skeleton,
  Text,
  ToggleButton,
  ToggleButtonGroup,
} from '@backstage/ui';
import { RiRefreshLine } from '@remixicon/react';
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

/** @public */
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
 *
 * @public
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
    <Flex direction="column" gap="5" style={{ minWidth: 0 }}>
      <Flex
        align="center"
        justify="between"
        gap="4"
        style={{ flexWrap: 'wrap' }}
      >
        <Flex align="center" gap="3" style={{ minWidth: 0 }}>
          {!embedded && (
            <AgentAvatar
              name={title ?? telemetryId}
              avatarUrl={avatarUrl}
              size={40}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <Text as="h2" variant="title-x-small" weight="bold" truncate>
              {title ?? telemetryId}
            </Text>
            <Flex align="center" gap="2">
              <StatusPill state={aggregate} size="small" />
              <Text variant="body-small" color="secondary">
                {telemetryId}
              </Text>
            </Flex>
          </div>
        </Flex>
        <Flex align="center" gap="2">
          <ButtonIcon
            aria-label="Refresh"
            variant="tertiary"
            size="small"
            icon={<RiRefreshLine size={16} />}
            onPress={() => {
              refreshRuns();
              refreshInsights();
            }}
          />
          {onHoursChange && (
            <ToggleButtonGroup
              aria-label="Time window"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[String(hours)]}
              onSelectionChange={keys => {
                const [key] = Array.from(keys);
                if (key !== undefined) onHoursChange(Number(key));
              }}
            >
              {[6, 24, 72].map(h => (
                <ToggleButton key={h} id={String(h)} size="small">
                  {h}h
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Flex>
      </Flex>

      {insightsError && !insights && (
        <Alert
          status="warning"
          title="Statistics are temporarily unavailable"
        />
      )}

      <Grid.Root
        gap="4"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
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
      </Grid.Root>

      {runs && (
        <LiveRuns runs={runs} selectedRunId={runId} onSelect={setRunId} />
      )}

      <Grid.Root
        gap="5"
        style={{
          alignItems: 'start',
          // Run detail sits beside the list when there is room for both.
          gridTemplateColumns: hasRunDetail
            ? 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))'
            : 'minmax(0, 1fr)',
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
      </Grid.Root>

      <Grid.Root
        gap="5"
        style={{
          alignItems: 'start',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
        }}
      >
        <SectionCard
          title="Runs per hour"
          subtitle={`last ${hours}h · failures in red`}
        >
          {insights ? (
            <HourlyBars buckets={insights.histogram} height={150} />
          ) : (
            <Skeleton height={150} rounded />
          )}
        </SectionCard>
        <SectionCard title="Tools" subtitle="calls, errors and latency">
          {insights ? (
            <ToolBars tools={insights.tools} />
          ) : (
            <Skeleton height={150} rounded />
          )}
        </SectionCard>
      </Grid.Root>
    </Flex>
  );
}
