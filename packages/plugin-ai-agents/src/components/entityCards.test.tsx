import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { AgentOverviewCardView } from './AgentOverviewCardView';
import { AgentInvocationsCardView } from './AgentInvocationsCardView';
import { installApi, resetApi } from '../__fixtures__/testApi';
import { makeAgent } from '../__fixtures__/agents';

afterEach(() => {
  cleanup();
  resetApi();
});

const api = (over: Record<string, unknown> = {}) =>
  installApi({
    getReviews: async () => {
      throw new Error('no backend');
    },
    getInvocations: async () => [],
    getAvatar: async () => undefined,
    ...over,
  });

test('overview shows the agent identity, purpose and key fields', () => {
  api();
  render(<AgentOverviewCardView agent={makeAgent()} />);
  assert.ok(screen.getByRole('heading', { name: 'Test Agent' }));
  assert.ok(screen.getByText('component:default/test-agent'));
  assert.ok(screen.getByText('Test purposes for testing the agent'));
  for (const label of ['Runtime', 'Billing', 'Owner', 'Lifecycle', 'Version']) {
    assert.ok(screen.getByText(label), label);
  }
  assert.ok(screen.getByText('group:test-team'));
  assert.ok(screen.getByText('1.0.0'));
  assert.ok(screen.getByRole('img', { name: /Status: healthy/ }));
});

test('overview renders nothing without an agent', () => {
  api();
  const { container } = render(<AgentOverviewCardView agent={undefined} />);
  assert.equal(container.firstChild, null);
});

test('overview shows endpoint and runtime handle, but only safe endpoints', () => {
  api();
  const { unmount } = render(<AgentOverviewCardView agent={makeAgent()} />);
  assert.ok(screen.getByRole('link', { name: 'https://example.com/endpoint' }));
  assert.ok(screen.getByText('test-handle'));
  unmount();

  render(
    <AgentOverviewCardView
      agent={makeAgent({
        runtime: {
          runtime: 'custom',
          // eslint-disable-next-line no-script-url
          endpoint: 'javascript:alert(1)',
        } as any,
      })}
    />,
  );
  assert.equal(screen.queryByText('Endpoint'), null);
});

test('overview lists capabilities, tags and only the safe links', () => {
  api();
  render(
    <AgentOverviewCardView
      agent={makeAgent({
        links: [
          { url: 'https://example.com/docs', title: 'Docs', icon: 'docs' },
          // eslint-disable-next-line no-script-url
          { url: 'javascript:alert(1)', title: 'Evil' },
        ],
      })}
    />,
  );
  assert.ok(screen.getByText('reasoning'));
  assert.ok(screen.getByText('prod'));
  assert.ok(screen.getByText('tested'));
  const docs = screen.getByRole('link', { name: /Docs/ });
  assert.equal(docs.getAttribute('target'), '_blank');
  assert.equal(screen.queryByText('Evil'), null);
});

test('overview links to the AI Agents page', () => {
  api();
  render(<AgentOverviewCardView agent={makeAgent()} />);
  assert.equal(
    screen
      .getByRole('link', { name: 'View on the AI Agents page' })
      .getAttribute('href'),
    '/ai-agents',
  );
});

test('Hire Agent opens the run dialog and calls the API on run', async () => {
  const invoked: unknown[] = [];
  api({
    invokeAgent: async (ref: string, values: unknown) => {
      invoked.push([ref, values]);
      return { sessionId: 's'.repeat(33), responseText: 'ok' };
    },
  });
  render(
    <AgentOverviewCardView
      agent={makeAgent({
        hireSchema: [
          { name: 'repo', label: 'Repo', type: 'text', default: 'a/b' },
        ],
      })}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hire Agent' }));
  assert.ok(await screen.findByText('Run Test Agent'));
  fireEvent.click(screen.getByRole('button', { name: 'Run agent' }));
  await screen.findByText('ok');
  assert.deepEqual(invoked, [
    ['component:default/test-agent', { repo: 'a/b' }],
  ]);
});

test('no Hire Agent button without a hire schema', () => {
  api();
  render(
    <AgentOverviewCardView agent={makeAgent({ hireSchema: undefined })} />,
  );
  assert.equal(screen.queryByRole('button', { name: 'Hire Agent' }), null);
});

test('invocations card shows a heading and the history, or a hint', async () => {
  api({
    getInvocations: async () => [
      {
        id: 1,
        entityRef: 'component:default/test-agent',
        sessionId: 's1',
        prompt: 'Review MR !1',
        status: 'ok',
        responseText: 'fine',
      },
    ],
  });
  const { unmount } = render(
    <AgentInvocationsCardView entityRef="component:default/test-agent" />,
  );
  assert.ok(screen.getByRole('heading', { name: 'Recent invocations' }));
  assert.ok(await screen.findByText('Review MR !1'));
  // The card header is the only "Recent invocations" heading.
  assert.equal(screen.getAllByText('Recent invocations').length, 1);
  unmount();

  api({ getInvocations: async () => [] });
  render(<AgentInvocationsCardView entityRef="component:default/test-agent" />);
  assert.ok(await screen.findByText(/No invocations recorded yet/));
});
