import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigReader } from '@backstage/config';
import {
  aggregateSpend,
  buildSpendReader,
  spendTagMatcher,
  spendWindow,
} from './spend';

test('buildSpendReader returns undefined without LiteLLM config', () => {
  assert.equal(buildSpendReader(new ConfigReader({})), undefined);
});

test('buildSpendReader builds a reader from litellm config', async () => {
  const reader = buildSpendReader(
    new ConfigReader({ litellm: { baseUrl: 'http://litellm:4000', masterKey: 'sk-x' } }),
  );
  assert.ok(reader);
  assert.equal(typeof reader!.getSpendLogs, 'function');
});

test('aggregateSpend filters by thread tag and sums spend/tokens/models', () => {
  const rows = [
    { spend: 0.1, total_tokens: 100, model: 'm1', request_tags: ['session:t1', 'channel:backstage'] },
    { spend: 0.2, total_tokens: 200, model: 'm1', request_tags: ['session:t1'] },
    { spend: 9.9, total_tokens: 999, model: 'm2', request_tags: ['session:other'] },
  ];
  const summary = aggregateSpend(rows, spendTagMatcher({ threadId: 't1', entityRef: 'component:default/x' }));
  assert.equal(summary.requests, 2);
  assert.ok(Math.abs(summary.spend - 0.3) < 1e-9);
  assert.equal(summary.totalTokens, 300);
  assert.ok(Math.abs(summary.byModel.m1 - 0.3) < 1e-9);
  assert.equal(summary.byModel.m2, undefined);
});

test('aggregateSpend matches by entity tag when no thread is given', () => {
  const rows = [
    { spend: 0.5, total_tokens: 10, model: 'm', request_tags: ['backstage-entity:component:default/x'] },
    { spend: 1.0, total_tokens: 20, model: 'm', request_tags: ['backstage-entity:component:default/y'] },
    { spend: 2.0, total_tokens: 30, model: 'm', request_tags: { session: 't2' } },
  ];
  const summary = aggregateSpend(
    rows,
    spendTagMatcher({ entityRef: 'component:default/x' }),
  );
  assert.equal(summary.requests, 1);
  assert.ok(Math.abs(summary.spend - 0.5) < 1e-9);
});

test('aggregateSpend tolerates malformed spend and object-shaped tags', () => {
  const rows = [
    { spend: '0.25' as any, total_tokens: 5, request_tags: { session: 't1' } },
    { spend: undefined, total_tokens: 5, request_tags: ['session:t1'] },
  ];
  const summary = aggregateSpend(rows, spendTagMatcher({ threadId: 't1', entityRef: 'x' }));
  assert.equal(summary.requests, 2);
  assert.ok(Math.abs(summary.spend - 0.25) < 1e-9);
});

test('spendWindow defaults to 30 days and clamps the range', () => {
  const now = new Date('2026-09-19T12:00:00Z');
  const def = spendWindow(undefined, now);
  assert.equal(def.end_date, '2026-09-19');
  assert.equal(def.start_date, '2026-08-21');
  assert.equal(spendWindow(1, now).start_date, '2026-09-19');
  // Clamped to 90 days max.
  assert.equal(spendWindow(1000, now).start_date, '2026-06-22');
  assert.equal(spendWindow(0, now).start_date, '2026-09-19');
});
