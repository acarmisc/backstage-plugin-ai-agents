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

test('isAllowed returns false when allowlist empty', () => {
  assert.equal(isAllowed('https://evil.example.com', []), false);
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

test('isAllowed prevents subdomain-suffix matching attacks', () => {
  // Pattern meant to match example.com and its paths should NOT match example.com.evil.com
  assert.equal(isAllowed('https://example.com.evil.com/anything', ['https://example.com*']), false);
  assert.equal(isAllowed('https://example.com.evil.com', ['https://example.com']), false);
});

test('isAllowed matches allowlisted origin with path globs', () => {
  // Pattern should match the same origin with any path
  assert.equal(isAllowed('https://example.com/health', ['https://example.com*']), true);
  assert.equal(isAllowed('https://example.com/api/status', ['https://example.com*']), true);
  assert.equal(isAllowed('https://example.com', ['https://example.com*']), true);
});

test('isAllowed matches exact origin without glob', () => {
  assert.equal(isAllowed('https://api.example.com', ['https://api.example.com']), true);
  assert.equal(isAllowed('https://api.example.com:8080', ['https://api.example.com:8080']), true);
  // Different origins should not match
  assert.equal(isAllowed('https://other.example.com', ['https://api.example.com']), false);
});

test('isAllowed matches the README-documented AWS API Gateway pattern', () => {
  const allowlist = ['https://*.execute-api.*.amazonaws.com/*'];
  assert.equal(
    isAllowed('https://abc123.execute-api.us-east-1.amazonaws.com/prod/health', allowlist),
    true,
  );
  assert.equal(isAllowed('https://abc123.execute-api.us-east-1.amazonaws.com', allowlist), true);
  assert.equal(isAllowed('https://evil.com/execute-api.us-east-1.amazonaws.com', allowlist), false);
});