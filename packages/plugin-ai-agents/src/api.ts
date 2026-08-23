import { createApiRef, FetchApi } from '@backstage/core-plugin-api';
import type { CatalogApi } from '@backstage/catalog-client';
import {
  AI_AGENT_TYPE,
  AiAgent,
  AgentStatus,
  entityToAgent,
} from './types';

export interface AiAgentsApiInterface {
  listAgents(): Promise<AiAgent[]>;
  getAgent(entityRef: string): Promise<AiAgent | undefined>;
  /** Probe live status for the given entity refs via the backend. */
  getStatuses(entityRefs: string[]): Promise<Record<string, AgentStatus>>;
  /** Run the Hire Agent invocation for the given entity with form values. */
  invokeAgent(
    entityRef: string,
    values: Record<string, string>,
  ): Promise<InvocationResult>;
}

export interface InvocationResult {
  sessionId: string;
  responseText: string;
  latencyMs?: number;
}

export const aiAgentsApiRef = createApiRef<AiAgentsApiInterface>({
  id: 'plugin.ai-agents.api',
});

export class AiAgentsApi implements AiAgentsApiInterface {
  constructor(
    private readonly opts: {
      fetchApi: FetchApi;
      catalogApi: CatalogApi;
    },
    private readonly basePath = '/api/ai-agents',
  ) {}

  async listAgents(): Promise<AiAgent[]> {
    const result = await this.opts.catalogApi.getEntities({
      filter: { kind: 'Component', 'spec.type': AI_AGENT_TYPE },
    });
    return result.items
      .map(e => entityToAgent(e))
      .filter((a): a is AiAgent => a !== undefined);
  }

  async getAgent(entityRef: string): Promise<AiAgent | undefined> {
    const entity = await this.opts.catalogApi.getEntityByRef(entityRef);
    return entity ? entityToAgent(entity) : undefined;
  }

  async getStatuses(entityRefs: string[]): Promise<Record<string, AgentStatus>> {
    if (!entityRefs.length) return {};
    try {
      const res = await this.opts.fetchApi.fetch(
        `${this.basePath}/statuses?refs=${encodeURIComponent(entityRefs.join(','))}`,
      );
      if (!res.ok) return {};
      return (await res.json()) as Record<string, AgentStatus>;
    } catch {
      return {};
    }
  }

  async invokeAgent(
    entityRef: string,
    values: Record<string, string>,
  ): Promise<InvocationResult> {
    const res = await this.opts.fetchApi.fetch(
      `${this.basePath}/invocations/${encodeURIComponent(entityRef)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      },
    );
    const body = (await res.json()) as InvocationResult & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? `invocation failed (${res.status})`);
    }
    return body;
  }
}