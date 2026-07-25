import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapProbeResult, isAllowed, readProbeConfig } from './client';
import type { ProbeResult } from './types';

test('mapProbeResult healthy on ok 2xx', () => {
  const r: ProbeResult = { ok: true, status: 200, latencyMs: 12 };
  const s = mapProbeResult(r);
  assert.equal(s.state, 'healthy');
  assert.equal(s.latencyMs, 12);
  assert.ok(s.lastChecked);
});

test('mapProbeResult down on 5xx', () => {
  const s = mapProbeResult({ ok: false, status: 503, latencyMs: 5 });
  assert.equal(s.state, 'down');
  assert.equal(s.message, 'HTTP 503');
});

test('mapProbeResult degraded on 4xx', () => {
  const s = mapProbeResult({ ok: false, status: 404, latencyMs: 5 });
  assert.equal(s.state, 'degraded');
  assert.equal(s.message, 'HTTP 404');
});

test('mapProbeResult down on abort/error', () => {
  const s = mapProbeResult({ error: 'aborted' });
  assert.equal(s.state, 'down');
  assert.equal(s.message, 'aborted');
});

test('isAllowed returns true when allowlist empty', () => {
  assert.equal(isAllowed('https://evil.example.com', []), true);
});

test('isAllowed matches wildcard origin', () => {
  assert.equal(isAllowed('https://api.example.com/x', ['https://*.example.com']), true);
  assert.equal(isAllowed('https://api.evil.com/x', ['https://*.example.com']), false);
});

test('readProbeConfig applies defaults', () => {
  const cfg = {
    getOptionalConfig: () => undefined,
    getOptionalBoolean: () => undefined,
    getOptionalNumber: () => undefined,
    getOptionalString: () => undefined,
    getOptionalStringArray: () => undefined,
  } as any;
  const c = readProbeConfig(cfg);
  assert.equal(c.enabled, true);
  assert.equal(c.probeTimeoutMs, 3000);
  assert.equal(c.statusCacheTtlMs, 15000);
  assert.deepEqual(c.probeAllowlist, []);
});