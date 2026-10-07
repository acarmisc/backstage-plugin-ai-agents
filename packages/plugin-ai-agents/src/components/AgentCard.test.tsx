import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { AgentCard } from './AgentCard';
import { installApi, resetApi } from '../__fixtures__/testApi';
import { makeAgent } from '../__fixtures__/agents';

afterEach(() => {
  cleanup();
  resetApi();
});

const quietApi = () =>
  installApi({
    getInvocations: async () => [],
    getAvatar: async () => undefined,
  });

test('shows title, owner/lifecycle/version, purpose, billing and capabilities', () => {
  quietApi();
  render(<AgentCard agent={makeAgent()} />);
  assert.ok(screen.getByRole('heading', { name: 'Test Agent' }));
  // "group:" prefix is dropped from the owner.
  assert.ok(screen.getByText('test-team · experimental · v1.0.0'));
  assert.ok(screen.getByText('Test purposes for testing the agent'));
  assert.ok(screen.getByText('per-invocation'));
  assert.ok(screen.getByText('reasoning'));
  assert.ok(screen.getByText('retrieval'));
});

test('falls back to the name and a placeholder purpose', () => {
  quietApi();
  render(
    <AgentCard
      agent={makeAgent({ title: undefined, purpose: '', capabilities: [] })}
    />,
  );
  assert.ok(screen.getByRole('heading', { name: 'test-agent' }));
  assert.ok(screen.getByText('No description provided.'));
});

test('is a labelled button only when it has a click handler', () => {
  quietApi();
  const opened: string[] = [];
  const { unmount } = render(
    <AgentCard agent={makeAgent()} onClick={a => opened.push(a.name)} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open Test Agent' }));
  assert.deepEqual(opened, ['test-agent']);
  unmount();

  render(<AgentCard agent={makeAgent()} />);
  assert.equal(screen.queryByRole('button', { name: 'Open Test Agent' }), null);
});

test('links open in a new tab and unsafe URLs are dropped', () => {
  quietApi();
  render(
    <AgentCard
      agent={makeAgent({
        links: [
          { url: 'https://example.com/docs', title: 'Docs' },
          // eslint-disable-next-line no-script-url
          { url: 'javascript:alert(1)', title: 'Evil' },
        ],
      })}
    />,
  );
  const docs = screen.getByRole('link', { name: /Docs/ });
  assert.equal(docs.getAttribute('href'), 'https://example.com/docs');
  assert.equal(docs.getAttribute('target'), '_blank');
  assert.match(docs.getAttribute('rel') ?? '', /noopener/);
  assert.equal(screen.queryByText('Evil'), null);
});

test('shows at most four links', () => {
  quietApi();
  const links = Array.from({ length: 6 }, (_, i) => ({
    url: `https://example.com/${i}`,
    title: `Link ${i}`,
  }));
  render(<AgentCard agent={makeAgent({ links })} />);
  assert.equal(screen.getAllByRole('link').length, 4);
});

test('hire button needs a handler and a hire schema, and does not open the card', () => {
  quietApi();
  const hired: string[] = [];
  const opened: string[] = [];
  const { unmount } = render(
    <AgentCard
      agent={makeAgent()}
      onClick={a => opened.push(a.name)}
      onHire={a => hired.push(a.name)}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hire Agent' }));
  assert.deepEqual(hired, ['test-agent']);
  assert.deepEqual(opened, [], 'hire must not also open the card');
  unmount();

  render(<AgentCard agent={makeAgent()} />);
  assert.equal(screen.queryByRole('button', { name: 'Hire Agent' }), null);
  cleanup();
  render(<AgentCard agent={makeAgent({ hireSchema: [] })} onHire={() => {}} />);
  assert.equal(screen.queryByRole('button', { name: 'Hire Agent' }), null);
});

test('runtime icon filters without opening the card', () => {
  quietApi();
  const runtimes: string[] = [];
  const opened: string[] = [];
  render(
    <AgentCard
      agent={makeAgent()}
      onClick={a => opened.push(a.name)}
      onRuntimeClick={r => runtimes.push(r)}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Bedrock AgentCore' }));
  assert.deepEqual(runtimes, ['bedrock-agentcore']);
  assert.deepEqual(opened, []);
});

test('reports the agent status for assistive tech', () => {
  quietApi();
  render(<AgentCard agent={makeAgent()} />);
  assert.ok(screen.getByRole('img', { name: /Status: healthy/ }));
});
