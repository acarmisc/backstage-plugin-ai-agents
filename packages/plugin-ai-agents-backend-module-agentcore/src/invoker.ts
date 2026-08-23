import { Config } from '@backstage/config';
import {
  AgentInvocationRequest,
  AgentInvocationResponse,
} from '@acarmisc/backstage-plugin-ai-agents-backend';

export interface AgentCoreConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  region: string;
  /** AWS account id, used to build the runtime ARN from a bare runtime id. */
  accountId?: string;
  timeoutMs: number;
}

export function readAgentCoreConfig(config: Config): AgentCoreConfig | undefined {
  const cfg = config.getOptionalConfig('ai-agents.invocations.agentCore');
  if (!cfg) return undefined;
  return {
    tokenUrl: cfg.getString('tokenUrl'),
    clientId: cfg.getString('clientId'),
    clientSecret: cfg.getString('clientSecret'),
    region: cfg.getString('region'),
    accountId: cfg.getOptionalString('accountId'),
    timeoutMs: cfg.getOptionalNumber('timeoutMs') ?? 120000,
  };
}

/** Encode a runtime ARN the way the AgentCore HTTPS endpoint expects. */
export function encodeRuntimeArnPath(arn: string): string {
  return encodeURIComponent(arn).replace(/%2F/g, '%2F');
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

/**
 * Extracts human-readable text from the various payload shapes AgentCore
 * runtimes return (plain text, {"result": ...}, {"output": {...}}, SSE...).
 */
export function extractResponseText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object') {
      const candidate =
        parsed.result ??
        parsed.response ??
        parsed.output ??
        parsed.text ??
        parsed.completion;
      if (typeof candidate === 'string') return candidate;
      if (candidate !== undefined) return JSON.stringify(candidate, null, 2);
      if (parsed.error || parsed.jsonrpc) {
        const message =
          typeof parsed.error === 'object'
            ? parsed.error.message ?? JSON.stringify(parsed.error)
            : String(parsed.error ?? 'unknown error');
        throw new Error(`AgentCore error: ${message}`);
      }
      return JSON.stringify(parsed, null, 2);
    }
    return body;
  } catch (err: any) {
    // JSON.parse failure on our own thrown error must propagate
    if (err instanceof Error && err.message.startsWith('AgentCore error:')) {
      throw err;
    }
    return body;
  }
}

/** Minimal OAuth2 client-credentials client with in-memory token cache. */
export class TokenClient {
  private cached?: CachedToken;

  constructor(
    private readonly opts: { tokenUrl: string; clientId: string; clientSecret: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getToken(): Promise<string> {
    if (this.cached && this.cached.expiresAtMs > Date.now() + 60000) {
      return this.cached.token;
    }
    const res = await this.fetchImpl(this.opts.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.opts.clientId,
        client_secret: this.opts.clientSecret,
      }),
    });
    if (!res.ok) {
      throw new Error(`token endpoint returned ${res.status}`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new Error('token endpoint response missing access_token');
    }
    this.cached = {
      token: data.access_token,
      expiresAtMs: Date.now() + (data.expires_in ?? 300) * 1000,
    };
    return this.cached.token;
  }
}

export class AgentCoreInvoker {
  private readonly config: AgentCoreConfig | undefined;
  private readonly tokens: TokenClient | undefined;

  constructor(config: Config, fetchImpl: typeof fetch = fetch) {
    this.config = readAgentCoreConfig(config);
    if (this.config) {
      this.tokens = new TokenClient(this.config, fetchImpl);
    }
    this.fetchImpl = fetchImpl;
  }

  private fetchImpl: typeof fetch;

  async invoke(req: AgentInvocationRequest): Promise<AgentInvocationResponse> {
    if (!this.config || !this.tokens) {
      throw new Error(
        'ai-agents.invocations.agentCore is not configured — cannot invoke agent',
      );
    }
    const region = req.target?.region ?? this.config.region;
    const runtimeHandle = req.target?.runtimeHandle;
    if (!region) {
      throw new Error('no AWS region: set the ai-agent.acarmisc.org/region annotation or ai-agents.invocations.agentCore.region');
    }
    if (!runtimeHandle) {
      throw new Error('agent has no runtime-handle annotation');
    }
    // The annotation conventionally carries the full runtime ARN; accept a
    // bare runtime id too when the account id is configured.
    const arn = runtimeHandle.startsWith('arn:')
      ? runtimeHandle
      : `arn:aws:bedrock-agentcore:${region}:${this.config.accountId}:runtime/${runtimeHandle}`;
    // The endpoint expects the ARN URL-encoded in the path.
    const url = `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/${encodeURIComponent(arn)}/invocations?qualifier=DEFAULT`;

    const token = await this.tokens.getToken();
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: req.prompt }),
      });
      const latencyMs = Date.now() - start;
      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(`AgentCore returned HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
      }
      return { responseText: extractResponseText(bodyText), latencyMs };
    } finally {
      clearTimeout(timer);
    }
  }
}
