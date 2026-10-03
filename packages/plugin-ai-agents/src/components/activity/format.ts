import { formatMs } from '../../utils/stats';
import type { AgentRun } from '../../types';

/**
 * Calculate elapsed time from a start timestamp to now (or a given timestamp).
 */
export function elapsedSince(
  startedAt: string | undefined,
  now = Date.now(),
): number {
  if (!startedAt) return 0;
  const startMs = new Date(startedAt).getTime();
  return Math.max(0, now - startMs);
}

/**
 * Get the duration of a run (completed or running).
 * For running runs, returns the elapsed time so far.
 * For completed/failed runs, returns the time from start to update.
 */
export function runDuration(run: AgentRun, now = Date.now()): number {
  if (!run.startedAt) return 0;
  const startMs = new Date(run.startedAt).getTime();
  // A run in progress lasts until now; finished runs end at their last update.
  const endMs =
    run.state === 'running' || !run.updatedAt
      ? now
      : new Date(run.updatedAt).getTime();
  return Math.max(0, endMs - startMs);
}

export function formatRunDuration(run: AgentRun, now = Date.now()): string {
  return formatMs(runDuration(run, now));
}

/**
 * Determine the tone (color) for a metric based on thresholds.
 * For success rates: >= 95% = success, >= 80% = warning, < 80% = error.
 */
export function toneForSuccessRate(
  ratio: number,
): 'success' | 'warning' | 'error' {
  if (ratio >= 0.95) return 'success';
  if (ratio >= 0.8) return 'warning';
  return 'error';
}

/**
 * Peak number of tool calls running at the same time. Tool events carry the
 * call's END time in `ts` and its length in `durationMs`, so a call spans
 * [ts - durationMs, ts]. Calls that merely touch (one ends exactly when the
 * next starts) are not concurrent.
 */
export function maxConcurrency(
  events: Array<{ ts?: string; durationMs?: number; event?: string }>,
): number {
  const points: Array<{ time: number; delta: 1 | -1 }> = [];
  for (const e of events) {
    if (e.event === 'start' || e.event === 'completed') continue;
    const end = e.ts ? Date.parse(e.ts) : NaN;
    const len = e.durationMs ?? 0;
    if (!Number.isFinite(end) || !(len > 0)) continue;
    points.push({ time: end - len, delta: 1 }, { time: end, delta: -1 });
  }
  // At equal times process the ends first so adjacent calls do not overlap.
  points.sort((a, b) => a.time - b.time || a.delta - b.delta);

  let current = 0;
  let max = 0;
  for (const p of points) {
    current += p.delta;
    if (current > max) max = current;
  }
  return max;
}
