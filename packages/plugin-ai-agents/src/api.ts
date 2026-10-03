import { createApiRef, FetchApi } from '@backstage/core-plugin-api';
import type { CatalogApi } from '@backstage/catalog-client';
import {
  AI_AGENT_TYPE,
  AiAgent,
  AgentStatus,
  AgentRun,
  AgentActivity,
  AgentInsights,
  entityToAgent,
  InvocationRecord,
  ReviewsSummary,
  RunEvent,
} from './types';

export interface AiAgentsApiInterface {
  listAgents(): Promise<AiAgent[]>;
  getAgent(entityRef: string): Promise<AiAgent | undefined>;
  /** Probe live status for the given entity refs via the backend. */
  getStatuses(entityRefs: string[]): Promise<Record<string, AgentStatus>>;
  /**
   * Run the Hire Agent invocation for the given entity with form values.
   * `threadId` continues an existing conversation; `post` overrides the
   * dry-run default (used by the confirm-and-publish step).
   */
  invokeAgent(
    entityRef: string,
    values: Record<string, string>,
    opts?: { threadId?: string; post?: boolean },
  ): Promise<InvocationResult>;
  /** Recent invocations for an agent, latest first. */
  getInvocations(
    entityRef: string,
    limit?: number,
  ): Promise<InvocationRecord[]>;
  /** Recent OTel runs; empty when the telemetry adapter is not configured. */
  getRuns(entityRef: string, limit?: number): Promise<AgentRun[]>;
  /** Ordered activity events for one OTel run. */
  getRunTimeline(entityRef: string, runId: string): Promise<RunEvent[] | null>;
  /** Fleet activity across all agents; empty when telemetry is not configured (501 status). */
  getActivity(limit?: number): Promise<AgentActivity[]>;
  /** Aggregated insights for an agent over a time window; null when telemetry is not configured (501/404). */
  getInsights(entityRef: string, hours?: number): Promise<AgentInsights | null>;
  /** Reviews (latest first) plus count and average rating for an agent. */
  getReviews(entityRef: string, limit?: number): Promise<ReviewsSummary>;
  /** Submit a 0-5 star review with an optional comment. */
  addReview(
    entityRef: string,
    review: { rating: number; comment?: string },
  ): Promise<{ id: number }>;
  /**
   * Aggregated LiteLLM spend attributed to a thread (or the whole agent when
   * no thread is given). Returns null when LiteLLM is not configured.
   */
  getSpend(
    entityRef: string,
    opts?: { threadId?: string; days?: number },
  ): Promise<SpendSummary | null>;
  /**
   * Fetch the agent's avatar through the backend proxy (which resolves it
   * with the platform's integration credentials and caches it). Returns
   * undefined when the proxy is disabled, the URL is not proxyable, or the
   * upstream fetch failed — callers fall back to the direct `avatarUrl`.
   */
  getAvatar(entityRef: string): Promise<Blob | undefined>;
}

/** Aggregated LLM spend for an agent or one conversation thread. */
export interface SpendSummary {
  spend: number;
  totalTokens: number;
  requests: number;
  byModel: Record<string, number>;
}

export interface InvocationResult {
  sessionId: string;
  /** Thread the invocation belongs to; pass it back to continue the chat. */
  threadId?: string;
  /** Whether the run was allowed to perform external writes. */
  post?: boolean;
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

