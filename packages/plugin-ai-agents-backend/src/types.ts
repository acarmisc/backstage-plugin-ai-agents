export const AI_AGENT_TYPE = 'ai-agent';
export const AI_AGENT_ANNOTATION_PREFIX = 'ai-agent.io';
export const AI_AGENT_ANNOTATION_PREFIX_LEGACY = 'ai-agent.acarmisc.org';

export type AgentStatusState = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface AgentStatus {
  state: AgentStatusState;
  lastChecked?: string;
  latencyMs?: number;
  message?: string;
}

export interface ProbeConfig {
  enabled: boolean;
  probeTimeoutMs: number;
  statusCacheTtlMs: number;
  probeAuthHeader?: string;
  probeAllowlist: string[];
}

export interface ProbeResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  snippet?: string;
}

export interface ProbeFn {
  (url: string, opts: { timeoutMs: number; authHeader?: string }): Promise<ProbeResult>;
}

/** A persisted agent invocation. */
export interface InvocationRecord {
  id?: number;
  entityRef: string;
  /** User entity ref that triggered the invocation, when identifiable. */
  userRef?: string | null;
  sessionId: string;
  prompt: string;
  status: 'ok' | 'error';
  responseText?: string | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  createdAt?: string;
}

/** A persisted agent review (0-5 star rating + optional comment). */
export interface ReviewRecord {
  id?: number;
  entityRef: string;
  /** User entity ref that submitted the review, when identifiable. */
  userRef?: string | null;
  /** Star rating, integer 0-5. */
  rating: number;
  comment?: string | null;
  createdAt?: string;
}

export interface ReviewsSummary {
  reviews: ReviewRecord[];
  count: number;
  average: number | null;
}

/** Provider-agnostic invocation target resolved from entity annotations. */
export interface AgentTarget {
  region?: string;
  runtimeHandle?: string;
  endpoint?: string;
  /** e.g. the Kubernetes namespace for a kagent-hosted agent. */
  namespace?: string;
}

/**
 * Pluggable invocation transport. Implemented by provider modules
 * (e.g. `-backend-module-agentcore`, `-backend-module-kagent`) and
 * registered per-runtime through `aiAgentsExtensionPoint`.
 */
export interface AgentInvocationRequest {
  entityRef: string;
  sessionId: string;
  prompt: string;
  fields: Record<string, string>;
  /** Resolved from the entity's ai-agent.io/* annotations. */
  target: AgentTarget;
}

export interface AgentInvocationResponse {
  responseText: string;
  latencyMs: number;
}

export interface AgentInvoker {
  invoke(req: AgentInvocationRequest): Promise<AgentInvocationResponse>;
}