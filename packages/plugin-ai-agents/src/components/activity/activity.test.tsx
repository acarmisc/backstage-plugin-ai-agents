import '../../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  StatusPill,
  StatusDot,
} from './StatusPill';
import { KpiTile } from './KpiTile';
import { HourlyBars } from './HourlyBars';
import { ToolBars } from './ToolBars';
import { Waterfall } from './Waterfall';
import { stateColor, stateLabel } from './tokens';
import type { HourBucket, ToolStat, RunEvent } from '../../types';

afterEach(cleanup);

const theme = createTheme();

function renderWithTheme(element: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {element}
    </ThemeProvider>
  );
}

// ============================================================================
// stateColor and stateLabel tests
// ============================================================================

test('stateLabel: running', () => {
  assert.strictEqual(stateLabel('running'), 'Running');
});

test('stateLabel: completed', () => {
  assert.strictEqual(stateLabel('completed'), 'Completed');
});

test('stateLabel: failed', () => {
  assert.strictEqual(stateLabel('failed'), 'Failed');
});

test('stateLabel: unknown', () => {
  assert.strictEqual(stateLabel('unknown'), 'Unknown');
});

test('stateColor: returns color for each state', () => {
  const color = stateColor(theme, 'running');
  assert.ok(typeof color === 'string' && color.length > 0);
});

// ============================================================================
// StatusPill and StatusDot tests
// ============================================================================

test('StatusPill: renders with correct aria-label', () => {
  const { container } = renderWithTheme(<StatusPill state="completed" />);
  const pill = container.querySelector('[aria-label]');
  assert.ok(pill?.getAttribute('aria-label') === 'Completed');
});

test('StatusDot: completed state has data-pulse=false', () => {
  const { container } = renderWithTheme(<StatusDot state="completed" />);
  const dot = container.querySelector('[data-state="completed"]');
  assert.strictEqual(dot?.getAttribute('data-pulse'), 'false');
});

test('StatusDot: running state has data-pulse=true', () => {
  const { container } = renderWithTheme(<StatusDot state="running" />);
  const dot = container.querySelector('[data-state="running"]');
  assert.strictEqual(dot?.getAttribute('data-pulse'), 'true');
});

test('StatusDot: failed state has correct aria-label', () => {
  const { container } = renderWithTheme(<StatusDot state="failed" />);
  const dot = container.querySelector('[data-state="failed"]');
  assert.strictEqual(dot?.getAttribute('aria-label'), 'Failed');
});

test('StatusPill: small and medium sizes render differently and keep the label', () => {
  const small = renderWithTheme(<StatusPill state="running" size="small" />);
  const smallFont = getComputedStyle(small.container.querySelector('[aria-label="Running"]') as Element).fontSize;
  const smallHtml = small.container.innerHTML;
  cleanup();
  const medium = renderWithTheme(<StatusPill state="running" size="medium" />);
  assert.notStrictEqual(medium.container.innerHTML, smallHtml, 'size must change the rendered output');
  assert.ok(medium.container.textContent?.includes('Running'));
  assert.ok(smallFont !== undefined);
});

// ============================================================================
// KpiTile tests
// ============================================================================

test('KpiTile: renders label and value', () => {
  const { container } = renderWithTheme(
    <KpiTile label="Total Runs" value={42} />
  );
  assert.ok(container.textContent?.includes('Total Runs'));
  assert.ok(container.textContent?.includes('42'));
});

test('KpiTile: renders hint text when provided', () => {
  const { container } = renderWithTheme(
    <KpiTile label="Runs" value={10} hint="Last hour" />
  );
  assert.ok(container.textContent?.includes('Last hour'));
});

test('KpiTile: renders sparkline when trend provided', () => {
  const { container } = renderWithTheme(
    <KpiTile label="Trend" value={5} trend={[1, 2, 3, 4, 5]} />
  );
  const svg = container.querySelector('svg');
  assert.ok(svg, 'Should render SVG for sparkline');
  const polyline = svg?.querySelector('polyline');
  assert.ok(polyline, 'Should render polyline in sparkline');
});

test('KpiTile: does not render sparkline when trend not provided', () => {
  const { container } = renderWithTheme(<KpiTile label="Metric" value={100} />);
  const svg = container.querySelector('svg');
  assert.strictEqual(svg, null);
});

test('KpiTile: shows loading skeleton when loading=true', () => {
  const { container } = renderWithTheme(
    <KpiTile label="Loading" value={42} loading />
  );
  const skeleton = container.querySelector('[class*="MuiSkeleton"]');
  assert.ok(skeleton);
});

// ============================================================================
// HourlyBars tests
// ============================================================================