  async getStatuses(
    entityRefs: string[],
  ): Promise<Record<string, AgentStatus>> {
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
    opts: { threadId?: string; post?: boolean } = {},
  ): Promise<InvocationResult> {
    const res = await this.opts.fetchApi.fetch(
      `${this.basePath}/invocations/${encodeURIComponent(entityRef)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values,
          ...(opts.threadId ? { threadId: opts.threadId } : {}),
          ...(opts.post !== undefined ? { post: opts.post } : {}),
        }),
      },
    );
    const body = (await res.json()) as InvocationResult & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? `invocation failed (${res.status})`);
    }
    return body;
  }

  async getInvocations(
    entityRef: string,
    limit = 20,
  ): Promise<InvocationRecord[]> {
    try {
      const res = await this.opts.fetchApi.fetch(
        `${this.basePath}/invocations/${encodeURIComponent(entityRef)}?limit=${limit}`,
      );
      if (!res.ok) return [];
      return (await res.json()) as InvocationRecord[];
    } catch {
      return [];
    }
  }

  async getRuns(entityRef: string, limit = 5): Promise<AgentRun[]> {
    try {
      const res = await this.opts.fetchApi.fetch(
        `${this.basePath}/runs/${encodeURIComponent(entityRef)}?limit=${limit}`,
      );
      if (!res.ok) return [];
      return (await res.json()) as AgentRun[];
    } catch {
      return [];
    }
  }

  async getRunTimeline(
    entityRef: string,
    runId: string,
  ): Promise<RunEvent[] | null> {
    try {
      const res = await this.opts.fetchApi.fetch(
        `${this.basePath}/runs/${encodeURIComponent(entityRef)}/${encodeURIComponent(runId)}`,
      );
      if (!res.ok) return null;
      return (await res.json()) as RunEvent[];
    } catch {
      return null;
    }
  }

  async getActivity(limit = 20): Promise<AgentActivity[]> {
    const res = await this.opts.fetchApi.fetch(
      `${this.basePath}/activity?limit=${limit}`,
    );
    // 501 means telemetry not configured
    if (res.status === 501) return [];
    if (!res.ok) {
      throw new Error(`Failed to load activity: ${res.status}`);
    }
    return (await res.json()) as AgentActivity[];
  }

  async getInsights(
    entityRef: string,
    hours = 24,
  ): Promise<AgentInsights | null> {
    try {
      const res = await this.opts.fetchApi.fetch(
        `${this.basePath}/insights/${encodeURIComponent(entityRef)}?hours=${hours}`,
      );
      // 501 and 404 mean telemetry not configured or agent not found
      if (res.status === 501 || res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Failed to load insights: ${res.status}`);
      }
      return (await res.json()) as AgentInsights;
    } catch (err) {
      // Rethrow non-HTTP errors
      if (err instanceof Error && err.message.startsWith('Failed to load')) {
        throw err;
      }
      return null;
    }
  }

  async getReviews(entityRef: string, limit = 50): Promise<ReviewsSummary> {
    const res = await this.opts.fetchApi.fetch(
      `${this.basePath}/reviews/${encodeURIComponent(entityRef)}?limit=${limit}`,
    );
    if (!res.ok) {
      throw new Error(`failed to load reviews (${res.status})`);
    }
    return (await res.json()) as ReviewsSummary;
  }

  async getSpend(
    entityRef: string,
    opts: { threadId?: string; days?: number } = {},
  ): Promise<SpendSummary | null> {
    const params = new URLSearchParams();
    if (opts.threadId) params.append('thread', opts.threadId);
    if (opts.days) params.append('days', String(opts.days));
    const query = params.toString();
    try {
      const res = await this.opts.fetchApi.fetch(
        `${this.basePath}/invocations/${encodeURIComponent(entityRef)}/spend${query ? `?${query}` : ''}`,
      );
      // 501 = LiteLLM not configured; treat as "no spend data" rather than
      // an error so callers can hide the section cleanly.
      if (!res.ok) return null;
      return (await res.json()) as SpendSummary;
    } catch {
      return null;
    }
  }

  async getAvatar(entityRef: string): Promise<Blob | undefined> {
    try {
      const res = await this.opts.fetchApi.fetch(
        `${this.basePath}/avatar/${encodeURIComponent(entityRef)}`,
      );
      if (!res.ok) return undefined;
      return await res.blob();
    } catch {
      return undefined;
    }
  }

  async addReview(
    entityRef: string,
    review: { rating: number; comment?: string },
  ): Promise<{ id: number }> {
    const res = await this.opts.fetchApi.fetch(
      `${this.basePath}/reviews/${encodeURIComponent(entityRef)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review),
      },
    );
    const body = (await res.json()) as { id?: number; error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? `review failed (${res.status})`);
    }
    return { id: body.id ?? 0 };
  }
}
