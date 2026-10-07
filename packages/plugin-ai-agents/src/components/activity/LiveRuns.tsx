import React from 'react';
import { Flex, Grid, Text } from '@backstage/ui';
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

const MONO = 'var(--bui-font-monospace)';

/**
 * Every run currently in progress, side by side. Cards have a fixed size so a
 * run starting or finishing never shifts the others; selection is an outline.
 */
export function LiveRuns({ runs, selectedRunId, onSelect }: LiveRunsProps) {
  const running = runs.filter(r => r.state === 'running');
  const now = useNow(1000, running.length > 0);

  return (
    <SectionCard
      data-testid="live-runs"
      title={
        <>
          Running now{' '}
          <span
            style={{
              color: running.length
                ? 'var(--bui-fg-info)'
                : 'var(--bui-fg-disabled)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {running.length}
          </span>
        </>
      }
      subtitle={running.length > 1 ? 'concurrent executions' : undefined}
    >
      {running.length === 0 ? (
        <Text variant="body-medium" color="secondary">
          No runs in progress
        </Text>
      ) : (
        <Grid.Root
          gap="3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          }}
        >
          {running.map(run => {
            const selected = run.runId === selectedRunId;
            return (
              <button
                key={run.runId}
                type="button"
                data-testid="live-run"
                data-run-id={run.runId}
                aria-pressed={selected}
                onClick={() => onSelect?.(run.runId)}
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  height: 96,
                  padding: 'var(--bui-space-3)',
                  borderRadius: 'var(--bui-radius-3)',
                  border: '1px solid var(--bui-border-info)',
                  background: 'var(--bui-bg-info)',
                  outline: selected
                    ? '2px solid var(--bui-ring)'
                    : '2px solid transparent',
                  outlineOffset: -1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                }}
              >
                <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                  <StatusDot state="running" size={10} />
                  <span
                    title={run.target}
                    style={{
                      fontFamily: MONO,
                      fontWeight: 'var(--bui-font-weight-bold)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--bui-fg-primary)',
                    }}
                  >
                    {run.target || 'run'}
                  </span>
                  <span
                    data-testid="live-elapsed"
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--bui-fg-info)',
                      fontWeight: 'var(--bui-font-weight-bold)',
                    }}
                  >
                    {formatMs(elapsedSince(run.startedAt, now))}
                  </span>
                </Flex>
                <div style={{ minWidth: 0 }}>
                  {run.project && (
                    <Text
                      as="div"
                      variant="body-small"
                      color="secondary"
                      truncate
                      title={run.project}
                    >
                      {run.project}
                    </Text>
                  )}
                  <Text as="div" variant="body-medium" truncate>
                    {run.currentActivity ?? 'working…'}
                  </Text>
                </div>
              </button>
            );
          })}
        </Grid.Root>
      )}
    </SectionCard>
  );
}
