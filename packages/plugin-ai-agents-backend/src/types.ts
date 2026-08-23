export const AI_AGENT_TYPE = 'ai-agent';
export const AI_AGENT_ANNOTATION_PREFIX = 'ai-agent.acarmisc.org';

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

/** Provider-agnostic invocation target resolved from entity annotations. */
export interface AgentTarget {
  region?: string;
  runtimeHandle?: string;
  endpoint?: string;
}

/**
 * Pluggable invocation transport. Implemented by provider modules
 * (e.g. `-backend-module-agentcore`) and registered through
 * `aiAgentsExtensionPoint`.
 */
export interface AgentInvocationRequest {
  entityRef: string;
  sessionId: string;
  prompt: string;
  fields: Record<string, string>;
  /** Resolved from the entity's ai-agent.acarmisc.org/* annotations. */
  target: AgentTarget;
}

export interface AgentInvocationResponse {
  responseText: string;
  latencyMs: number;
}

export interface AgentInvoker {
  invoke(req: AgentInvocationRequest): Promise<AgentInvocationResponse>;
}