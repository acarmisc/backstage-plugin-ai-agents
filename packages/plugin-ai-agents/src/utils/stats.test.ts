import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentile, formatMs, formatPct, formatCount } from './stats';

// ============================================================================
// percentile() tests
// ============================================================================

test('percentile: empty array returns 0', () => {
  assert.strictEqual(percentile([], 0.5), 0);
  assert.strictEqual(percentile([], 0.95), 0);
});

test('percentile: single element returns that element', () => {
  assert.strictEqual(percentile([42], 0.5), 42);
  assert.strictEqual(percentile([42], 0.95), 42);
});

test('percentile: p50 (median) of [1,2,3,4,5]', () => {
  // Nearest-rank: rank = ceil(0.5 * 5) = 3, value = sorted[2] = 3
  assert.strictEqual(percentile([1, 2, 3, 4, 5], 0.5), 3);
});

test('percentile: p95 of [1,2,3,4,5]', () => {
  // Nearest-rank: rank = ceil(0.95 * 5) = 5, value = sorted[4] = 5
  assert.strictEqual(percentile([1, 2, 3, 4, 5], 0.95), 5);
});

test('percentile: p0 (min)', () => {
  // Nearest-rank: rank = ceil(0 * 5) = 0, clamped to index 0
  assert.strictEqual(percentile([1, 2, 3, 4, 5], 0), 1);
});

test('percentile: p100 (max)', () => {
  // Nearest-rank: rank = ceil(1.0 * 5) = 5, value = sorted[4] = 5
  assert.strictEqual(percentile([1, 2, 3, 4, 5], 1.0), 5);
});

test('percentile: unordered input', () => {
  assert.strictEqual(percentile([5, 1, 3, 2, 4], 0.5), 3);
});

test('percentile: p99 of 100 elements', () => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1); // [1..100]
  // Nearest-rank: rank = ceil(0.99 * 100) = 99, value = 99
  assert.strictEqual(percentile(values, 0.99), 99);
});

// ============================================================================
// formatMs() tests
// ============================================================================

test('formatMs: 0ms', () => {
  assert.strictEqual(formatMs(0), '0ms');
});

test('formatMs: 500ms', () => {
  assert.strictEqual(formatMs(500), '500ms');
});

test('formatMs: 820ms', () => {
  assert.strictEqual(formatMs(820), '820ms');
});

test('formatMs: 999ms', () => {
  assert.strictEqual(formatMs(999), '999ms');
});

test('formatMs: 1000ms = 1s', () => {
  assert.strictEqual(formatMs(1000), '1s');
});

test('formatMs: 3200ms = 3.2s', () => {
  assert.strictEqual(formatMs(3200), '3.2s');
});

test('formatMs: 5000ms = 5s', () => {
  assert.strictEqual(formatMs(5000), '5s');
});

test('formatMs: 60000ms = 1m', () => {
  assert.strictEqual(formatMs(60000), '1m');
});

test('formatMs: 65000ms = 1m 05s', () => {
  assert.strictEqual(formatMs(65000), '1m 05s');
});

test('formatMs: 120000ms = 2m', () => {
  assert.strictEqual(formatMs(120000), '2m');
});

test('formatMs: 3605000ms = 1h 00m', () => {
  assert.strictEqual(formatMs(3605000), '1h 00m');
});

test('formatMs: 7380000ms = 2h 03m', () => {
  assert.strictEqual(formatMs(7380000), '2h 03m');
});

test('formatMs: negative value returns 0ms', () => {
  assert.strictEqual(formatMs(-100), '0ms');
});

test('formatMs: NaN returns 0ms', () => {
  assert.strictEqual(formatMs(NaN), '0ms');
});

// ============================================================================
// formatPct() tests
// ============================================================================

test('formatPct: 0 (0%)', () => {
  assert.strictEqual(formatPct(0), '0%');
});

test('formatPct: 1 (100%)', () => {
  assert.strictEqual(formatPct(1), '100%');
});

test('formatPct: 0.5 (50%)', () => {
  assert.strictEqual(formatPct(0.5), '50%');
});

test('formatPct: 0.12 (12%)', () => {
  assert.strictEqual(formatPct(0.12), '12%');
});

test('formatPct: 0.001 (0.1%) - shows one decimal', () => {
  assert.strictEqual(formatPct(0.001), '0.1%');
});

test('formatPct: 0.095 (9.5%) - shows one decimal', () => {
  assert.strictEqual(formatPct(0.095), '9.5%');
});

test('formatPct: 0.1 (10%) - no decimal', () => {
  assert.strictEqual(formatPct(0.1), '10%');
});

test('formatPct: 0.999 (99.9%) - rounds to 100%', () => {
  assert.strictEqual(formatPct(0.999), '100%');
});

test('formatPct: above 1 (>100%) clamps to 100%', () => {
  assert.strictEqual(formatPct(1.5), '100%');
});

test('formatPct: below 0 (<0%) clamps to 0%', () => {
  assert.strictEqual(formatPct(-0.5), '0%');
});

// ============================================================================
// formatCount() tests
// ============================================================================

test('formatCount: 0', () => {
  assert.strictEqual(formatCount(0), '0');
});

test('formatCount: 42', () => {
  assert.strictEqual(formatCount(42), '42');
});

test('formatCount: 999', () => {
  assert.strictEqual(formatCount(999), '999');
});

test('formatCount: 1000 = 1k', () => {
  assert.strictEqual(formatCount(1000), '1k');
});

test('formatCount: 1234 = 1.2k', () => {
  assert.strictEqual(formatCount(1234), '1.2k');
});

test('formatCount: 1500 = 1.5k', () => {
  assert.strictEqual(formatCount(1500), '1.5k');
});

test('formatCount: 1000000 = 1M', () => {
  assert.strictEqual(formatCount(1000000), '1M');
});

test('formatCount: 1500000 = 1.5M', () => {
  assert.strictEqual(formatCount(1500000), '1.5M');
});

test('formatCount: 1234567 = 1.2M', () => {
  assert.strictEqual(formatCount(1234567), '1.2M');
});

test('formatCount: 1000000000 = 1G', () => {
  assert.strictEqual(formatCount(1000000000), '1G');
});

test('formatCount: 1500000000 = 1.5G', () => {
  assert.strictEqual(formatCount(1500000000), '1.5G');
});

test('formatCount: 999k displayed as 999k', () => {
  assert.strictEqual(formatCount(999000), '999k');
});
