import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { CatalogApi } from '@backstage/catalog-client';
import {
  aiAgentsPlugin,
  AgentsPage,
  AiAgentsApi,
  aiAgentsApiRef,
} from '../src';

// Sample agents covering all runtimes, billing models, lifecycles, and
// capability categories. The dev page renders them through a stub CatalogApi
// so the plugin's api.ts works unchanged, with no live catalog/backend.
const sampleEntities = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'support-triage-agent',
      title: 'Support Triage Agent',
      description:
        'Classifies and routes incoming support tickets by severity and product area.',
      tags: ['ai-agent', 'llm', 'support'],
      annotations: {
        'ai-agent.io/avatar':
          'https://api.dicebear.com/7.x/bottts/svg?seed=triage',
        'ai-agent.io/runtime': 'bedrock-agentcore',
        'ai-agent.io/runtime-handle':
          'arn:aws:bedrock:us-east-1:123:agent/TXXX',
        'ai-agent.io/endpoint':
          'https://abc.execute-api.us-east-1.amazonaws.com/prod',
        'ai-agent.io/health':
          'https://abc.execute-api.us-east-1.amazonaws.com/prod/health',
        'ai-agent.io/billing-model': 'per-invocation',
        'ai-agent.io/cost-per-1k': '0.012',
        'ai-agent.io/capabilities':
          'tool-use:tools,rag:retrieval,reasoning:reasoning',
        'ai-agent.io/version': '1.4.2',
      },
      links: [
        {
          url: 'https://grafana.example.com/d/agents/support-triage',
          title: 'Metrics',
          icon: 'dashboard',
        },
        {
          url: 'https://docs.example.com/agents/support-triage',
          title: 'Playbook',
          icon: 'docs',
        },
      ],
    },
    spec: {
      type: 'ai-agent',
      lifecycle: 'production',
      owner: 'cs-ops',
      system: 'customer-support',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'invoice-reader-agent',
      title: 'Invoice Reader',
      description:
        'Extracts structured data from uploaded invoices and receipts using OCR + LLM.',
      tags: ['ai-agent', 'vision'],
      annotations: {
        'ai-agent.io/runtime': 'litellm',
        'ai-agent.io/billing-model': 'per-token',
        'ai-agent.io/cost-per-1k': '2.40',
        'ai-agent.io/capabilities': 'vision:vision,ocr:vision,tools:tools',
      },
    },
    spec: {
      type: 'ai-agent',
      lifecycle: 'production',
      owner: 'finance-ops',
      system: 'invoicing',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'kb-search-agent',
      title: 'KB Search',
      description:
        'Answers internal questions grounded in the company knowledge base.',
      tags: ['ai-agent', 'rag'],
      annotations: {
        'ai-agent.io/runtime': 'lambda',
        'ai-agent.io/endpoint': 'https://api.example.com/kb-search',
        'ai-agent.io/health': 'https://api.example.com/kb-search/health',
        'ai-agent.io/billing-model': 'free',
        'ai-agent.io/capabilities': 'rag:retrieval,reasoning:reasoning',
      },
    },
    spec: {
      type: 'ai-agent',
      lifecycle: 'experimental',
      owner: 'platform-team',
      system: 'devex',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'release-notes-agent',
      title: 'Release Notes Writer',
      description:
        'Drafts user-facing release notes from merged merge requests.',
      tags: ['ai-agent', 'codegen'],
      annotations: {
        'ai-agent.io/runtime': 'custom',
        'ai-agent.io/endpoint': 'https://relnote.example.com/invoke',
        'ai-agent.io/billing-model': 'subscription',
        'ai-agent.io/capabilities': 'codegen:tools,reasoning:reasoning',
      },
    },
    spec: {
      type: 'ai-agent',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'devex',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'legacy-classifier',
      title: 'Legacy Classifier',
      description:
        'Legacy intent classifier — superseded by support-triage-agent.',
      tags: ['ai-agent'],
      annotations: {
        'ai-agent.io/runtime': 'custom',
        'ai-agent.io/billing-model': 'per-invocation',
        'ai-agent.io/capabilities': 'reasoning:reasoning',
      },
    },
    spec: {
      type: 'ai-agent',
      lifecycle: 'deprecated',
      owner: 'cs-ops',
      system: 'customer-support',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'voice-ivr-agent',
      title: 'Voice IVR',
      description: 'Voice-driven IVR agent handling inbound calls.',
      tags: ['ai-agent', 'voice'],
      annotations: {
        'ai-agent.io/runtime': 'bedrock-agentcore',
        'ai-agent.io/billing-model': 'per-invocation',
        'ai-agent.io/cost-per-1k': '0.040',
        'ai-agent.io/capabilities':
          'voice:voice,reasoning:reasoning,tools:tools',
      },
    },
    spec: {
      type: 'ai-agent',
      lifecycle: 'experimental',
      owner: 'cs-ops',
      system: 'customer-support',
    },
  },
];

