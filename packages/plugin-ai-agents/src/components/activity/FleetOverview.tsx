import React, { useMemo } from 'react';
import {
  Cell,
  CellText,
  Flex,
  Grid,
  Table,
  Text,
  type ColumnConfig,
} from '@backstage/ui';
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
  id: string;
  agent: AgentActivity;
  run: AgentRun;
}

const agentName = (row: Row) => row.agent.title ?? row.agent.telemetryId;

/** Fleet level view: totals, every run in progress across agents, latest runs. */
export function FleetOverview({ fleet, onSelectRun }: FleetOverviewProps) {
  const { running, recent, failed, errors } = useMemo(() => {
    const rows: Row[] = fleet.flatMap(agent =>
      agent.runs.map(run => ({ id: run.runId, agent, run })),
    );
    const byStart = (a: Row, b: Row) =>
      Date.parse(b.run.startedAt ?? '') - Date.parse(a.run.startedAt ?? '') ||
      0;
    return {
      running: rows.filter(r => r.run.state === 'running').sort(byStart),
      recent: [...rows].sort(byStart).slice(0, 15),
      failed: rows.filter(r => r.run.state === 'failed').length,
      errors: fleet.filter(a => a.error).length,
    };
  }, [fleet]);

  const now = useNow(1000, running.length > 0);
  const rowConfig = onSelectRun
    ? {
        onClick: (row: Row) =>
          onSelectRun(row.agent.telemetryId, row.run.runId),
      }
    : undefined;

  const runningColumns: ColumnConfig<Row>[] = [
    {
      id: 'agent',
      label: 'Agent',
      isRowHeader: true,
      defaultWidth: '2fr',
      cell: row => (
        <Cell>
          <Flex align="center" gap="2">
            <StatusDot state="running" size={9} />
            <Text variant="body-medium" weight="bold" truncate>
              {agentName(row)}
            </Text>
          </Flex>
        </Cell>
      ),
    },
    {
      id: 'target',
      label: 'Target',
      defaultWidth: '2fr',
      cell: row => (
        <CellText title={row.run.target ?? '—'} description={row.run.project} />
      ),
    },
    {
      id: 'elapsed',
      label: 'Elapsed',
      width: 100,
      cell: row => (
        <CellText title={formatMs(elapsedSince(row.run.startedAt, now))} />
      ),
    },
    {
      id: 'doing',
      label: 'Doing',
      defaultWidth: '3fr',
      cell: row => <CellText title={row.run.currentActivity ?? 'working…'} />,
    },
  ];

  const recentColumns: ColumnConfig<Row>[] = [
    {
      id: 'agent',
      label: 'Agent',
      isRowHeader: true,
      defaultWidth: '2fr',
      cell: row => <CellText title={agentName(row)} />,
    },
    {
      id: 'status',
      label: 'Status',
      width: 130,
      cell: row => (
        <Cell>
          <StatusPill state={row.run.state} size="small" />
        </Cell>
      ),
    },
    {
      id: 'target',
      label: 'Target',
      defaultWidth: '2fr',
      cell: row => <CellText title={row.run.target ?? '—'} />,
    },
    {
      id: 'started',
      label: 'Started',
      width: 110,
      cell: row => (
        <CellText title={relativeTime(row.run.startedAt)} color="secondary" />
      ),
    },
    {
      id: 'duration',
      label: 'Duration',
      width: 100,
      cell: row => (
        <CellText
          title={
            row.run.state === 'running'
              ? 'running…'
              : formatRunDuration(row.run)
          }
        />
      ),
    },
    {
      id: 'verdict',
      label: 'Verdict',
      defaultWidth: '2fr',
      cell: row => <CellText title={row.run.verdict ?? ''} />,
    },
  ];

  return (
    <Flex direction="column" gap="5" style={{ minWidth: 0 }}>
      <div>
        <Text as="h2" variant="title-x-small" weight="bold">
          All agents
        </Text>
        <Text as="p" variant="body-medium" color="secondary">
          Fleet overview · latest runs of every agent
        </Text>
      </div>

      <Grid.Root
        gap="4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}
      >
        <KpiTile label="Agents" value={fleet.length} />
        <KpiTile
          label="Running now"
          value={running.length}
          tone={running.length > 0 ? 'info' : 'default'}
          hint={running.length > 1 ? 'concurrent' : undefined}
        />
        <KpiTile
          label="Failed (recent runs)"
          value={failed}
          tone={failed > 0 ? 'error' : 'default'}
        />
        <KpiTile
          label="Telemetry errors"
          value={errors}
          tone={errors > 0 ? 'warning' : 'default'}
        />
      </Grid.Root>

      <SectionCard
        data-testid="fleet-running"
        title={
          <>
            Running now{' '}
            <span
              style={{
                color: running.length
                  ? 'var(--bui-fg-info)'
                  : 'var(--bui-fg-disabled)',
              }}
            >
              {running.length}
            </span>
          </>
        }
        flush
      >
        {running.length === 0 ? (
          <Text
            as="p"
            variant="body-medium"
            color="secondary"
            style={{ padding: 'var(--bui-space-4)' }}
          >
            No runs in progress
          </Text>
        ) : (
          <Table<Row>
            columnConfig={runningColumns}
            data={running}
            pagination={{ type: 'none' }}
            rowConfig={rowConfig}
          />
        )}
      </SectionCard>

      <SectionCard title="Recent runs" subtitle="across all agents" flush>
        {recent.length === 0 ? (
          <Text
            as="p"
            variant="body-medium"
            color="secondary"
            style={{ padding: 'var(--bui-space-4)' }}
          >
            No runs yet
          </Text>
        ) : (
          <Table<Row>
            columnConfig={recentColumns}
            data={recent}
            pagination={{ type: 'none' }}
            rowConfig={rowConfig}
          />
        )}
      </SectionCard>
    </Flex>
  );
}
