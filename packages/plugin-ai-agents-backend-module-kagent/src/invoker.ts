import { randomUUID } from 'node:crypto';
import { Config } from '@backstage/config';
import {
  AgentInvocationRequest,
  AgentInvocationResponse,
} from '@acarmisc/backstage-plugin-ai-agents-backend';

/** @public */
export interface KagentConfig {
  baseUrl: string;
  namespace: string;
  authHeader?: string;
  timeoutMs: number;
}

/** @public */
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

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function textFromParts(parts: unknown): string | undefined {
  if (!Array.isArray(parts)) return undefined;
  const text = parts
    .map(p =>
      p && typeof p === 'object' && typeof (p as any).text === 'string'
        ? (p as any).text
        : undefined,
    )
    .filter((t): t is string => !!t)
    .join('\n');
  return text || undefined;
}

/**
 * Extracts human-readable text from a kagent A2A `message/send` JSON-RPC
 * response, which — depending on the agent — resolves to either a Task
 * (text in `artifacts[].parts[]`) or a Message (text in `parts[]`).
 *
 * @public
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
        ? (parsed.error.message ?? JSON.stringify(parsed.error))
        : String(parsed.error);
    throw new Error(`kagent A2A error: ${message}`);
  }
  const result = parsed?.result ?? parsed;
  const fromArtifacts = Array.isArray(result?.artifacts)
    ? result.artifacts
        .map((a: any) => textFromParts(a?.parts))
        .filter(Boolean)
        .join('\n')
    : undefined;
  return (
    fromArtifacts ||
    textFromParts(result?.parts) ||
    textFromParts(result?.status?.message?.parts) ||
    JSON.stringify(result, null, 2)
  );
}

/**
 * Maps the invocation request onto the A2A message `metadata` sent alongside
 * the prompt: `post` (always explicit, so a missing value can't default
 * agent-side into a write), plus the structured `target`, `project`, `model`,
 * `knowledge_base_ids`, `mode`, `litellm_tags` and `trace_user_id` fields.
 *
 * @public
 */
export function buildMessageMetadata(
  req: AgentInvocationRequest,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    post: req.args.post,
  };
  if (req.args.target) metadata.target = req.args.target;
  if (req.args.project) metadata.project = req.args.project;
  if (req.args.model) metadata.model = req.args.model;
  if (req.args.mode) metadata.mode = req.args.mode;
  if (req.args.knowledgeBaseIds?.length) {
    metadata.knowledge_base_ids = req.args.knowledgeBaseIds;
  }
  metadata.litellm_tags = [`agent:${runtimeName(req.entityRef)}`, ...req.tags];
  if (req.traceUserId) metadata.trace_user_id = req.traceUserId;
  return metadata;
}

/** The agent name (last ref segment) used as the per-agent cost tag. */
function runtimeName(entityRef: string): string {
  const name = entityRef.split('/').pop();
  return name || entityRef;
}

/**
 * Invokes an agent hosted on kagent (https://kagent.dev) via the A2A
 * protocol endpoint the kagent controller exposes at
 * `/api/a2a/{namespace}/{agent-name}/`.
 *
 * @public
 */
export class KagentInvoker {
  private readonly config: KagentConfig | undefined;

  constructor(
    config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.config = readKagentConfig(config);
  }

  async invoke(req: AgentInvocationRequest): Promise<AgentInvocationResponse> {
    if (!this.config) {
      throw new Error(
        'ai-agents.invocations.kagent is not configured — cannot invoke agent',
      );
    }
    const namespace = req.target?.namespace ?? this.config.namespace;
    const agentName = req.target?.runtimeHandle;
    if (!agentName) {
      throw new Error(
        'agent has no runtime-handle annotation (expected the kagent agent name)',
      );
    }
    const base = req.target?.endpoint ?? this.config.baseUrl;
    if (!sameOrigin(base, this.config.baseUrl)) {
      throw new Error(
        'agent endpoint is not on the configured kagent controller origin',
      );
    }
    const url = `${base.replace(/\/$/, '')}/api/a2a/${encodeURIComponent(namespace)}/${encodeURIComponent(agentName)}/`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // The endpoint annotation is catalog-authored: only send the configured
    // credential to the configured controller, never to another origin.
    if (this.config.authHeader && sameOrigin(base, this.config.baseUrl)) {
      headers.Authorization = this.config.authHeader;
    }

    // `contextId` carries the conversation thread so multi-turn memory is
    // preserved across invocations of the same thread.
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          messageId: randomUUID(),
          contextId: req.threadId,
          parts: [{ kind: 'text', text: req.prompt }],
          metadata: buildMessageMetadata(req),
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
        throw new Error(
          `kagent returned HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
        );
      }
      return { responseText: extractResponseText(bodyText), latencyMs };
    } finally {
      clearTimeout(timer);
    }
  }
}
