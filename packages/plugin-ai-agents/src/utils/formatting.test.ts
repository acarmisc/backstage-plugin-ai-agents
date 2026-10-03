import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime, formatDuration } from './formatting';

// relativeTime tests
test('relativeTime formats seconds', () => {
  const now = new Date();
  const secondsAgo = new Date(now.getTime() - 30 * 1000);
  const result = relativeTime(secondsAgo.toISOString());
  assert.match(result, /^\d+s ago$/);
});

test('relativeTime formats minutes', () => {
  const now = new Date();
  const minutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const result = relativeTime(minutesAgo.toISOString());
  assert.match(result, /^\d+m ago$/);
});

test('relativeTime formats hours', () => {
  const now = new Date();
  const hoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const result = relativeTime(hoursAgo.toISOString());
  assert.match(result, /^\d+h ago$/);
});

test('relativeTime formats days', () => {
  const now = new Date();
  const daysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const result = relativeTime(daysAgo.toISOString());
  assert.match(result, /^\d+d ago$/);
});

test('relativeTime handles undefined', () => {
  const result = relativeTime(undefined);
  assert.equal(result, 'unknown');
});

// formatDuration tests
test('formatDuration formats seconds', () => {
  const result = formatDuration(30 * 1000);
  assert.match(result, /^\d+s$/);
});

test('formatDuration formats minutes', () => {
  const result = formatDuration(5 * 60 * 1000);
  assert.match(result, /^\d+m$/);
});

test('formatDuration formats hours', () => {
  const result = formatDuration(2 * 60 * 60 * 1000);
  assert.equal(result, '2h');
});

test('formatDuration formats hours and minutes', () => {
  const result = formatDuration((2 * 60 + 5) * 60 * 1000);
  assert.equal(result, '2h 5m');
});

test('formatDuration handles NaN', () => {
  const result = formatDuration(NaN);
  assert.equal(result, '0s');
});

test('formatDuration handles negative values', () => {
  const result = formatDuration(-100);
  assert.equal(result, '0s');
});
