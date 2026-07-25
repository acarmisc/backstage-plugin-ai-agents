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
}