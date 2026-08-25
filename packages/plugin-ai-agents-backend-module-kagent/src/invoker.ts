import { randomUUID } from 'node:crypto';
import { Config } from '@backstage/config';
import {
  AgentInvocationRequest,
  AgentInvocationResponse,
} from '@acarmisc/backstage-plugin-ai-agents-backend';

export interface KagentConfig {
  baseUrl: string;
  namespace: string;
  authHeader?: string;
  timeoutMs: number;
}

export function readKagentConfig(config: Config): KagentConfig | undefined {
  const cfg = config.getOptionalConfig('ai-agents.invocations.kagent');
  if (!cfg) return undefined;
  return {
    baseUrl: cfg.getString('baseUrl'),
    namespace: cfg.getOptionalString('namespace') ?? 'kagent',
    authHeader: cfg.getOptionalString('authHeader'),
    timeoutMs: cfg.getOptionalNumber('timeoutMs') ?? 120000,
  };
}

function textFromParts(parts: unknown): string | undefined {
  if (!Array.isArray(parts)) return undefined;
  const text = parts
    .map(p => (p && typeof p === 'object' && typeof (p as any).text === 'string' ? (p as any).text : undefined))
    .filter((t): t is string => !!t)
    .join('\n');
  return text || undefined;
}

/**
 * Extracts human-readable text from a kagent A2A `message/send` JSON-RPC
 * response, which — depending on the agent — resolves to either a Task
 * (text in `artifacts[].parts[]`) or a Message (text in `parts[]`).
 */
export function extractResponseText(body: string): string {
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  if (parsed?.error) {
    const message =
      typeof parsed.error === 'object'
        ? parsed.error.message ?? JSON.stringify(parsed.error)
        : String(parsed.error);
    throw new Error(`kagent A2A error: ${message}`);
  }
  const result = parsed?.result ?? parsed;
  const fromArtifacts = Array.isArray(result?.artifacts)
    ? result.artifacts.map((a: any) => textFromParts(a?.parts)).filter(Boolean).join('\n')
    : undefined;
  return (
    fromArtifacts ||
    textFromParts(result?.parts) ||
    textFromParts(result?.status?.message?.parts) ||
    JSON.stringify(result, null, 2)
  );
}

/**
 * Invokes an agent hosted on kagent (https://kagent.dev) via the A2A
 * protocol endpoint the kagent controller exposes at
 * `/api/a2a/{namespace}/{agent-name}/`.
 */
export class KagentInvoker {
  private readonly config: KagentConfig | undefined;

  constructor(config: Config, private readonly fetchImpl: typeof fetch = fetch) {
    this.config = readKagentConfig(config);
  }

  async invoke(req: AgentInvocationRequest): Promise<AgentInvocationResponse> {
    if (!this.config) {
      throw new Error('ai-agents.invocations.kagent is not configured — cannot invoke agent');
    }
    const namespace = req.target?.namespace ?? this.config.namespace;
    const agentName = req.target?.runtimeHandle;
    if (!agentName) {
      throw new Error(
        'agent has no runtime-handle annotation (expected the kagent agent name)',
      );
    }
    const base = req.target?.endpoint ?? this.config.baseUrl;
    const url = `${base.replace(/\/$/, '')}/api/a2a/${encodeURIComponent(namespace)}/${encodeURIComponent(agentName)}/`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.authHeader) headers.Authorization = this.config.authHeader;

    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          messageId: randomUUID(),
          contextId: req.sessionId,
          parts: [{ kind: 'text', text: req.prompt }],
        },
      },
    });

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body,
      });
      const latencyMs = Date.now() - start;
      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(`kagent returned HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
      }
      return { responseText: extractResponseText(bodyText), latencyMs };
    } finally {
      clearTimeout(timer);
    }
  }
}
