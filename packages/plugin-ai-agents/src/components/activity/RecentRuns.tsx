import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Cell,
  CellText,
  Flex,
  SearchField,
  Skeleton,
  Table,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  type ColumnConfig,
} from '@backstage/ui';
import { relativeTime } from '../../utils/formatting';
import { StatusPill } from './StatusPill';
import { formatRunDuration } from './format';
import type { AgentRun, RunState } from '../../types';

export interface RecentRunsProps {
  runs: AgentRun[];
  selectedRunId?: string;
  onSelect?: (runId: string) => void;
  loading?: boolean;
}

type StateFilter = RunState | 'all';
const FILTERS: StateFilter[] = ['all', 'running', 'completed', 'failed'];
const PAGE = 30;

type Row = AgentRun & { id: string };

/** Recent runs in a BUI Table, filterable by state and by text. */
export function RecentRuns({
  runs,
  selectedRunId,
  onSelect,
  loading = false,
}: RecentRunsProps) {
  const [filterState, setFilterState] = useState<StateFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [displayCount, setDisplayCount] = useState(PAGE);

  const counts = useMemo(
    () => ({
      all: runs.length,
      running: runs.filter(r => r.state === 'running').length,
      completed: runs.filter(r => r.state === 'completed').length,
      failed: runs.filter(r => r.state === 'failed').length,
      unknown: runs.filter(r => r.state === 'unknown').length,
    }),
    [runs],
  );

  const filtered = useMemo(() => {
    let result = runs;
    if (filterState !== 'all') {
      result = result.filter(r => r.state === filterState);
    }
    const text = searchText.trim().toLowerCase();
    if (text) {
      result = result.filter(
        r =>
          (r.target?.toLowerCase() ?? '').includes(text) ||
          (r.project?.toLowerCase() ?? '').includes(text) ||
          (r.verdict?.toLowerCase() ?? '').includes(text),
      );
    }
    return result;
  }, [runs, filterState, searchText]);

  const rows: Row[] = useMemo(
    () => filtered.slice(0, displayCount).map(r => ({ ...r, id: r.runId })),
    [filtered, displayCount],
  );

  const columns: ColumnConfig<Row>[] = useMemo(
    () => [
      {
        id: 'status',
        label: 'Status',
        width: 130,
        cell: run => (
          <Cell>
            <StatusPill state={run.state} size="small" />
          </Cell>
        ),
      },
      {
        id: 'target',
        label: 'Target',
        isRowHeader: true,
        defaultWidth: '3fr',
        cell: run => (
          <CellText title={run.target || '—'} description={run.project} />
        ),
      },
      {
        id: 'started',
        label: 'Started',
        width: 110,
        cell: run => (
          <CellText title={relativeTime(run.startedAt)} color="secondary" />
        ),
      },
      {
        id: 'duration',
        label: 'Duration',
        width: 100,
        cell: run => (
          <CellText
            title={
              run.state === 'running' ? 'running…' : formatRunDuration(run)
            }
            color="primary"
          />
        ),
      },
      {
        id: 'verdict',
        label: 'Verdict',
        defaultWidth: '2fr',
        cell: run => (
          <Cell>
            {run.verdict ? <Badge size="small">{run.verdict}</Badge> : null}
          </Cell>
        ),
      },
    ],
    [],
  );

  if (loading && runs.length === 0) {
    return (
      <Flex direction="column" gap="2" p="4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="3">
      <Flex direction="column" gap="3" p="4" pb="0">
        <ToggleButtonGroup
          aria-label="Filter by status"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[filterState]}
          onSelectionChange={keys => {
            const [key] = Array.from(keys);
            if (key !== undefined) {
              setFilterState(key as StateFilter);
              setDisplayCount(PAGE);
            }
          }}
          style={{ flexWrap: 'wrap' }}
        >
          {FILTERS.map(state => (
            <ToggleButton
              key={state}
              id={state}
              size="small"
              data-filter={state}
            >
              {`${state === 'all' ? 'All' : state[0].toUpperCase() + state.slice(1)} · ${counts[state]}`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <SearchField
          aria-label="Filter runs"
          placeholder="Search by target, project or verdict"
          size="small"
          value={searchText}
          onChange={value => {
            setSearchText(value);
            setDisplayCount(PAGE);
          }}
        />
      </Flex>

      <Table<Row>
        columnConfig={columns}
        data={rows}
        pagination={{ type: 'none' }}
        selection={{
          mode: 'single',
          behavior: 'replace',
          selected: selectedRunId ? [selectedRunId] : [],
          onSelectionChange: keys => {
            if (keys === 'all') return;
            const [key] = Array.from(keys);
            if (key !== undefined) onSelect?.(String(key));
          },
        }}
        emptyState={
          <Text as="p" color="secondary" style={{ textAlign: 'center' }}>
            No runs found
          </Text>
        }
      />

      {filtered.length > displayCount && (
        <Flex justify="center" pb="3">
          <Button
            variant="tertiary"
            size="small"
            onPress={() => setDisplayCount(n => n + PAGE)}
          >
            Show more ({filtered.length - displayCount} remaining)
          </Button>
        </Flex>
      )}
    </Flex>
  );
}
