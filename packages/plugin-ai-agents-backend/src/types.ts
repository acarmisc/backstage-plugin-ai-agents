/** @public */
export const AI_AGENT_TYPE = 'ai-agent';
/** @public */
export const AI_AGENT_ANNOTATION_PREFIX = 'ai-agent.io';
/** @public */
export const AI_AGENT_ANNOTATION_PREFIX_LEGACY = 'ai-agent.acarmisc.org';

/** @public */
export type AgentStatusState = 'healthy' | 'degraded' | 'down' | 'unknown';

/** @public */
export interface AgentStatus {
  state: AgentStatusState;
  lastChecked?: string;
  latencyMs?: number;
  message?: string;
}

/** @public */
export type RunState = 'running' | 'completed' | 'failed' | 'unknown';

/** @public */
export interface RunEvent {
  seq: number;
  name: string;
  event: string;
  tool?: string;
  /** Pre-rendered display label, for sources that have no tool name. */
  label?: string;
  durationMs?: number;
  outcome?: string;
  target?: string;
  project?: string;
  incomplete?: string;
  ts?: string;
}

/** @public */
export interface AgentRun {
  runId: string;
  agent: string;
  target?: string;
  project?: string;
  mode?: string;
  state: RunState;
  startedAt?: string;
  updatedAt?: string;
  currentActivity?: string;
  seq?: number;
  verdict?: string;
  events?: RunEvent[];
}

/**
 * Per-tool aggregate over the insights window.
 *
 * @public
 */
export interface ToolStat {
  name: string;
  calls: number;
  errors: number;
  avgMs: number;
  p95Ms: number;
}

/**
 * One hour of run counts (UTC hour start, ISO).
 *
 * @public
 */
export interface HourBucket {
  start: string;
  runs: number;
  failed: number;
}

/**
 * Aggregates for one agent over the last `windowHours`.
 *
 * @public
 */
export interface AgentInsights {
  windowHours: number;
  totals: {
    runs: number;
    running: number;
    completed: number;
    failed: number;
    unknown: number;
  };
  /** Over finished runs (completed/failed); 0 when there are none. */
  durationMs: { p50: number; p95: number };
  /** Exactly `windowHours` buckets, oldest first. */
  histogram: HourBucket[];
  /** Top 10 tools by number of calls, descending. */
  tools: ToolStat[];
}

/**
 * Recent runs of one agent, as returned by `GET /activity`.
 *
 * @public
 */
export interface AgentActivity {
  entityRef: string;
  /** Value of the `ai-agent.io/telemetry-id` annotation. */
  telemetryId: string;
  title?: string;
  /** Value of the `ai-agent.io/avatar` annotation. */
  avatarUrl?: string;
  /** Newest first, without `events`. */
  runs: AgentRun[];
  /** Set, with empty `runs`, when the telemetry query for this agent failed. */
  error?: string;
}

/**
 * Server-side adapter for an OTel store. The router resolves the catalog
 * entity's telemetry id before calling this interface, keeping catalog access
 * and provider credentials outside the browser.
 *
 * @public
 */
export interface TelemetryProvider {
  getRuns(telemetryId: string, limit?: number): Promise<AgentRun[]>;
  getRunTimeline(
    telemetryId: string,
    runId: string,
  ): Promise<RunEvent[] | null>;
  /** Optional aggregates for the agent workspace; routes answer 501 when absent. */
  getInsights?(telemetryId: string, hours: number): Promise<AgentInsights>;
}

/** @public */
export interface ProbeConfig {
  enabled: boolean;
  probeTimeoutMs: number;
  statusCacheTtlMs: number;
  probeAuthHeader?: string;
  probeAllowlist: string[];
}

/** @public */
export interface ProbeResult {
  ok: boolean;
  status: number;
  latencyMs: number;
}

/** @public */
export interface ProbeFn {
  (
    url: string,
    opts: { timeoutMs: number; authHeader?: string },
  ): Promise<ProbeResult>;
}

/**
 * A persisted agent invocation.
 *
 * @public
 */
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

/**
 * A persisted agent review (0-5 star rating + optional comment).
 *
 * @public
 */
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

/** @public */
export interface ReviewsSummary {
  reviews: ReviewRecord[];
  count: number;
  average: number | null;
}

/**
 * Provider-agnostic invocation target resolved from entity annotations.
 *
 * @public
 */
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
 *
 * @public
 */
export interface AgentInvocationArgs {
  /** What the agent works on, e.g. an issue key or merge request id. */
  target?: string;
  /** Repository or project the target belongs to. */
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
  /** Agent-defined mode hint, e.g. `reviewer`. */
  mode?: string;
}

/**
 * Pluggable invocation transport. Implemented by provider modules
 * (e.g. `-backend-module-agentcore`, `-backend-module-kagent`) and
 * registered per-runtime through `aiAgentsExtensionPoint`.
 *
 * @public
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

/** @public */
export interface AgentInvocationResponse {
  responseText: string;
  latencyMs: number;
}

/** @public */
export interface AgentInvoker {
  invoke(req: AgentInvocationRequest): Promise<AgentInvocationResponse>;
}
