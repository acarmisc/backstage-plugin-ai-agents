import React, { useMemo, useCallback } from 'react';
import { Badge, Text } from '@backstage/ui';
import { RiFlagLine } from '@remixicon/react';
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
}

const LABEL: React.CSSProperties = {
  width: 180,
  flexShrink: 0,
  fontFamily: 'var(--bui-font-monospace)',
  fontSize: 'var(--bui-font-size-2)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
};

function WaterfallRow({ label, pct, incomplete }: WaterfallRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 32 }}>
      <span style={{ ...LABEL, color: 'var(--bui-fg-secondary)' }}>
        {label}
      </span>
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        <div
          style={{
            position: 'absolute',
            left: `${pct * 100}%`,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--bui-fg-secondary)',
          }}
        >
          <RiFlagLine size={16} aria-hidden />
          {incomplete && (
            <Badge size="small">{`incomplete: ${incomplete}`}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface WaterfallToolRowProps {
  event: RunEvent;
  timeline: Timeline;
  isSelected: boolean;
  onSelect?: (seq: number) => void;
}

function WaterfallToolRow({
  event,
  timeline,
  isSelected,
  onSelect,
}: WaterfallToolRowProps) {
  const handleClick = useCallback(() => {
    onSelect?.(event.seq);
  }, [event.seq, onSelect]);

  const isFailed = event.outcome && event.outcome !== 'ok';

  // Compute bar position and width
  const eventTs = event.ts ? new Date(event.ts).getTime() : undefined;
  const durationMs = event.durationMs ?? 0;
  const eventStartMs = eventTs !== undefined ? eventTs - durationMs : undefined;
  const eventEndMs = eventTs;

  let barLeft = 0;
  let barWidth = 0.5; // Minimum width in % (CSS minWidth keeps it visible)

  if (
    eventStartMs !== undefined &&
    eventEndMs !== undefined &&
    timeline.endMs > timeline.startMs
  ) {
    barLeft =
      ((eventStartMs - timeline.startMs) /
        (timeline.endMs - timeline.startMs)) *
      100;
    barWidth = Math.max(
      0.5,
      ((eventEndMs - eventStartMs) / (timeline.endMs - timeline.startMs)) * 100,
    );
  }

  // Clamp to visible range
  if (barLeft < 0) barLeft = 0;
  if (barLeft + barWidth > 100) barWidth = 100 - barLeft;

  const toolName = event.tool || event.label || `event_${event.seq}`;
  const tone = isFailed ? 'var(--bui-fg-danger)' : 'var(--bui-fg-primary)';
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isSelected ? 'true' : undefined}
      data-left={barLeft}
      data-width={barWidth}
      data-failed={isFailed ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 32,
        padding: 0,
        border: 'none',
        background: isSelected ? 'var(--bui-bg-neutral-2)' : 'transparent',
        cursor: 'pointer',
        borderRadius: 'var(--bui-radius-2)',
        font: 'inherit',
      }}
    >
      <span title={toolName} style={{ ...LABEL, color: tone }}>
        {toolName}
      </span>
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        <div
          style={{
            position: 'absolute',
            left: `${barLeft}%`,
            width: `${barWidth}%`,
            top: '50%',
            height: 14,
            transform: 'translateY(-50%)',
            background: isFailed
              ? 'var(--bui-fg-danger)'
              : 'var(--bui-bg-solid)',
            borderRadius: 7,
            minWidth: 5,
            opacity: isSelected ? 1 : 0.8,
            outline: isSelected ? '2px solid var(--bui-ring)' : 'none',
          }}
        />
        {/* Duration beside the bar (left of it when the bar nears the right edge) */}
        <span
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            whiteSpace: 'nowrap',
            fontSize: 'var(--bui-font-size-1)',
            fontVariantNumeric: 'tabular-nums',
            color: isFailed
              ? 'var(--bui-fg-danger)'
              : 'var(--bui-fg-secondary)',
            ...(barLeft + barWidth < 85
              ? { left: `calc(${barLeft + barWidth}% + 8px)` }
              : { right: `calc(${100 - barLeft}% + 8px)` }),
          }}
        >
          {isFailed ? 'error · ' : ''}
          {formatMs(event.durationMs ?? 0)}
        </span>
      </div>
    </button>
  );
}

// ============================================================================
// Main export component
// ============================================================================

/**
 * A Gantt-like waterfall view of tool calls in a run.
 * Shows overlapping tool calls as independent lanes to visualize parallelism.
 * Supports selection and displays run markers (start, completed).
 */
export function Waterfall({ events, selectedSeq, onSelect }: WaterfallProps) {
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
      e =>
        e.event !== 'start' &&
        e.event !== 'completed' &&
        e.durationMs !== undefined,
    );

    // Compute run bounds
    const startTs = startEvent?.ts
      ? new Date(startEvent.ts).getTime()
      : undefined;
    const completedTs = completedEvent?.ts
      ? new Date(completedEvent.ts).getTime()
      : undefined;

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
          ts !== undefined && e.durationMs !== undefined
            ? ts - e.durationMs
            : undefined;
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
      <Text
        as="div"
        variant="body-medium"
        color="secondary"
        style={{ padding: 16, textAlign: 'center' }}
      >
        No events to display
      </Text>
    );
  }

  const totalDuration = timeline.endMs - timeline.startMs;
  const axisLabels = [0, 0.25, 0.5, 0.75, 1.0].map(pct => ({
    pct,
    label: formatMs(pct * totalDuration),
  }));
  const completedEvent = events.find(e => e.event === 'completed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Time axis */}
      <div style={{ display: 'flex', paddingLeft: 192 }}>
        {axisLabels.map((item, i) => (
          <Text
            key={i}
            as="div"
            variant="body-x-small"
            color="secondary"
            style={{
              flex: i === axisLabels.length - 1 ? '0 1 auto' : 1,
              textAlign: i === 0 ? 'left' : 'center',
            }}
          >
            {item.label}
          </Text>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <WaterfallRow isMarker label="start" pct={0} />
        {timeline.toolEvents.map(event => (
          <WaterfallToolRow
            key={event.seq}
            event={event}
            timeline={timeline}
            isSelected={event.seq === selectedSeq}
            onSelect={onSelect}
          />
        ))}
        {completedEvent?.ts && (
          <WaterfallRow
            isMarker
            label="completed"
            pct={Math.min(
              1,
              Math.max(
                0,
                (new Date(completedEvent.ts).getTime() - timeline.startMs) /
                  (timeline.endMs - timeline.startMs),
              ),
            )}
            incomplete={completedEvent.incomplete}
          />
        )}
      </div>
    </div>
  );
}
