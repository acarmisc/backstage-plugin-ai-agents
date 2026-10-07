import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { AgentSpend } from './AgentSpend';
import { InvocationHistory } from './InvocationHistory';
import { AgentReviews } from './AgentReviews';
import { installApi, resetApi } from '../__fixtures__/testApi';
import type { InvocationRecord, ReviewsSummary } from '../types';

afterEach(() => {
  cleanup();
  resetApi();
});

// --- AgentSpend --------------------------------------------------------------

const spend = {
  spend: 12.5,
  requests: 340,
  totalTokens: 1_250_000,
  byModel: { haiku: 8, sonnet: 4.5, unused: 0 },
};

test('spend shows cost, calls, tokens and the top models', async () => {
  installApi({ getSpend: async () => spend });
  render(<AgentSpend entityRef="component:default/a" />);
  await screen.findByTestId('agent-spend');
  assert.ok(screen.getByText('Cost (last 30d)'));
  assert.ok(screen.getByText('$12.50'));
  assert.ok(screen.getByText('340 calls'));
  assert.ok(screen.getByText('1.3M tok'));
  assert.ok(screen.getByText('haiku'));
  assert.equal(screen.queryByText('unused'), null, 'zero-spend models hidden');
});

test('spend for a thread is titled as a conversation cost', async () => {
  installApi({ getSpend: async () => spend });
  render(<AgentSpend entityRef="component:default/a" threadId="t1" />);
  assert.ok(await screen.findByText('Conversation cost'));
});

test('spend renders nothing without LiteLLM or without requests', async () => {
  installApi({ getSpend: async () => null });
  const { container, unmount } = render(
    <AgentSpend entityRef="component:default/a" />,
  );
  await new Promise(r => setTimeout(r, 20));
  assert.equal(container.firstChild, null);
  unmount();

  installApi({ getSpend: async () => ({ ...spend, requests: 0 }) });
  const second = render(<AgentSpend entityRef="component:default/a" />);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(second.container.firstChild, null);
});

// --- InvocationHistory -------------------------------------------------------

const record = (over: Partial<InvocationRecord>): InvocationRecord => ({
  id: 1,
  entityRef: 'component:default/a',
  sessionId: 's1',
  prompt: 'Review MR !412',
  status: 'ok',
  responseText: 'Looks good',
  latencyMs: 8200,
  userRef: 'user:default/alice',
  createdAt: new Date().toISOString(),
  ...over,
});

test('history lists status, prompt, mode, latency and user', async () => {
  installApi({
    getInvocations: async () => [
      record({}),
      record({
        id: 2,
        sessionId: 's2',
        status: 'error',
        errorMessage: 'upstream timeout',
        post: true,
      }),
    ],
  });
  render(<InvocationHistory entityRef="component:default/a" />);
  await screen.findByTestId('invocation-history');
  assert.ok(screen.getByRole('img', { name: 'Succeeded' }));
  assert.ok(screen.getByRole('img', { name: 'Failed' }));
  assert.ok(screen.getByText('dry-run'));
  assert.ok(screen.getByText('published'));
  assert.ok(screen.getByText('8.2s'));
  assert.equal(screen.getAllByText('alice').length, 2);
  // The failure reason is visible, not hidden in a tooltip.
  assert.ok(screen.getByText('upstream timeout'));
});

test('history refetches on demand', async () => {
  let calls = 0;
  installApi({
    getInvocations: async () => {
      calls += 1;
      return [record({})];
    },
  });
  render(<InvocationHistory entityRef="component:default/a" />);
  await screen.findByTestId('invocation-history');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh invocations' }));
  await waitFor(() => assert.equal(calls, 2));
});

test('history is hidden when empty unless it has an empty text', async () => {
  installApi({ getInvocations: async () => [] });
  const { container, unmount } = render(
    <InvocationHistory entityRef="component:default/a" />,
  );
  await new Promise(r => setTimeout(r, 20));
  assert.equal(container.firstChild, null);
  unmount();

  render(
    <InvocationHistory
      entityRef="component:default/a"
      emptyText="No invocations yet."
    />,
  );
  assert.ok(await screen.findByText('No invocations yet.'));
});

// --- AgentReviews ------------------------------------------------------------

const reviews: ReviewsSummary = {
  count: 1,
  average: 4,
  reviews: [
    {
      id: 1,
      entityRef: 'component:default/a',
      userRef: 'user:default/alice',
      rating: 4,
      comment: 'Great at routing.',
      createdAt: new Date().toISOString(),
    },
  ],
};

test('reviews show the average and each review', async () => {
  installApi({ getReviews: async () => reviews });
  render(<AgentReviews entityRef="component:default/a" />);
  await screen.findByTestId('agent-reviews');
  assert.ok(screen.getByText('(1) · avg 4/5'));
  assert.ok(screen.getByText('Great at routing.'));
  assert.ok(screen.getByText(/alice/));
});

test('reviews can be submitted with a rating and a comment', async () => {
  const submitted: unknown[] = [];
  installApi({
    getReviews: async () => reviews,
    addReview: async (_ref: string, review: unknown) => {
      submitted.push(review);
      return { id: 2 };
    },
  });
  render(<AgentReviews entityRef="component:default/a" />);
  await screen.findByTestId('agent-reviews');

  const submit = screen.getByRole('button', { name: 'Submit review' });
  assert.equal(submit.hasAttribute('disabled'), true, 'needs a rating first');

  fireEvent.click(screen.getByRole('radio', { name: '5 Stars' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Review' }), {
    target: { value: 'Excellent' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
  await screen.findByText('Thanks! Your review was submitted.');
  assert.deepEqual(submitted, [{ rating: 5, comment: 'Excellent' }]);
});

test('a failed submission shows the error and keeps the form', async () => {
  installApi({
    getReviews: async () => reviews,
    addReview: async () => {
      throw new Error('database is down');
    },
  });
  render(<AgentReviews entityRef="component:default/a" />);
  await screen.findByTestId('agent-reviews');
  fireEvent.click(screen.getByRole('radio', { name: '3 Stars' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
  assert.ok(await screen.findByText('database is down'));
  assert.ok(screen.getByRole('button', { name: 'Submit review' }));
});

test('reviews stay hidden when there is no backend', async () => {
  installApi({
    getReviews: async () => {
      throw new Error('501');
    },
  });
  const { container } = render(
    <AgentReviews entityRef="component:default/a" />,
  );
  await new Promise(r => setTimeout(r, 20));
  assert.equal(container.firstChild, null);
});