const stubCatalogApi = {
  getEntities: async ({ filter }: any) => {
    const items = sampleEntities.filter(e => {
      if (!filter) return true;
      const filters = Array.isArray(filter) ? filter : [filter];
      return filters.some((f: Record<string, unknown>) =>
        Object.entries(f).every(([k, v]) => {
          if (k === 'kind') return e.kind === v;
          if (k === 'spec.type') return e.spec?.type === v;
          return true;
        }),
      );
    });
    return {
      items,
      totalItems: items.length,
      pageInfo: { hasNextPage: false },
    };
  },
  getEntityByRef: async (ref: string) =>
    sampleEntities.find(e => `component:default/${e.metadata.name}` === ref) ??
    null,
} as unknown as CatalogApi;

// In-memory reviews so the review widgets are exercisable in the dev app.
const devReviews: any[] = [
  {
    id: 1,
    entityRef: 'component:default/support-triage-agent',
    userRef: 'user:default/alice',
    rating: 4,
    comment: 'Great at routing, occasionally mislabels billing tickets.',
    createdAt: new Date().toISOString(),
  },
];

class DevApi extends AiAgentsApi {
  async getReviews(entityRef: string) {
    const reviews = devReviews.filter(r => r.entityRef === entityRef);
    const average = reviews.length
      ? Math.round(
          (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10,
        ) / 10
      : null;
    return { reviews, count: reviews.length, average };
  }

  async addReview(
    entityRef: string,
    review: { rating: number; comment?: string },
  ) {
    const id = devReviews.push({
      id: devReviews.length + 1,
      entityRef,
      userRef: 'user:default/dev',
      rating: review.rating,
      comment: review.comment ?? null,
      createdAt: new Date().toISOString(),
    });
    return { id };
  }

  async getActivity() {
    const now = new Date();
    return [
      {
        entityRef: 'component:default/support-triage-agent',
        telemetryId: 'support-triage-1',
        title: 'Support Triage Agent',
        runs: [
          {
            runId: 'run-1',
            agent: 'support-triage-agent',
            target: '!148',
            project: 'gitlab/main',
            state: 'running' as const,
            currentActivity: 'after get_file_content',
            startedAt: new Date(now.getTime() - 45000).toISOString(),
            updatedAt: new Date(now.getTime() - 10000).toISOString(),
          },
          {
            runId: 'run-2',
            agent: 'support-triage-agent',
            state: 'completed' as const,
            startedAt: new Date(now.getTime() - 120000).toISOString(),
            updatedAt: new Date(now.getTime() - 60000).toISOString(),
            verdict: 'approved',
          },
          {
            runId: 'run-3',
            agent: 'support-triage-agent',
            state: 'completed' as const,
            startedAt: new Date(now.getTime() - 240000).toISOString(),
            updatedAt: new Date(now.getTime() - 180000).toISOString(),
          },
        ],
      },
      {
        entityRef: 'component:default/invoice-reader-agent',
        telemetryId: 'invoice-reader-1',
        title: 'Invoice Reader',
        runs: [
          {
            runId: 'run-4',
            agent: 'invoice-reader-agent',
            state: 'completed' as const,
            startedAt: new Date(now.getTime() - 90000).toISOString(),
            updatedAt: new Date(now.getTime() - 30000).toISOString(),
            verdict: 'ready',
          },
          {
            runId: 'run-5',
            agent: 'invoice-reader-agent',
            state: 'completed' as const,
            startedAt: new Date(now.getTime() - 150000).toISOString(),
            updatedAt: new Date(now.getTime() - 100000).toISOString(),
          },
        ],
      },
      {
        entityRef: 'component:default/kb-search-agent',
        telemetryId: 'kb-search-1',
        title: 'KB Search',
        runs: [
          {
            runId: 'run-6',
            agent: 'kb-search-agent',
            state: 'failed' as const,
            startedAt: new Date(now.getTime() - 60000).toISOString(),
            updatedAt: new Date(now.getTime() - 20000).toISOString(),
          },
          {
            runId: 'run-7',
            agent: 'kb-search-agent',
            state: 'completed' as const,
            startedAt: new Date(now.getTime() - 180000).toISOString(),
            updatedAt: new Date(now.getTime() - 120000).toISOString(),
          },
        ],
      },
      {
        entityRef: 'component:default/release-notes-agent',
        telemetryId: 'release-notes-1',
        title: 'Release Notes Writer',
        error: 'telemetry provider unavailable',
        runs: [],
      },
    ];
  }
}

const stubAiAgentsApi = new DevApi({ fetchApi: {} as any }, '/api/ai-agents');

createDevApp()
  .registerPlugin(aiAgentsPlugin)
  .addPage({
    element: (
      <TestApiProvider
        apis={[
          [catalogApiRef, stubCatalogApi],
          [aiAgentsApiRef, stubAiAgentsApi],
        ]}
      >
        <AgentsPage />
      </TestApiProvider>
    ),
    title: 'AI Agents',
    path: '/ai-agents',
  })
  .render();
