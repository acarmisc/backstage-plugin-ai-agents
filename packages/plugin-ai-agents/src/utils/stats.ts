/**
 * Calculate the percentile of a sorted/unsorted array using nearest-rank method.
 * @param values Array of numbers (any order)
 * @param p Percentile between 0 and 1 (e.g., 0.5 for median, 0.95 for p95)
 * @returns The percentile value, or 0 if the array is empty
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const sorted = [...values].sort((a, b) => a - b);
  // Nearest-rank: rank = ceil(p * n), index = rank - 1
  const rank = Math.ceil(p * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

/**
 * Format milliseconds as a human-readable duration string.
 * Examples: "820ms", "3.2s", "1m 05s", "2h 03m"
 * Negative or NaN values return "0ms".
 */
export function formatMs(ms: number): string {
  if (Number.isNaN(ms) || ms < 0) return '0ms';

  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const totalSeconds = ms / 1000;

  if (totalSeconds < 60) {
    const seconds = totalSeconds.toFixed(1);
    // Remove trailing .0
    return seconds.endsWith('.0') ? `${Math.round(totalSeconds)}s` : `${seconds}s`;
  }

  const totalMinutes = totalSeconds / 60;

  if (totalMinutes < 60) {
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes % 1) * 60);
    if (seconds === 0) return `${minutes}m`;
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes) % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Format a ratio (0..1) as a percentage string.
 * Examples: "0%", "12%", "99.5%"
 * Shows one decimal only when <10% and not an integer; clamps to 0..100.
 */
export function formatPct(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const pct = clamped * 100;

  // If less than 10% and not an integer, show one decimal
  if (pct < 10 && !Number.isInteger(pct)) {
    return `${pct.toFixed(1)}%`;
  }

  return `${Math.round(pct)}%`;
}

/**
 * Format a count with SI suffixes for readability.
 * Examples: 1234 -> "1.2k", 1500000 -> "1.5M"
 */
export function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  if (n < 1_000_000_000) {
    const m = n / 1_000_000;
    return `${m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  const g = n / 1_000_000_000;
  return `${g.toFixed(1).replace(/\.0$/, '')}G`;
}
