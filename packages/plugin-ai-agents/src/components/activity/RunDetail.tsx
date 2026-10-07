import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  ButtonIcon,
  Flex,
  Grid,
  Skeleton,
  Text,
} from '@backstage/ui';
import { RiCloseLine } from '@remixicon/react';
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

function Fact({
  label,
  children,
  title,
}: {
  label: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div style={{ minWidth: 0 }} title={title}>
      <Text as="div" variant="body-small" color="secondary">
        {label}
      </Text>
      <Text
        as="div"
        variant="body-medium"
        weight="bold"
        truncate
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {children}
      </Text>
    </div>
  );
}

/** One run: facts, parallelism, and the waterfall of its tool calls. */
export function RunDetail({ entityRef, run, onClose }: RunDetailProps) {
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
    <div ref={ref}>
      <SectionCard
        data-testid="run-detail"
        title={
          <Flex align="center" gap="2" style={{ display: 'inline-flex' }}>
            <StatusPill state={run.state} size="small" />
            <span style={{ fontFamily: 'var(--bui-font-monospace)' }}>
              {run.target ?? run.runId.slice(0, 8)}
            </span>
          </Flex>
        }
        subtitle={run.project}
        action={
          onClose && (
            <ButtonIcon
              variant="tertiary"
              size="small"
              aria-label="Close run details"
              icon={<RiCloseLine size={16} />}
              onPress={onClose}
            />
          )
        }
      >
        <Flex direction="column" gap="3">
          <Grid.Root
            gap="4"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))',
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
              <span
                style={{
                  color: stats.errors > 0 ? 'var(--bui-fg-danger)' : undefined,
                }}
              >
                {events ? stats.errors : '—'}
              </span>
            </Fact>
            <Fact label="Max parallel">{events ? stats.parallel : '—'}</Fact>
          </Grid.Root>

          {run.verdict && (
            <Text as="p" variant="body-medium">
              <Text as="span" color="secondary">
                Verdict ·{' '}
              </Text>
              {run.verdict}
            </Text>
          )}
          {stats.incomplete && (
            <Alert
              status="warning"
              title={`Run did not complete: ${stats.incomplete}`}
            />
          )}

          {loading && !events && <Skeleton height={160} rounded />}
          {error && !events && (
            <Alert
              status="danger"
              title="Could not load the timeline"
              customActions={
                <Button size="small" variant="secondary" onPress={refresh}>
                  Retry
                </Button>
              }
            />
          )}
          {events && events.length === 0 && (
            <Text as="p" variant="body-medium" color="secondary">
              No events recorded for this run
            </Text>
          )}
          {events && events.length > 0 && (
            <>
              <Waterfall
                events={events}
                selectedSeq={selectedSeq}
                onSelect={setSelectedSeq}
              />
              {stats.selected && (
                <div
                  data-testid="tool-detail"
                  style={{
                    padding: 'var(--bui-space-2) var(--bui-space-3)',
                    borderRadius: 'var(--bui-radius-3)',
                    background: 'var(--bui-bg-neutral-2)',
                    fontSize: 'var(--bui-font-size-3)',
                  }}
                >
                  <strong>{stats.selected.tool}</strong>
                  {' · '}
                  {formatMs(stats.selected.durationMs ?? 0)}
                  {' · '}
                  <span
                    style={{
                      color:
                        stats.selected.outcome === 'ok'
                          ? 'var(--bui-fg-success)'
                          : 'var(--bui-fg-danger)',
                    }}
                  >
                    {stats.selected.outcome ?? 'ok'}
                  </span>
                </div>
              )}
            </>
          )}
        </Flex>
      </SectionCard>
    </div>
  );
}
