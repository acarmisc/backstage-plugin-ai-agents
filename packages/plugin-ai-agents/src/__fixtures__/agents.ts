import type { AiAgent } from '../types';

/** A realistic agent for component tests; override what a test cares about. */
export const makeAgent = (overrides: Partial<AiAgent> = {}): AiAgent => ({
  entityRef: 'component:default/test-agent',
  name: 'test-agent',
  title: 'Test Agent',
  description: 'A test agent',
  purpose: 'Test purposes for testing the agent',
  avatarUrl: undefined,
  owner: 'group:test-team',
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
