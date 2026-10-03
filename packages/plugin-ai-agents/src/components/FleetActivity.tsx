import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { relativeTime, formatDuration } from '../utils/formatting';
import { useFleetActivity } from '../hooks/useFleetActivity';
import { RunTimeline } from './RunTimeline';
import type { AgentActivity, AgentRun } from '../types';

/** Lightweight centered message (kept free of @backstage/core-components so it renders in plain unit tests). */
const Notice: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
    <Typography variant="h6" gutterBottom>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {description}
    </Typography>
  </Box>
);

// Re-export for tests
export { relativeTime, formatDuration } from '../utils/formatting';

/** Status indicator dot with optional pulse animation. */
export const StatusDot: React.FC<{
  state: string;
  'aria-label'?: string;
}> = ({ state, ...props }) => {
  const theme = useTheme();

  const getColor = () => {
    switch (state) {
      case 'running': return theme.palette.info.main;
      case 'completed': return theme.palette.success.main;
      case 'failed': return theme.palette.error.main;
      default: return theme.palette.text.disabled;
    }
  };

  const color = getColor();
  const isRunning = state === 'running';

  return (
    <Box
      sx={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
        animation: isRunning
          ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          : 'none',
        '@keyframes pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          opacity: isRunning ? 0.7 : 1,
        },
      }}
      {...props}
    />
  );
};

/** Inline sparkline SVG showing run durations. */
export const Sparkline: React.FC<{ runs: AgentRun[] }> = ({ runs }) => {
  const theme = useTheme();
  const WIDTH = 120;
  const HEIGHT = 28;
  const PADDING = 2;

  // Get durations for the last 10 runs
  const runData = runs.slice(0, 10).map(run => {
    const start = run.startedAt ? new Date(run.startedAt).getTime() : 0;
    const end = run.updatedAt ? new Date(run.updatedAt).getTime() : start;
    let durationSeconds = (end - start) / 1000;
    // Guard NaN durations
    if (Number.isNaN(durationSeconds) || durationSeconds < 0) {
      durationSeconds = 0;
    }
    return { durationSeconds, failed: run.state === 'failed' };
  });

  if (!runData.length) return null;

  // Find max duration for scaling
  const maxDuration = Math.max(...runData.map(r => r.durationSeconds), 1);
  const scale = (HEIGHT - PADDING * 2) / maxDuration;
  const pointSpacing = (WIDTH - PADDING * 2) / (runData.length - 1 || 1);

  // Build polyline path through all points
  const polylinePath = runData
    .map((run, i) => {
      const x = PADDING + i * pointSpacing;
      const y = HEIGHT - PADDING - run.durationSeconds * scale;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{ display: 'block' }}
      data-testid="sparkline"
    >
      <polyline
        points={polylinePath}
        stroke={theme.palette.info.main}
        strokeWidth="1"
        fill="none"
        opacity={0.5}
      />
      {runData.map((run, i) => {
        const x = PADDING + i * pointSpacing;
        const y = HEIGHT - PADDING - run.durationSeconds * scale;
        const color = run.failed
          ? theme.palette.error.main
          : theme.palette.info.main;
        const radius = run.failed ? 3 : 2;

        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={radius}
            fill={color}
            opacity={0.7}
            data-failed={run.failed ? 'true' : 'false'}
          />
        );
      })}
    </svg>
  );
};

interface ActivityCardProps {
  activity: AgentActivity;
  expanded: boolean;
  onToggle: () => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, expanded, onToggle }) => {
  const latestRun = activity.runs[0];
  const failedCount = activity.runs.filter(r => r.state === 'failed').length;
  const failureRate =
    activity.runs.length > 0
      ? Math.round((failedCount / activity.runs.length) * 100)
      : 0;

  // Format current activity text
  let activityText = 'Idle';
  if (latestRun?.state === 'running') {
    if (latestRun.currentActivity) {
      const target = latestRun.target ? ` · ${latestRun.target}` : '';
      const elapsedMs = latestRun.startedAt
        ? new Date().getTime() - new Date(latestRun.startedAt).getTime()
        : 0;
      const elapsed = formatDuration(elapsedMs);
      activityText = `${latestRun.currentActivity}${target} · running for ${elapsed}`;
    } else {
      const elapsedMs = latestRun.startedAt
        ? new Date().getTime() - new Date(latestRun.startedAt).getTime()
        : 0;
      const elapsed = formatDuration(elapsedMs);
      activityText = `Running · ${elapsed}`;
    }
  } else if (latestRun?.updatedAt) {
    activityText = `Idle · last run ${relativeTime(latestRun.updatedAt)}`;
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      sx={{
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 2 },
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header: Title + Status Dot */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <StatusDot
            state={activity.error ? 'unknown' : (latestRun?.state || 'unknown')}
            aria-label={activity.error ? 'unknown' : (latestRun?.state || 'unknown')}
          />
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {activity.title || activity.entityRef.split('/')[1]}
          </Typography>
        </Box>

        {activity.error ? (
          <Typography color="text.secondary" variant="body2">
            Telemetry unavailable
          </Typography>
        ) : (
          <>
            {/* Activity text */}
            <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 1 }}>
              {activityText}
            </Typography>

            {/* Verdict chip */}
            {latestRun?.verdict && (
              <Box sx={{ mb: 1 }}>
                <Chip
                  label={latestRun.verdict}
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}

            {/* Target and Project info */}
            {(latestRun?.target || latestRun?.project) && (
              <Typography variant="caption" color="text.secondary">
                {[latestRun?.target, latestRun?.project]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            )}
          </>
        )}
      </CardContent>

      {!activity.error && (
        <>
          {/* Sparkline and stats */}
          <Box sx={{ px: 2, pb: 1 }}>
            <Sparkline runs={activity.runs} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5 }}
            >
              {activity.runs.length} runs · {failureRate}% failed
            </Typography>
          </Box>
        </>
      )}

      {/* Expanded: RunTimeline */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
          <RunTimeline entityRef={activity.entityRef} pollMs={5000} />
        </Box>
      </Collapse>
    </Card>
  );
};

export const FleetActivity: React.FC<{ pollMs?: number }> = ({ pollMs = 5000 }) => {
  const { data, loading, error } = useFleetActivity(pollMs, 20);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

  // Loading state: show skeleton cards
  if (loading && !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 2,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton variant="rectangular" height={60} />
                <Skeleton variant="text" sx={{ mt: 1 }} />
                <Skeleton variant="text" />
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    );
  }

  // Error with no data: full error state
  if (error && !data) {
    return (
      <Notice title="Failed to load fleet activity" description={error.message} />
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <Notice title="No fleet activity" description="Agents need the ai-agent.io/telemetry-id annotation and a telemetry module to show activity." />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {error && data && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing last known data - refresh failed
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 2,
        }}
      >
        {data.map(activity => (
          <ActivityCard
            key={activity.entityRef}
            activity={activity}
            expanded={expandedRef === activity.entityRef}
            onToggle={() =>
              setExpandedRef(prev =>
                prev === activity.entityRef ? null : activity.entityRef,
              )
            }
          />
        ))}
      </Box>
    </Box>
  );
};