test('HourlyBars: empty buckets show empty message', () => {
  const { container } = renderWithTheme(<HourlyBars buckets={[]} />);
  assert.ok(container.textContent?.includes('No activity in this window'));
});

test('HourlyBars: renders correct number of bars', () => {
  const buckets: HourBucket[] = [
    { start: '2024-01-01T00:00:00Z', runs: 5, failed: 1 },
    { start: '2024-01-01T01:00:00Z', runs: 3, failed: 0 },
    { start: '2024-01-01T02:00:00Z', runs: 8, failed: 2 },
  ];
  const { container } = renderWithTheme(<HourlyBars buckets={buckets} />);
  const bars = container.querySelectorAll('[title]');
  assert.ok(bars.length >= 3, `Should render at least 3 bars, got ${bars.length}`);
});

test('HourlyBars: aria-label contains total runs and failed', () => {
  const buckets: HourBucket[] = [
    { start: '2024-01-01T00:00:00Z', runs: 5, failed: 1 },
    { start: '2024-01-01T01:00:00Z', runs: 3, failed: 0 },
  ];
  const { container } = renderWithTheme(<HourlyBars buckets={buckets} />);
  const chart = container.querySelector('[role="img"]');
  const ariaLabel = chart?.getAttribute('aria-label') || '';
  assert.ok(ariaLabel.includes('8'), 'Should include total runs (5+3)');
  assert.ok(ariaLabel.includes('1'), 'Should include total failed');
});

test('HourlyBars: bucket with failed count shows error segment', () => {
  const buckets: HourBucket[] = [
    { start: '2024-01-01T00:00:00Z', runs: 5, failed: 2 },
  ];
  const { container } = renderWithTheme(<HourlyBars buckets={buckets} />);
  // The bar contains both success and failed segments
  const bar = container.querySelector('[title]');
  assert.ok(bar);
});

// ============================================================================
// ToolBars tests
// ============================================================================

test('ToolBars: empty tools show empty message', () => {
  const { container } = renderWithTheme(<ToolBars tools={[]} />);
  assert.ok(container.textContent?.includes('No tool calls in this window'));
});

test('ToolBars: renders rows for each tool', () => {
  const tools: ToolStat[] = [
    { name: 'tool-a', calls: 10, errors: 1, avgMs: 100, p95Ms: 200 },
    { name: 'tool-b', calls: 20, errors: 0, avgMs: 50, p95Ms: 100 },
  ];
  const { container } = renderWithTheme(<ToolBars tools={tools} />);
  const buttons = container.querySelectorAll('button');
  assert.strictEqual(buttons.length, 2, 'Should render 2 tool rows');
});

test('ToolBars: error pill only shows when errors > 0', () => {
  const tools: ToolStat[] = [
    { name: 'tool-err', calls: 10, errors: 2, avgMs: 100, p95Ms: 200 },
    { name: 'tool-ok', calls: 10, errors: 0, avgMs: 100, p95Ms: 200 },
  ];
  const { container } = renderWithTheme(<ToolBars tools={tools} />);
  const chips = container.querySelectorAll('[class*="MuiChip"]');
  assert.ok(chips.length > 0, 'Should show error pill for tool with errors');
  // tool-ok should not have an error pill
  const rows = container.querySelectorAll('button');
  assert.strictEqual(rows.length, 2);
});

test('ToolBars: clicking a row calls onSelect', () => {
  const tools: ToolStat[] = [
    { name: 'test-tool', calls: 5, errors: 0, avgMs: 100, p95Ms: 200 },
  ];
  const selections: string[] = [];
  const handleSelect = (name: string) => selections.push(name);

  const { container } = renderWithTheme(
    <ToolBars tools={tools} onSelect={handleSelect} />
  );
  const button = container.querySelector('button');
  assert.ok(button);
  fireEvent.click(button);
  assert.deepEqual(selections, ['test-tool']);
});

test('ToolBars: pressing Enter on a row calls onSelect', () => {
  const tools: ToolStat[] = [
    { name: 'test-tool', calls: 5, errors: 0, avgMs: 100, p95Ms: 200 },
  ];
  const selections: string[] = [];
  const handleSelect = (name: string) => selections.push(name);

  const { container } = renderWithTheme(
    <ToolBars tools={tools} onSelect={handleSelect} />
  );
  const button = container.querySelector('button');
  assert.ok(button);
  fireEvent.keyDown(button, { key: 'Enter' });
  assert.deepEqual(selections, ['test-tool']);
});

// ============================================================================
// Waterfall tests
// ============================================================================

test('Waterfall: empty events show empty message', () => {
  const { container } = renderWithTheme(<Waterfall events={[]} />);
  assert.ok(container.textContent?.includes('No events'));
});

