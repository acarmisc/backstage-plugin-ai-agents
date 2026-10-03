import React, { useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ErrorIcon from '@mui/icons-material/Error';
import FlagIcon from '@mui/icons-material/Flag';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { RunEvent } from '../../types';
import { formatMs } from '../../utils/stats';

export interface WaterfallProps {
  events: RunEvent[];
  selectedSeq?: number;
  onSelect?: (seq: number) => void;
}

// ============================================================================
// Helper types and components (defined before main export)
// ============================================================================

interface Timeline {
  startMs: number;
  endMs: number;
  toolEvents: RunEvent[];
}

interface WaterfallRowProps {
  isMarker?: boolean;
  label: string;
  pct: number;
  incomplete?: string;
  theme: Theme;
}

const WaterfallRow: React.FC<WaterfallRowProps> = ({
  isMarker,
  label,
  pct,
  incomplete,
  theme,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        height: '32px',
      }}
    >
      {/* Label */}
      <Typography
        sx={{
          width: '180px',
          flexShrink: 0,
          fontFamily: 'ui-monospace, "Courier New", monospace',
          fontSize: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: theme.palette.text.secondary,
        }}
      >
        {label}
      </Typography>

      {/* Marker or bar */}
      <Box sx={{ flex: 1, position: 'relative', height: '100%' }}>
        {isMarker ? (
          <Box
            sx={{
              position: 'absolute',
              left: `${pct * 100}%`,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FlagIcon
              sx={{
                fontSize: '16px',
                color: theme.palette.text.secondary,
              }}
            />
            {incomplete && (
              <Chip
                label={`incomplete: ${incomplete}`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontSize: '10px' }}
              />
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};

interface WaterfallToolRowProps {
  event: RunEvent;
  timeline: Timeline;
  isSelected: boolean;
  onSelect?: (seq: number) => void;
  theme: Theme;
}

const WaterfallToolRow: React.FC<WaterfallToolRowProps> = ({
  event,
  timeline,
  isSelected,
  onSelect,
  theme,
}) => {
  const handleClick = useCallback(() => {
    onSelect?.(event.seq);
  }, [event.seq, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect?.(event.seq);
      }
    },
    [event.seq, onSelect],
  );

  const isFailed = event.outcome && event.outcome !== 'ok';

  // Compute bar position and width
  const eventTs = event.ts ? new Date(event.ts).getTime() : undefined;
  const durationMs = event.durationMs ?? 0;
  const eventStartMs = eventTs !== undefined ? eventTs - durationMs : undefined;
  const eventEndMs = eventTs;

  let barLeft = 0;
  let barWidth = 3; // Minimum width for visibility

  if (
    eventStartMs !== undefined &&
    eventEndMs !== undefined &&
    timeline.endMs > timeline.startMs
  ) {
    barLeft = ((eventStartMs - timeline.startMs) / (timeline.endMs - timeline.startMs)) * 100;
    barWidth = Math.max(
      3,
      ((eventEndMs - eventStartMs) / (timeline.endMs - timeline.startMs)) * 100,
    );
  }

  // Clamp to visible range
  if (barLeft < 0) barLeft = 0;
  if (barLeft + barWidth > 100) barWidth = 100 - barLeft;

  const toolName = event.tool || event.label || `event_${event.seq}`;

  return (
    <Box
      component="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-current={isSelected ? 'true' : undefined}
      data-left={barLeft}
      data-width={barWidth}
      data-failed={isFailed ? 'true' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        height: '32px',
        padding: '0',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        borderRadius: '4px',
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '2px',
        },
      }}
    >
      {/* Label */}
      <Typography
        sx={{
          width: '180px',
          flexShrink: 0,
          fontFamily: 'ui-monospace, "Courier New", monospace',
          fontSize: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}
        title={toolName}
      >
        {toolName}
      </Typography>

      {/* Bar */}
      <Box sx={{ flex: 1, position: 'relative', height: '100%' }}>
        <Box
          sx={{
            position: 'absolute',
            left: `${barLeft}%`,
            width: `${barWidth}%`,
            height: '100%',
            backgroundColor: isFailed ? theme.palette.error.main : theme.palette.primary.main,
            borderRadius: '3px',
            minWidth: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '4px',
            opacity: isSelected ? 1 : 0.7,
            transition: 'opacity 0.2s ease',
          }}
        >
          {/* Duration text */}
          {barWidth > 20 && (
            <Typography
              sx={{
                fontSize: '10px',
                color: theme.palette.common.white,
                fontFamily: 'ui-monospace, "Courier New", monospace',
              }}
            >
              {formatMs(event.durationMs ?? 0)}
            </Typography>
          )}

          {/* Error icon */}
          {isFailed && (
            <ErrorIcon
              sx={{
                fontSize: '12px',
                marginLeft: '4px',
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ============================================================================
// Main export component
// ============================================================================

/**
 * A Gantt-like waterfall view of tool calls in a run.
 * Shows overlapping tool calls as independent lanes to visualize parallelism.
 * Supports selection and displays run markers (start, completed).
 */
export const Waterfall: React.FC<WaterfallProps> = ({
  events,
  selectedSeq,
  onSelect,
}) => {
  const theme = useTheme();

  // Compute timeline metrics
  const timeline = useMemo(() => {
    // Find start event
    const startEvent = events.find(e => e.event === 'start');
    const completedEvent = events.find(e => e.event === 'completed');

    if (events.length === 0) {
      return { startMs: 0, endMs: 0, toolEvents: [] };
    }

    // Separate tool events from start/completed
    const toolEvents = events.filter(
      e => e.event !== 'start' && e.event !== 'completed' && e.durationMs !== undefined,
    );

    // Compute run bounds
    const startTs = startEvent?.ts ? new Date(startEvent.ts).getTime() : undefined;
    const completedTs = completedEvent?.ts ? new Date(completedEvent.ts).getTime() : undefined;

    let runStartMs: number;
    let runEndMs: number;

    if (startTs !== undefined) {
      runStartMs = startTs;
    } else if (toolEvents.length > 0) {
      // Use earliest tool start (ts - durationMs)
      const toolStarts = toolEvents
        .map(e => {
          const ts = e.ts ? new Date(e.ts).getTime() : undefined;
          return ts !== undefined && e.durationMs !== undefined
            ? ts - e.durationMs
            : undefined;
        })
        .filter((t): t is number => t !== undefined);
      runStartMs = toolStarts.length > 0 ? Math.min(...toolStarts) : 0;
    } else {
      runStartMs = 0;
    }

    if (completedTs !== undefined) {
      runEndMs = completedTs;
    } else if (toolEvents.length > 0) {
      // Use latest tool end (ts)
      const toolEnds = toolEvents
        .map(e => (e.ts ? new Date(e.ts).getTime() : undefined))
        .filter((t): t is number => t !== undefined);
      runEndMs = toolEnds.length > 0 ? Math.max(...toolEnds) : runStartMs;
    } else {
      runEndMs = runStartMs;
    }

    // Sort tool events by start time, then by seq
    const sortedToolEvents = [...toolEvents]
      .map(e => {
        const ts = e.ts ? new Date(e.ts).getTime() : undefined;
        const start =
          ts !== undefined && e.durationMs !== undefined ? ts - e.durationMs : undefined;
        return { event: e, start };
      })
      .sort((a, b) => {
        if (a.start === undefined) return 1;
        if (b.start === undefined) return -1;
        const diff = a.start - b.start;
        if (diff !== 0) return diff;
        return (a.event.seq ?? 0) - (b.event.seq ?? 0);
      })
      .map(({ event }) => event);

    return {
      startMs: runStartMs,
      endMs: Math.max(runEndMs, runStartMs + 1), // Ensure non-zero range
      toolEvents: sortedToolEvents,
    };
  }, [events]);

  if (events.length === 0) {
    return (
      <Box
        sx={{
          padding: '16px',
          color: theme.palette.text.disabled,
          textAlign: 'center',
          fontSize: '14px',
        }}
      >
        No events to display
      </Box>
    );
  }

  const totalDuration = timeline.endMs - timeline.startMs;
  const axisLabels = [0, 0.25, 0.5, 0.75, 1.0].map(pct => ({
    pct,
    label: formatMs(pct * totalDuration),
  }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Time axis */}
      <Box sx={{ display: 'flex', paddingLeft: '180px' }}>
        {axisLabels.map((item, i) => (
          <Box
            key={i}
            sx={{
              flex: i === axisLabels.length - 1 ? '0 1 auto' : 1,
              textAlign: i === 0 ? 'left' : 'center',
              fontSize: '11px',
              color: theme.palette.text.secondary,
            }}
          >
            {item.label}
          </Box>
        ))}
      </Box>

      {/* Waterfall rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Start marker */}
        <WaterfallRow
          isMarker
          label="start"
          pct={0}
          theme={theme}
        />

        {/* Tool events */}
        {timeline.toolEvents.map(event => (
          <WaterfallToolRow
            key={event.seq}
            event={event}
            timeline={timeline}
            isSelected={event.seq === selectedSeq}
            onSelect={onSelect}
            theme={theme}
          />
        ))}

        {/* Completed marker */}
        {(() => {
          const completedEvent = events.find(e => e.event === 'completed');
          if (!completedEvent?.ts) return null;
          const completedMs = new Date(completedEvent.ts).getTime();
          const pct = (completedMs - timeline.startMs) / (timeline.endMs - timeline.startMs);
          return (
            <WaterfallRow
              isMarker
              label="completed"
              pct={Math.min(1, Math.max(0, pct))}
              incomplete={completedEvent.incomplete}
              theme={theme}
            />
          );
        })()}
      </Box>
    </Box>
  );
};
