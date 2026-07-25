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