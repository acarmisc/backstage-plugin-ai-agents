import type { ProbeConfig, ProbeFn, ProbeResult } from './types';

export function readProbeConfig(config: import('@backstage/config').Config): ProbeConfig {
  const cfg = config.getOptionalConfig('ai-agents');
  return {
    enabled: cfg?.getOptionalBoolean('enabled') ?? true,
    probeTimeoutMs: cfg?.getOptionalNumber('probeTimeoutMs') ?? 3000,
    statusCacheTtlMs: cfg?.getOptionalNumber('statusCacheTtlMs') ?? 15000,
    probeAuthHeader: cfg?.getOptionalString('probeAuthHeader'),
    probeAllowlist: cfg?.getOptionalStringArray('probeAllowlist') ?? [],
  };
}

function matchesAllowlist(url: string, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  try {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`;
    return allowlist.some(pattern => {
      const re = new RegExp(
        `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
      );
      return re.test(origin) || re.test(url);
    });
  } catch {
    return false;
  }
}

export function buildProbeFn(globalFetch: typeof fetch): ProbeFn {
  return async (url, opts): Promise<ProbeResult> => {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'backstage-ai-agents/0.1',
      };
      if (opts.authHeader) headers.Authorization = opts.authHeader;
      const res = await globalFetch(url, {
        signal: controller.signal,
        headers,
      });
      const latencyMs = Date.now() - start;
      let snippet: string | undefined;
      try {
        snippet = (await res.text()).slice(0, 200);
      } catch {
        // ignore body read errors
      }
      return { ok: res.ok, status: res.status, latencyMs, snippet };
    } finally {
      clearTimeout(timer);
    }
  };
}

export function mapProbeResult(
  result: ProbeResult | { error: string },
): import('./types').AgentStatus {
  const lastChecked = new Date().toISOString();
  if ('error' in result) {
    return { state: 'down', lastChecked, message: result.error };
  }
  if (result.ok) {
    return { state: 'healthy', lastChecked, latencyMs: result.latencyMs };
  }
  if (result.status >= 500) {
    return { state: 'down', lastChecked, message: `HTTP ${result.status}` };
  }
  // 4xx / non-2xx but not 5xx → degraded
  return { state: 'degraded', lastChecked, message: `HTTP ${result.status}` };
}

export function isAllowed(url: string, allowlist: string[]): boolean {
  return matchesAllowlist(url, allowlist);
}