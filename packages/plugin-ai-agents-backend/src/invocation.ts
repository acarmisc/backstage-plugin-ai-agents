import { Entity } from '@backstage/catalog-model';
import { AI_AGENT_ANNOTATION_PREFIX, AI_AGENT_ANNOTATION_PREFIX_LEGACY } from './types';
import type { AgentInvocationArgs } from './types';

function annotation(entity: Entity, key: string): string | undefined {
  return (
    entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX}/${key}`] ??
    entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX_LEGACY}/${key}`]
  );
}

/** Replace `{name}` placeholders in the template with `values[name]`. */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] !== undefined ? values[key] : `{${key}}`,
  );
}

/**
 * Build the invocation prompt for an entity: fill the
 * `ai-agent.io/prompt-template` annotation with the submitted
 * form values, or fall back to a JSON dump of the values.
 */
export function buildPrompt(entity: Entity, values: Record<string, string>): string {
  const template = annotation(entity, 'prompt-template');
  if (template) return fillTemplate(template, values);
  return JSON.stringify(values, null, 2);
}

/**
 * Normalize an arbitrary thread id into a stable AgentCore session id:
 * ASCII alphanumerics and hyphens only, at least 33 chars. A content-hash
 * suffix keeps the mapping deterministic and injective in practice. Mirrors
 * the MCP gateway's normalization so the same thread maps to the same
 * AgentCore session whether invoked via Backstage or via MCP.
 */
export function normalizeSessionId(threadId: string): string {
  const sid = threadId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  let hash = 0;
  for (let i = 0; i < sid.length; i++) {
    hash = (hash * 31 + sid.charCodeAt(i)) | 0;
  }
  const suffix = `-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  return (sid.slice(0, 33 - suffix.length) + suffix).padEnd(33, '-');
}

/** A stable, human-readable thread id for a new conversation. */
export function makeThreadId(entityName: string, random: () => string = defaultRandom): string {
  return `${entityName}-${Date.now().toString(36)}-${random()}`;
}

/**
 * Resolve the structured agent inputs from the submitted form values.
 * Reviewer agents expect `target`/`project` plus an explicit `post`
 * boolean (their entrypoint defaults an omitted `post` to true). The
 * `action: dry-run|post` select shipped in their hire schema is the
 * source for that boolean; an explicit request-level override wins.
 */
export function buildInvocationArgs(
  values: Record<string, string>,
  overrides: { post?: boolean } = {},
): AgentInvocationArgs {
  const action = values.action?.toLowerCase();
  const post =
    overrides.post !== undefined
      ? overrides.post
      : action === 'post' || values.post === 'true';
  const args: AgentInvocationArgs = { post };
  if (values.target) args.target = values.target;
  if (values.project) args.project = values.project;
  if (values.model) args.model = values.model;
  if (values.mode) args.mode = values.mode;
  return args;
}

/**
 * Base cost-attribution / tracing tags. `session:<thread>` preserves the
 * conversation code so spend can be grouped per thread in LiteLLM, and
 * matches the tag vocabulary the MCP gateway already writes.
 */
export function buildInvocationTags(opts: {
  threadId: string;
  userRef?: string;
  entityRef: string;
}): string[] {
  const tags = ['channel:backstage', `session:${opts.threadId}`];
  if (opts.userRef) tags.push(`invoked-by:${opts.userRef}`);
  tags.push(`backstage-entity:${opts.entityRef}`);
  return tags;
}

function defaultRandom(): string {
  return Math.random().toString(36).slice(2, 12);
}
