import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import type { Entity } from '@backstage/catalog-model';
import { MemoryRouter } from 'react-router-dom';
import { AgentActivityTabView } from './AgentActivityTabView';
import { entityToAgent } from '../types';
import { installApi, resetApi } from '../__fixtures__/testApi';

afterEach(() => {
  cleanup();
  resetApi();
});

const entity = (
  type: string,
  annotations: Record<string, string> = {},
): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'dinesh', title: 'Dinesh', annotations },
  spec: { type, lifecycle: 'production', owner: 'x' },
});

const mount = (e: Entity) =>
  render(
    <MemoryRouter>
      <AgentActivityTabView
        agent={e.spec?.type === 'ai-agent' ? entityToAgent(e) : undefined}
      />
    </MemoryRouter>,
  );

test('activity tab: explains how to enable activity when the agent has no telemetry-id', () => {
  installApi({});
  mount(entity('ai-agent'));
  const hint = screen.getByTestId('activity-tab-hint');
  assert.match(hint.textContent ?? '', /ai-agent\.io\/telemetry-id/);
});

test('activity tab: renders nothing for entities that are not ai-agents', () => {
  installApi({});
  const { container } = mount(
    entity('service', { 'ai-agent.io/telemetry-id': 'dinesh' }),
  );
  assert.equal(container.textContent, '');
});

test("activity tab: with a telemetry-id it loads that agent's runs and stats", async () => {
  const asked: string[] = [];
  installApi({
    getRuns: async (ref: string) => {
      asked.push(ref);
      return [
        {
          runId: 'r1',
          agent: 'dinesh',
          state: 'running',
          target: '!152',
          startedAt: new Date().toISOString(),
          currentActivity: 'after get_mr_changes',
        },
      ];
    },
    getInsights: async () => null,
    getRunTimeline: async () => [],
    getAvatar: async () => undefined,
  });
  mount(entity('ai-agent', { 'ai-agent.io/telemetry-id': 'dinesh' }));
  await waitFor(() => assert.ok(screen.getAllByText('!152').length > 0));
  assert.deepEqual(asked.slice(0, 1), ['component:default/dinesh']);
  assert.ok(screen.getByText('after get_mr_changes'));
});
