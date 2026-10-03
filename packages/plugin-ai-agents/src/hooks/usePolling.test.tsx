import '../setupTests';
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { usePolling } from './usePolling';
import { setVisibility, sleep } from '../__fixtures__/testApi';

afterEach(() => {
  cleanup();
  setVisibility('visible');
});

beforeEach(() => setVisibility('visible'));


test('polls repeatedly at the configured interval', async () => {
  let callCount = 0;
  const fetcher = async () => {
    callCount++;
    return { data: 1 };
  };

  function Component() {
    const { data } = usePolling(fetcher, { intervalMs: 30 });
    return <span data-testid="out">{data ? 'loaded' : 'loading'}</span>;
  }

  const { getByTestId } = render(<Component />);
  await waitFor(() => assert.equal(getByTestId('out').textContent, 'loaded'));
  const initialCount = callCount;
  assert.ok(initialCount >= 1);

  // Wait for more polls
  await sleep(100);
  assert.ok(callCount >= 3, `expected >=3 fetches, got ${callCount}`);
});

test('does not fetch while the tab is hidden and refetches immediately when visible', async () => {
  let callCount = 0;
  const fetcher = async () => {
    callCount++;
    return { data: 1 };
  };

  function Component() {
    const { data } = usePolling(fetcher, { intervalMs: 30 });
    return <span data-testid="out">{data ? 'loaded' : 'loading'}</span>;
  }

  render(<Component />);
  await waitFor(() => assert.ok(callCount >= 1));

  setVisibility('hidden');
  await sleep(40);
  const frozen = callCount;
  await sleep(150);
  assert.equal(callCount, frozen, 'no fetch while hidden');

  setVisibility('visible');
  await waitFor(() => assert.ok(callCount > frozen), { timeout: 500 });
});

test('backs off to 4x the interval after an error and surfaces it', async () => {
  let callCount = 0;
  const fetcher = async () => {
    callCount++;
    throw new Error('boom');
  };

  function Component() {
    const { error } = usePolling(fetcher, { intervalMs: 60 });
    return <span data-testid="out">{error ? 'error' : 'ok'}</span>;
  }

  const { getByTestId } = render(<Component />);
  await waitFor(() => assert.equal(getByTestId('out').textContent, 'error'));
  assert.equal(callCount, 1);

  await sleep(150); // > 2x, < 4x the interval
  assert.equal(callCount, 1, 'next attempt must wait ~4x the interval');
  await waitFor(() => assert.ok(callCount >= 2), { timeout: 600 });
});

test('stops polling after unmount', async () => {
  let callCount = 0;
  const fetcher = async () => {
    callCount++;
    return { data: 1 };
  };

  function Component() {
    const { data } = usePolling(fetcher, { intervalMs: 30 });
    return <span data-testid="out">{data ? 'loaded' : 'loading'}</span>;
  }

  const { unmount } = render(<Component />);
  await waitFor(() => assert.ok(callCount >= 2), { timeout: 1000 });

  unmount();
  await sleep(40);
  const after = callCount;
  await sleep(200);
  assert.equal(callCount, after);
});

test('does not fetch when enabled is false', async () => {
  let callCount = 0;
  const fetcher = async () => {
    callCount++;
    return { data: 1 };
  };

  function Component() {
    const { data } = usePolling(fetcher, { intervalMs: 30, enabled: false });
    return <span data-testid="out">{data ? 'loaded' : 'loading'}</span>;
  }

  render(<Component />);
  await sleep(100);
  assert.equal(callCount, 0, 'should not fetch when disabled');
});

test('respects dynamic interval function based on data', async () => {
  let callCount = 0;
  const fetcher = async () => {
    callCount++;
    return { value: callCount };
  };

  function Component() {
    const { data } = usePolling(
      fetcher,
      {
        intervalMs: (d) => d ? 200 : 30,
      }
    );
    return <span data-testid="out">{data ? 'loaded' : 'loading'}</span>;
  }

  render(<Component />);
  await waitFor(() => assert.ok(callCount >= 1));
  const afterFirst = callCount;

  // After first data, should use 200ms interval
  await sleep(100); // < 200ms
  assert.equal(callCount, afterFirst);
});

test('inline fetcher and interval functions do not restart the loop (no fetch storm)', async () => {
  let calls = 0;
  function Component() {
    // new function identities on every render, like real call sites
    const { data } = usePolling(
      async () => {
        calls++;
        return calls;
      },
      { intervalMs: () => 1000 },
    );
    return <span data-testid="out">{data ?? 'none'}</span>;
  }
  render(<Component />);
  await sleep(150);
  assert.equal(calls, 1, 'one fetch, then wait for the (long) interval');
});

test('refresh() fetches once and polling keeps delivering fresh data afterwards', async () => {
  let calls = 0;
  let api: { refresh(): void } | undefined;
  function Component() {
    const r = usePolling(async () => ++calls, { intervalMs: 40 });
    api = r;
    return <span data-testid="out">{r.data ?? 'none'}</span>;
  }
  const { getByTestId } = render(<Component />);
  await waitFor(() => assert.notEqual(getByTestId('out').textContent, 'none'));
  api!.refresh();
  const afterRefresh = calls;
  await waitFor(() => assert.ok(Number(getByTestId('out').textContent) > afterRefresh, 'later polls must still update the UI'), { timeout: 1000 });
});

test('interval function sees the latest data', async () => {
  const seen: Array<number | undefined> = [];
  let n = 0;
  function Component() {
    usePolling(async () => ++n, {
      intervalMs: d => {
        seen.push(d);
        return 30;
      },
    });
    return null;
  }
  render(<Component />);
  await waitFor(() => assert.ok(seen.length >= 3), { timeout: 1000 });
  assert.equal(seen[0], 1, 'first evaluation already sees the first result, not undefined');
  assert.ok(seen[2]! > seen[0]!, 'later evaluations see newer data');
});

test('changing deps refetches immediately and ignores the older response', async () => {
  const resolvers: Array<(v: string) => void> = [];
  function Component({ id }: { id: string }) {
    const { data } = usePolling(
      () => new Promise<string>(res => resolvers.push(v => res(`${id}:${v}`))),
      { intervalMs: 1000, deps: [id] },
    );
    return <span data-testid="out">{data ?? 'none'}</span>;
  }
  const { rerender, getByTestId } = render(<Component id="a" />);
  await waitFor(() => assert.equal(resolvers.length, 1));
  rerender(<Component id="b" />);
  await waitFor(() => assert.equal(resolvers.length, 2));
  resolvers[1]('new');
  await waitFor(() => assert.equal(getByTestId('out').textContent, 'b:new'));
  resolvers[0]('late'); // the stale "a" response arrives last and must not win
  await sleep(30);
  assert.equal(getByTestId('out').textContent, 'b:new');
});
