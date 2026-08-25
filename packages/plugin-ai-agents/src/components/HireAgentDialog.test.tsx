import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
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
  const { baseElement } = render(
    <HireAgentDialog agent={agent} open onClose={() => {}} onInvoke={async () => ({ sessionId: 's', responseText: '' })} />,
  );
  assert.match(baseElement.textContent ?? '', /AWS CLI command/);
});

test('HireAgentDialog hides the AWS CLI preview for kagent agents', () => {
  const agent = mk({ runtime: { runtime: 'kagent', runtimeHandle: 'commit-auditor', namespace: 'kagent' } as any });
  const { baseElement } = render(
    <HireAgentDialog agent={agent} open onClose={() => {}} onInvoke={async () => ({ sessionId: 's', responseText: '' })} />,
  );
  const text = baseElement.textContent ?? '';
  assert.doesNotMatch(text, /AWS CLI command/);
  assert.doesNotMatch(text, /aws bedrock-agentcore/);
  assert.doesNotMatch(text, /missing region\/runtime-handle/);
});
