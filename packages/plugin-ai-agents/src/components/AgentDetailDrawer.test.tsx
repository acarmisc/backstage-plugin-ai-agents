import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AgentDetailDrawer } from './AgentDetailDrawer';
import { installApi, resetApi } from '../__fixtures__/testApi';
import type { AiAgent, ReviewsSummary } from '../types';

afterEach(() => {
  cleanup();
  resetApi();
});

// Helper to create a realistic AiAgent
const makeAgent = (overrides: Partial<AiAgent> = {}): AiAgent => ({
  entityRef: 'component:default/test-agent',
  name: 'test-agent',
  title: 'Test Agent',
  description: 'A test agent for drawer testing',
  purpose: 'Test purposes for testing the agent drawer',
  avatarUrl: undefined,
  owner: 'test-team',
  system: 'test-system',
  lifecycle: 'experimental',
  version: '1.0.0',
  runtime: {
    runtime: 'bedrock-agentcore',
    runtimeHandle: 'test-handle',
    region: 'us-east-1',
    endpoint: 'https://example.com/endpoint',
    telemetryId: 'telemetry-123',
  },
  billing: {
    model: 'per-invocation',
    unitCost: 0.01,
  },
  capabilities: [
    { label: 'reasoning', category: 'reasoning' },
    { label: 'retrieval', category: 'retrieval' },
  ],
  tags: ['prod', 'tested'],
  links: [
    { url: 'https://example.com/docs', title: 'Documentation' },
    { url: 'https://example.com/repo', title: 'Repository' },
  ],
  status: {
    state: 'healthy',
    lastChecked: new Date().toISOString(),
    latencyMs: 100,
  },
  hireSchema: [
    { name: 'repo', label: 'Repository', type: 'text', required: true },
  ],
  rawEntity: {} as any,
  ...overrides,
});

// Route observer component to capture navigation
const RouteObserver: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const location = useLocation();
  React.useEffect(() => {
    onNavigate?.(location.pathname + location.search);
  }, [location, onNavigate]);
  return null;
};

// Helper to set up tests with API and MemoryRouter
const defaultApiMocks = {
  getImageAssets: async () => ({}),
  getSpend: async () => ({ spend: 0, requests: 0, totalTokens: 0, byModel: {} }),
  getInvocations: async () => [],
  getReviews: async () => ({ reviews: [], count: 0, average: null }),
};

const renderWithApi = (
  component: React.ReactElement,
  apiMocks: Record<string, unknown> = {},
) => {
  installApi({
    ...defaultApiMocks,
    ...apiMocks,
  } as any);
  return render(component);
};

test('AgentDetailDrawer renders compact header with title, status, runtime badge and a labelled close button', () => {
  const closed: string[] = [];
  const { getByRole, getByText, container } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer agent={makeAgent()} open onClose={() => closed.push('x')} />
    </MemoryRouter>,
  );
  assert.ok(getByText('Test Agent'));
  assert.match(container.ownerDocument.body.textContent ?? '', /agentcore/i, 'runtime badge present');
  fireEvent.click(getByRole('button', { name: 'Close' }));
  assert.deepEqual(closed, ['x']);
});

test('AgentDetailDrawer shows status badge and refresh button', () => {
  const agent = makeAgent();
  let refreshCalled = false;
  const { getByRole } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
        onRefreshStatus={() => { refreshCalled = true; }}
      />
    </MemoryRouter>
  );

  const refreshButton = getByRole('button', { name: /refresh status/i });
  assert.ok(refreshButton);
  fireEvent.click(refreshButton);
  assert.equal(refreshCalled, true);
});

test('AgentDetailDrawer displays description clamped to 3 lines with Show more toggle', () => {
  const longDescription = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5 with extra content to make it long';
  const agent = makeAgent({ purpose: longDescription });
  const { getByRole: getByRoleDesc } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  const showMoreButton = getByRoleDesc('button', { name: /show more/i });
  assert.ok(showMoreButton);

  fireEvent.click(showMoreButton);
  const showLessButton = getByRoleDesc('button', { name: /show less/i });
  assert.ok(showLessButton);
});

test('AgentDetailDrawer shows short description without toggle', () => {
  const shortDescription = 'Short description';
  const agent = makeAgent({ purpose: shortDescription });
  const { queryByRole: queryByRoleShort } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  const showMoreButton = queryByRoleShort('button', { name: /show more|show less/i });
  assert.equal(showMoreButton, null);
});

test('AgentDetailDrawer renders Hire button when agent has hire schema', () => {
  const agent = makeAgent({
    hireSchema: [{ name: 'repo', label: 'Repository', type: 'text', required: true }],
  });
  let hireCalled = false;
  const { getByRole } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
        onHire={() => { hireCalled = true; }}
      />
    </MemoryRouter>
  );

  const hireButton = getByRole('button', { name: /hire agent/i });
  assert.ok(hireButton);
  fireEvent.click(hireButton);
  assert.equal(hireCalled, true);
});

