import '../setupTests';
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { useFleetActivity } from './useFleetActivity';
import { installApi, resetApi, setVisibility, sleep } from '../__fixtures__/testApi';

afterEach(() => {
  cleanup();
  resetApi();
  setVisibility('visible');
});

function Probe({ pollMs }: { pollMs: number }) {
  const { data, error } = useFleetActivity(pollMs, 5);
  let label = 'none';
  if (error) label = `error:${error.message}`;
  else if (data) label = `n=${data.length}`;
  return <span data-testid="out">{label}</span>;
}

beforeEach(() => setVisibility('visible'));

const stub = (impl: () => Promise<unknown[]>) => {
  const calls = { n: 0 };
  installApi({
    getActivity: async () => {
      calls.n++;
      return impl();
    },
  });
  return calls;
};

test('polls repeatedly at the configured interval', async () => {
  const calls = stub(async () => [{}]);
  const { getByTestId } = render(<Probe pollMs={30} />);
  await waitFor(() => assert.equal(getByTestId('out').textContent, 'n=1'));
  await waitFor(() => assert.ok(calls.n >= 3, `expected >=3 fetches, got ${calls.n}`), { timeout: 1000 });
});

test('does not fetch while the tab is hidden and refetches immediately when visible', async () => {
  const calls = stub(async () => []);
  render(<Probe pollMs={30} />);
  await waitFor(() => assert.ok(calls.n >= 1));
  setVisibility('hidden');
  await sleep(40);
  const frozen = calls.n;
  await sleep(250);
  assert.equal(calls.n, frozen, 'no fetch while hidden');
  setVisibility('visible');
  await waitFor(() => assert.ok(calls.n > frozen), { timeout: 500 });
});

test('backs off to 4x the interval after an error and surfaces it', async () => {
  const calls = stub(async () => {
    throw new Error('boom');
  });
  const { getByTestId } = render(<Probe pollMs={60} />);
  await waitFor(() => assert.equal(getByTestId('out').textContent, 'error:boom'));
  assert.equal(calls.n, 1);
  await sleep(150); // > 2x, < 4x the interval
  assert.equal(calls.n, 1, 'next attempt must wait ~4x the interval');
  await waitFor(() => assert.ok(calls.n >= 2), { timeout: 600 });
});

test('stops polling after unmount', async () => {
  const calls = stub(async () => []);
  const { unmount } = render(<Probe pollMs={30} />);
  await waitFor(() => assert.ok(calls.n >= 2), { timeout: 1000 });
  unmount();
  await sleep(40);
  const after = calls.n;
  await sleep(200);
  assert.equal(calls.n, after);
});
