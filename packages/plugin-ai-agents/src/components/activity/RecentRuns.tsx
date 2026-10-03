import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
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

/**
 * Displays recent runs in a filterable MUI Table.
 * Supports filtering by status and text search on target/project/verdict.
 */
export function RecentRuns({
  runs,
  selectedRunId,
  onSelect,
  loading = false,
}: RecentRunsProps) {
  const theme = useTheme();
  const [filterState, setFilterState] = useState<RunState | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [displayCount, setDisplayCount] = useState(30);

  // Count runs by state
  const stateCounts = useMemo(() => {
    return {
      all: runs.length,
      running: runs.filter(r => r.state === 'running').length,
      completed: runs.filter(r => r.state === 'completed').length,
      failed: runs.filter(r => r.state === 'failed').length,
    };
  }, [runs]);

  // Filter runs
  const filtered = useMemo(() => {
    let result = runs;

    // State filter
    if (filterState !== 'all') {
      result = result.filter(r => r.state === filterState);
    }

    // Text search
    if (searchText.trim()) {
      const lowerText = searchText.toLowerCase();
      result = result.filter(
        r =>
          (r.target?.toLowerCase() ?? '').includes(lowerText) ||
          (r.project?.toLowerCase() ?? '').includes(lowerText) ||
          (r.verdict?.toLowerCase() ?? '').includes(lowerText),
      );
    }

    return result;
  }, [runs, filterState, searchText]);

  const displayedRuns = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  if (loading && runs.length === 0) {
    return (
      <Box sx={{ my: 3 }}>
        <Skeleton variant="text" width={100} height={24} />
        <Box sx={{ mt: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={44}
              sx={{ my: 0.5 }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          p: 1.5,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {['all', 'running', 'completed', 'failed'].map(state => (
          <Chip
            key={state}
            label={`${state === 'all' ? 'All' : state.charAt(0).toUpperCase() + state.slice(1)} · ${
              (stateCounts as any)[state]
            }`}
            onClick={() => setFilterState(state as any)}
            color={filterState === state ? 'primary' : 'default'}
            variant={filterState === state ? 'filled' : 'outlined'}
            size="small"
            data-filter={state}
            aria-pressed={filterState === state}
          />
        ))}
      </Box>

      {/* Search box */}
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <input
          aria-label="Filter runs"
          type="text"
          placeholder="Search by target, project, or verdict..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            fontFamily: 'inherit',
            fontSize: '14px',
          }}
        />
      </Box>

      {/* Table */}
      {displayedRuns.length > 0 ? (
        <TableContainer
          sx={{
            borderTop: `1px solid ${theme.palette.divider}`,
            maxHeight: 560,
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    color: 'text.secondary',
                    backgroundColor: theme.palette.background.paper,
                  },
                }}
              >
                <TableCell sx={{ width: 120 }}>Status</TableCell>
                <TableCell>Target</TableCell>
                <TableCell sx={{ width: 100 }}>Started</TableCell>
                <TableCell sx={{ width: 90 }}>Duration</TableCell>
                <TableCell>Verdict</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedRuns.map(run => {
                const isSelected = run.runId === selectedRunId;
                const startedTime = run.startedAt
                  ? new Date(run.startedAt)
                  : null;
                const absoluteTime = startedTime?.toLocaleString() ?? '';

                return (
                  <TableRow
                    key={run.runId}
                    tabIndex={0}
                    onClick={() => onSelect?.(run.runId)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect?.(run.runId);
                      }
                    }}
                    aria-selected={isSelected}
                    sx={{
                      height: 52,
                      cursor: 'pointer',
                      backgroundColor: isSelected
                        ? alpha(theme.palette.primary.main, 0.08)
                        : 'inherit',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.5),
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: '-1px',
                      },
                    }}
                  >
                    <TableCell>
                      <StatusPill state={run.state} size="small" />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          noWrap
                          sx={{
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          {run.target || '—'}
                        </Typography>
                        {run.project && (
                          <Typography
                            noWrap
                            title={run.project}
                            sx={{
                              fontSize: '12px',
                              color: theme.palette.text.secondary,
                            }}
                          >
                            {run.project}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell title={absoluteTime}>
                      <Typography
                        sx={{ fontSize: '13px', color: 'text.secondary' }}
                      >
                        {relativeTime(run.startedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        sx={{
                          fontSize: '13px',
                          fontVariantNumeric: 'tabular-nums',
                          color:
                            run.state === 'running'
                              ? 'info.main'
                              : 'text.primary',
                        }}
                      >
                        {run.state === 'running'
                          ? 'running…'
                          : formatRunDuration(run)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {run.verdict && (
                        <Chip
                          label={run.verdict}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography
          sx={{
            py: 3,
            color: theme.palette.text.secondary,
            textAlign: 'center',
          }}
        >
          No runs found
        </Typography>
      )}

      {/* Show more button */}
      {hasMore && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            onClick={() => setDisplayCount(prev => prev + 30)}
            size="small"
          >
            Show more ({filtered.length - displayCount} remaining)
          </Button>
        </Box>
      )}
    </Box>
  );
}