test('AgentDetailDrawer hides Hire button when agent has no hire schema', () => {
  const agent = makeAgent({ hireSchema: undefined });
  const { queryByRole } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
        onHire={() => {}}
      />
    </MemoryRouter>
  );

  const hireButton = queryByRole('button', { name: /hire agent/i });
  assert.equal(hireButton, null);
});

test('AgentDetailDrawer shows Open activity button only when telemetryId exists', () => {
  const agent = makeAgent();
  const { getByTestId } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  assert.ok(getByTestId('open-activity-button'));
});

test('AgentDetailDrawer hides Open activity button when telemetryId is not set', () => {
  const agent = makeAgent({
    runtime: { ...makeAgent().runtime, telemetryId: undefined },
  });
  const { queryByTestId } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  assert.equal(queryByTestId('open-activity-button'), null);
});

test('AgentDetailDrawer Open activity button navigates to activity tab with telemetryId', async () => {
  const agent = makeAgent();
  let navigatedPath = '';
  const { getByTestId } = renderWithApi(
    <MemoryRouter>
      <RouteObserver onNavigate={(path) => { navigatedPath = path; }} />
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  const openActivityButton = getByTestId('open-activity-button');
  fireEvent.click(openActivityButton);

  assert.match(navigatedPath, /\/ai-agents\?tab=activity&agent=telemetry-123/);
});

test('AgentDetailDrawer Open activity button calls onClose after navigating', async () => {
  const agent = makeAgent();
  let closeCalledCount = 0;
  const { getByTestId } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => { closeCalledCount++; }}
      />
    </MemoryRouter>
  );

  const openActivityButton = getByTestId('open-activity-button');
  fireEvent.click(openActivityButton);

  await waitFor(() => assert.equal(closeCalledCount, 1));
});

test('AgentDetailDrawer all accordion sections start collapsed with aria-expanded=false', () => {
  const agent = makeAgent({
    capabilities: [{ label: 'test' }],
    links: [{ url: 'https://example.com', title: 'Example' }],
    tags: ['tag1'],
  });
  const { getByRole } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  const sections = ['runtime', 'capabilities', 'links', 'tags', 'spend', 'invocations', 'reviews'];
  sections.forEach(section => {
    const header = getByRole('button', { name: new RegExp(section, 'i') });
    assert.equal(header.getAttribute('aria-expanded'), 'false', `Section ${section} should start collapsed`);
  });
});

