import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  elapsedSince,
  runDuration,
  toneForSuccessRate,
  maxConcurrency,
} from './format';
import type { AgentRun, RunEvent } from '../../types';

test('elapsedSince returns 0 for missing startedAt', () => {
  assert.equal(elapsedSince(undefined, 1000), 0);
});

test('elapsedSince returns elapsed time in ms', () => {
  const now = 10000;
  const started = new Date(now - 5000).toISOString();
  assert.equal(elapsedSince(started, now), 5000);
});

test('runDuration calculates correct duration for completed runs', () => {
  const run: AgentRun = {
    runId: '1',
    agent: 'agent1',
    state: 'completed',
    startedAt: new Date(5000).toISOString(),
    updatedAt: new Date(10000).toISOString(),
  };
  assert.equal(runDuration(run), 5000);
});

test('runDuration uses current time for running runs', () => {
  const now = 10000;
  const run: AgentRun = {
    runId: '1',
    agent: 'agent1',
    state: 'running',
    startedAt: new Date(now - 3000).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  assert.equal(runDuration(run, now), 3000);
});

test('toneForSuccessRate returns success for >=95%', () => {
  assert.equal(toneForSuccessRate(0.95), 'success');
  assert.equal(toneForSuccessRate(1.0), 'success');
});

test('toneForSuccessRate returns warning for 80-95%', () => {
  assert.equal(toneForSuccessRate(0.94), 'warning');
  assert.equal(toneForSuccessRate(0.8), 'warning');
});

test('toneForSuccessRate returns error for <80%', () => {
  assert.equal(toneForSuccessRate(0.79), 'error');
  assert.equal(toneForSuccessRate(0.0), 'error');
});

// Tool events carry the call's END time in `ts`; a call spans [ts - durationMs, ts].
const tool = (seq: number, endMs: number, durationMs?: number, event = 'tool'): RunEvent => ({
  seq,
  name: `t${seq}`,
  event,
  tool: `t${seq}`,
  ts: new Date(endMs).toISOString(),
  durationMs,
});

test('maxConcurrency: no events, or none with a duration, is 0', () => {
  assert.equal(maxConcurrency([]), 0);
  assert.equal(maxConcurrency([tool(1, 5000, undefined), tool(2, 6000, 0)]), 0);
});

test('maxConcurrency: a single call is 1', () => {
  assert.equal(maxConcurrency([tool(1, 5000, 300)]), 1);
});

test('maxConcurrency: three calls spanning a common instant are 3', () => {
  // [4700,5000] [4800,5000] [4900,5200]  -> all three run during 4900..5000
  assert.equal(maxConcurrency([tool(1, 5000, 300), tool(2, 5000, 200), tool(3, 5200, 300)]), 3);
});

test('maxConcurrency: back-to-back calls (touching) are not concurrent', () => {
  // [900,1000] then [1000,1100]
  assert.equal(maxConcurrency([tool(1, 1000, 100), tool(2, 1100, 100)]), 1);
});

test('maxConcurrency: peak is found among mixed sequential and parallel calls', () => {
  // two parallel at 0..100, later one alone, later two parallel again
  const events = [tool(1, 100, 100), tool(2, 100, 100), tool(3, 500, 100), tool(4, 900, 100), tool(5, 950, 100)];
  assert.equal(maxConcurrency(events), 2);
});

test('maxConcurrency ignores run start/completed markers and unsorted input', () => {
  const events = [tool(3, 5200, 300), tool(1, 5000, 300), tool(0, 4000, 500, 'start'), tool(9, 6000, 500, 'completed'), tool(2, 5000, 200)];
  assert.equal(maxConcurrency(events), 3);
});
