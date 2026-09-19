import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { HireAgentDialog } from './HireAgentDialog';
import type { AiAgent } from '../types';

afterEach(cleanup);

const mk = (over: Partial<AiAgent>): AiAgent =>
  ({
    entityRef: 'component:default/x',
    name: 'x',
    purpose: '',
    runtime: { runtime: 'custom' },
    billing: { model: 'free' },
    capabilities: [],
    tags: [],
    links: [],
    hireSchema: [{ name: 'repo', label: 'Repo', type: 'text', required: true }],
    rawEntity: {} as any,
    ...over,
  }) as AiAgent;

// MUI's Dialog renders into a portal (document.body), not the render
// container, so assertions query `baseElement` rather than `container`.

test('HireAgentDialog shows the AWS CLI preview for bedrock-agentcore agents', () => {
  const agent = mk({ runtime: { runtime: 'bedrock-agentcore', region: 'eu-west-1', runtimeHandle: 'h' } });
  const { baseElement, getByText } = render(
    <HireAgentDialog agent={agent} open onClose={() => {}} onInvoke={async () => ({ sessionId: 's', responseText: '' })} />,
  );
  // The preview is collapsed behind a toggle to keep the dialog focused.
  fireEvent.click(getByText('Show invocation preview'));
  assert.match(baseElement.textContent ?? '', /AWS CLI command/);
});

test('HireAgentDialog hides the AWS CLI preview for kagent agents', () => {
  const agent = mk({ runtime: { runtime: 'kagent', runtimeHandle: 'commit-auditor', namespace: 'kagent' } as any });
  const { baseElement, getByText } = render(
    <HireAgentDialog agent={agent} open onClose={() => {}} onInvoke={async () => ({ sessionId: 's', responseText: '' })} />,
  );
  fireEvent.click(getByText('Show invocation preview'));
  const text = baseElement.textContent ?? '';
  assert.doesNotMatch(text, /AWS CLI command/);
  assert.doesNotMatch(text, /aws bedrock-agentcore/);
  assert.doesNotMatch(text, /missing region\/runtime-handle/);
});

test('HireAgentDialog defaults to dry-run and does not offer publishing before a run', () => {
  const agent = mk({
    runtime: { runtime: 'bedrock-agentcore', region: 'eu-west-1', runtimeHandle: 'h' },
    hireSchema: [{ name: 'action', label: 'Action', type: 'select', options: ['dry-run', 'post'] }],
  });
  const { baseElement } = render(
    <HireAgentDialog agent={agent} open onClose={() => {}} onInvoke={async () => ({ sessionId: 's', responseText: 'r' })} />,
  );
  const text = baseElement.textContent ?? '';
  assert.match(text, /Runs in dry-run by default/);
  assert.doesNotMatch(text, /Confirm and publish/);
});

test('HireAgentDialog dry-runs first, then publishes on confirmation', async () => {
  const agent = mk({
    runtime: { runtime: 'bedrock-agentcore', region: 'eu-west-1', runtimeHandle: 'h' },
    promptTemplate: 'Review {repo}',
    hireSchema: [
      { name: 'repo', label: 'Repo', type: 'text', required: true },
      { name: 'action', label: 'Action', type: 'select', options: ['dry-run', 'post'] },
    ],
  });
  const calls: Array<{ post?: boolean; threadId?: string }> = [];
  const onInvoke = async (_values: Record<string, string>, opts?: any) => {
    calls.push({ post: opts?.post, threadId: opts?.threadId });
    return { sessionId: 's'.repeat(33), threadId: 't1', post: opts?.post, responseText: 'report' };
  };
  const { getByText, getByLabelText, findByText } = render(
    <HireAgentDialog agent={agent} open onClose={() => {}} onInvoke={onInvoke} />,
  );

  fireEvent.change(getByLabelText(/Repo/), { target: { value: 'innovation/x' } });
  fireEvent.click(getByText('Run agent'));
  await findByText('Confirm and publish');
  // First call is a dry run carrying no explicit post.
  assert.equal(calls[0].post, false);
  assert.equal(calls[0].threadId, undefined);

  const publish = await findByText('Confirm and publish');
  fireEvent.click(publish);
  await waitFor(() => assert.equal(calls.length, 2));
  assert.equal(calls[1].post, true);
  // The confirmation reuses the thread returned by the dry run.
  assert.equal(calls[1].threadId, 't1');
});