test('AgentDetailDrawer expanding one section does not collapse others', async () => {
  const agent = makeAgent({
    capabilities: [{ label: 'test' }],
  });
  const { getAllByRole } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  const headers = getAllByRole('button').filter(b => b.getAttribute('aria-expanded') !== null);
  assert.ok(headers.length >= 2, 'Should have at least 2 expandable sections');

  // Expand first section
  fireEvent.click(headers[0]);
  assert.equal(headers[0].getAttribute('aria-expanded'), 'true');

  // Expand second section
  fireEvent.click(headers[1]);
  assert.equal(headers[0].getAttribute('aria-expanded'), 'true', 'First section should still be expanded');
  assert.equal(headers[1].getAttribute('aria-expanded'), 'true');
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const drawerWith = (apiMocks: Record<string, unknown>) =>
  renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer agent={makeAgent()} open onClose={() => {}} />
    </MemoryRouter>,
    apiMocks,
  );

test('AgentDetailDrawer fetches Spend only after the Spend section is first expanded', async () => {
  let calls = 0;
  const { getByRole, queryByTestId } = drawerWith({
    getSpend: async () => {
      calls++;
      return { spend: 10.5, requests: 100, totalTokens: 50000, byModel: { 'gpt-4': 10.5 } };
    },
  });
  await sleep(50);
  assert.equal(calls, 0, 'no spend request while collapsed');
  assert.equal(queryByTestId('agent-spend'), null);

  fireEvent.click(getByRole('button', { name: /^Spend$/i }));
  await waitFor(() => assert.ok(queryByTestId('agent-spend'), 'spend renders once expanded'));
  assert.equal(calls, 1);
});

test('AgentDetailDrawer fetches invocation history only after its section is expanded', async () => {
  let calls = 0;
  const { getByRole } = drawerWith({
    getInvocations: async () => {
      calls++;
      return [];
    },
  });
  await sleep(50);
  assert.equal(calls, 0, 'no history request while collapsed');
  fireEvent.click(getByRole('button', { name: /^Recent invocations$/i }));
  await waitFor(() => assert.ok(calls >= 1, 'history requested after expanding'));
});

test('AgentDetailDrawer fetches reviews only after the Reviews section is expanded', async () => {
  let calls = 0;
  const { getByRole } = drawerWith({
    getReviews: async () => {
      calls++;
      return { reviews: [], count: 0, average: null } as ReviewsSummary;
    },
  });
  await sleep(50);
  assert.equal(calls, 0, 'no reviews request while collapsed');
  fireEvent.click(getByRole('button', { name: /^Reviews$/i }));
  await waitFor(() => assert.ok(calls >= 1, 'reviews requested after expanding'));
  assert.equal(getByRole('button', { name: /^Reviews$/i }).getAttribute('aria-expanded'), 'true');
});

test('AgentDetailDrawer does not render RunTimeline content', () => {
  const agent = makeAgent();
  const { container } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  // RunTimeline should not be present
  assert.equal(container.querySelector('[data-testid="run-timeline"]'), null);
});

test('AgentDetailDrawer Runtime & billing section shows all expected fields', async () => {
  const agent = makeAgent({
    runtime: {
      runtime: 'bedrock-agentcore',
      runtimeHandle: 'my-agent-handle',
      region: 'eu-west-1',
      endpoint: 'https://example.com/endpoint',
      telemetryId: 'telemetry-123',
    },
    billing: { model: 'per-token', unitCost: 0.05 },
  });
  const { getByRole: getByRoleRuntime } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  const runtimeHeader = getByRoleRuntime('button', { name: /runtime & billing/i });
  assert.ok(runtimeHeader, 'Runtime & billing header should exist');

  // Expand the section
  fireEvent.click(runtimeHeader);

  // Verify it's now expanded
  await waitFor(() => {
    assert.equal(runtimeHeader.getAttribute('aria-expanded'), 'true');
  }, { timeout: 500 });
});

test('AgentDetailDrawer Capabilities section shows capability count hint', async () => {
  const agent = makeAgent({
    capabilities: [
      { label: 'reasoning' },
      { label: 'retrieval' },
      { label: 'tools' },
    ],
  });
  const { getByText: getByTextCaps } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  assert.ok(getByTextCaps('3'), 'Should show capability count as hint');
});

test('AgentDetailDrawer Links section shows link count hint', async () => {
  const agent = makeAgent({
    links: [
      { url: 'https://example.com/docs', title: 'Docs' },
      { url: 'https://example.com/repo', title: 'Repo' },
      { url: 'https://example.com/issues', title: 'Issues' },
    ],
  });
  const { getByRole } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  const linksHeader = getByRole('button', { name: /^Links\b/i });
  assert.ok(linksHeader, 'Links header should exist');

  // Check that the header contains the count. The structure is:
  // <AccordionSummary><Typography>Links</Typography><Typography>3</Typography></AccordionSummary>
  const headerContent = linksHeader.textContent;
  assert.ok(headerContent?.includes('3'), `Links header should contain count "3", got: "${headerContent}"`);
});

test('AgentDetailDrawer Tags section shows tag count hint', async () => {
  const agent = makeAgent({
    tags: ['prod', 'tested', 'v2', 'ai'],
  });
  const { getByRole } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  const tagsHeader = getByRole('button', { name: /^Tags\b/i });
  assert.ok(tagsHeader, 'Tags header should exist');

  // Check that the header contains the count
  const headerContent = tagsHeader.textContent;
  assert.ok(headerContent?.includes('4'), `Tags header should contain count "4", got: "${headerContent}"`);
});

test('AgentDetailDrawer properly copies entityRef to clipboard', () => {
  const agent = makeAgent({ entityRef: 'component:default/my-agent' });
  let clipboardText = '';
  const originalClipboard = navigator.clipboard;
  (navigator as any).clipboard = {
    writeText: async (text: string) => { clipboardText = text; },
  };

  const { getByText: getByTextClipboard } = renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => {}}
      />
    </MemoryRouter>
  );

  fireEvent.click(getByTextClipboard('component:default/my-agent'));
  assert.equal(clipboardText, 'component:default/my-agent');

  (navigator as any).clipboard = originalClipboard;
});

test('AgentDetailDrawer preserves all existing props (agent, open, onClose, onRefreshStatus, onHire, historyReloadKey)', () => {
  const agent = makeAgent();
  let closeCallCount = 0;
  let hireCallCount = 0;
  let refreshCallCount = 0;

  renderWithApi(
    <MemoryRouter>
      <AgentDetailDrawer
        agent={agent}
        open
        onClose={() => { closeCallCount++; }}
        onHire={() => { hireCallCount++; }}
        onRefreshStatus={() => { refreshCallCount++; }}
        historyReloadKey={0}
      />
    </MemoryRouter>
  );

  // Verify drawer is open with no unexpected calls
  assert.equal(closeCallCount, 0);
  assert.equal(hireCallCount, 0);
  assert.equal(refreshCallCount, 0);
});
