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
  /** Conversation thread this invocation belongs to. */
  threadId?: string | null;
  prompt: string;
  status: 'ok' | 'error';
  /** True when the invocation was allowed to perform external writes. */
  post?: boolean;
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
 * Structured invocation inputs resolved from the submitted form values.
 * These travel as first-class payload fields to the agent (its entrypoint
 * reads `target`, `project`, `post`, `model`, ...), separately from the
 * rendered `prompt` text.
 */
export interface AgentInvocationArgs {
  /** Jira issue key / MR IID, for reviewer agents. */
  target?: string;
  /** GitLab project path, for review agents. */
  project?: string;
  /**
   * Whether the agent may perform external writes (post comments/notes).
   * Always sent explicitly: an omitted value defaults to true agent-side,
   * which silently turns a dry-run into a posting run.
   */
  post: boolean;
  /** Optional model alias override (agent-side allowlisted). */
  model?: string;
  /** Knowledge-base ids to constrain retrieval (chat-grade agents). */
  knowledgeBaseIds?: string[];
  /** Agent mode hint (e.g. kagent/jared `reviewer` | `collaborator`). */
  mode?: string;
}

/**
 * Pluggable invocation transport. Implemented by provider modules
 * (e.g. `-backend-module-agentcore`, `-backend-module-kagent`) and
 * registered per-runtime through `aiAgentsExtensionPoint`.
 */
export interface AgentInvocationRequest {
  entityRef: string;
  sessionId: string;
  /** Conversation thread id; stable across turns of one conversation. */
  threadId: string;
  prompt: string;
  fields: Record<string, string>;
  /** Structured inputs the agent entrypoint reads directly. */
  args: AgentInvocationArgs;
  /** Cost-attribution / tracing tags forwarded to the LLM gateway. */
  tags: string[];
  /** User the invocation is attributed to (agent's trace_user_id). */
  traceUserId?: string;
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