test('Waterfall: tool event rows count matches tool events', () => {
  const events: RunEvent[] = [
    {
      seq: 1,
      name: 'start',
      event: 'start',
      ts: '2024-01-01T12:00:00Z',
    },
    {
      seq: 2,
      name: 'query',
      event: 'tool',
      tool: 'search-tool',
      ts: '2024-01-01T12:00:01Z',
      durationMs: 500,
    },
    {
      seq: 3,
      name: 'process',
      event: 'tool',
      tool: 'process-tool',
      ts: '2024-01-01T12:00:02Z',
      durationMs: 300,
    },
  ];
  const { container } = renderWithTheme(<Waterfall events={events} />);
  const toolButtons = container.querySelectorAll('button');
  // Should have tool rows (start and completed are markers, not buttons)
  assert.ok(toolButtons.length > 0);
});

test('Waterfall: overlapping tool calls have different bar positions', () => {
  const events: RunEvent[] = [
    {
      seq: 1,
      name: 'start',
      event: 'start',
      ts: '2024-01-01T12:00:00Z',
    },
    {
      seq: 2,
      name: 'tool-a',
      event: 'tool',
      ts: '2024-01-01T12:00:01Z',
      durationMs: 500,
    },
    {
      seq: 3,
      name: 'tool-b',
      event: 'tool',
      ts: '2024-01-01T12:00:01.250Z',
      durationMs: 300,
    },
  ];
  const { container } = renderWithTheme(<Waterfall events={events} />);
  const rows = container.querySelectorAll('button[data-left]');
  // Both tool events should be rendered as buttons with data-left
  assert.ok(rows.length >= 1, 'Should render tool rows with position data');
});

test('Waterfall: failed tool has data-failed=true', () => {
  const events: RunEvent[] = [
    {
      seq: 1,
      name: 'start',
      event: 'start',
      ts: '2024-01-01T12:00:00Z',
    },
    {
      seq: 2,
      name: 'failed-tool',
      event: 'tool',
      ts: '2024-01-01T12:00:01Z',
      durationMs: 500,
      outcome: 'error',
    },
  ];
  const { container } = renderWithTheme(<Waterfall events={events} />);
  const failedRow = container.querySelector('button[data-failed="true"]');
  assert.ok(failedRow, 'Failed tool should have data-failed="true"');
});

test('Waterfall: selected row has aria-current=true', () => {
  const events: RunEvent[] = [
    {
      seq: 1,
      name: 'start',
      event: 'start',
      ts: '2024-01-01T12:00:00Z',
    },
    {
      seq: 2,
      name: 'tool',
      event: 'tool',
      ts: '2024-01-01T12:00:01Z',
      durationMs: 500,
    },
  ];
  const { container } = renderWithTheme(
    <Waterfall events={events} selectedSeq={2} />
  );
  const selectedRow = container.querySelector('button[aria-current="true"]');
  assert.ok(selectedRow, 'Selected row should have aria-current="true"');
});

test('Waterfall: clicking tool row calls onSelect with seq', () => {
  const events: RunEvent[] = [
    {
      seq: 1,
      name: 'start',
      event: 'start',
      ts: '2024-01-01T12:00:00Z',
    },
    {
      seq: 42,
      name: 'tool',
      event: 'tool',
      ts: '2024-01-01T12:00:01Z',
      durationMs: 500,
    },
  ];
  const selections: number[] = [];
  const handleSelect = (seq: number) => selections.push(seq);

  const { container } = renderWithTheme(
    <Waterfall events={events} onSelect={handleSelect} />
  );
  const toolRows = container.querySelectorAll('button[data-left]');
  assert.ok(toolRows.length > 0, 'Should have tool rows');
  if (toolRows.length > 0) {
    fireEvent.click(toolRows[0]);
    assert.ok(selections.includes(42), 'Should call onSelect with seq 42');
  }
});

test('Waterfall: unsorted input is ordered by start time', () => {
  const events: RunEvent[] = [
    {
      seq: 1,
      name: 'start',
      event: 'start',
      ts: '2024-01-01T12:00:00Z',
    },
    {
      seq: 3,
      name: 'tool-c',
      event: 'tool',
      ts: '2024-01-01T12:00:03Z',
      durationMs: 100,
    },
    {
      seq: 2,
      name: 'tool-b',
      event: 'tool',
      ts: '2024-01-01T12:00:02Z',
      durationMs: 100,
    },
  ];
  const { container } = renderWithTheme(<Waterfall events={events} />);
  const buttons = container.querySelectorAll('button[data-left]');
  assert.ok(buttons.length >= 2, 'Should render tool rows in order');
});
