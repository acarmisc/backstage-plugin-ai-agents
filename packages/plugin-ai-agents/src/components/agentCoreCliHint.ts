import type { AiAgent } from '../types';

/** Escape single quotes in a string for POSIX shell single-quoting. */
export function shellEscapeSingleQuoted(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

/** Build the equivalent AWS CLI command for the AgentCore invocation. */
export function buildCliCommand(
  agent: AiAgent,
  payload: { prompt: string },
  sessionId: string,
): string {
  const region = agent.runtime.region ?? '<region>';
  const handle = agent.runtime.runtimeHandle ?? '<runtime-handle>';
  const body = JSON.stringify(payload);
  return [
    'aws bedrock-agentcore invoke-agent-runtime',
    `--region '${shellEscapeSingleQuoted(region)}'`,
    `--agent-runtime-id '${shellEscapeSingleQuoted(handle)}'`,
    `--runtime-session-id '${shellEscapeSingleQuoted(sessionId)}'`,
    `--payload '${shellEscapeSingleQuoted(body)}'`,
  ].join(' \\\n  ');
}

/** AgentCore enforces session ids of at least 33 characters. */
export function makeSessionId(): string {
  const raw = `hire-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return raw.padEnd(33, '0').slice(0, 80);
}
