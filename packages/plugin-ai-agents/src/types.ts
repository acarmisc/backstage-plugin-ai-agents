import { Entity } from '@backstage/catalog-model';

/** Value of `spec.type` that marks a catalog Component as an AI agent. */
export const AI_AGENT_TYPE = 'ai-agent';

/** Annotation namespace for agent-specific fields on a catalog entity. */
export const AI_AGENT_ANNOTATION_PREFIX = 'ai-agent.acarmisc.org';

export type AgentRuntimeName =
  | 'bedrock-agentcore'
  | 'litellm'
  | 'lambda'
  | 'custom'
  | string;

export interface AgentRuntimeInfo {
  /** Runtime identifier, e.g. "bedrock-agentcore", "litellm", "lambda", "custom". */
  runtime: AgentRuntimeName;
  /** Opaque handle/ARN/identifier the backend uses to probe the agent. */
  runtimeHandle?: string;
  /** Public invocation endpoint, if any. */
  endpoint?: string;
  /** Health-check URL the backend can call. */
  healthUrl?: string;
}

export type AgentBillingModel =
  | 'per-invocation'
  | 'per-token'
  | 'subscription'
  | 'free'
  | string;

export interface AgentBilling {
  model: AgentBillingModel;
  /** Cost per 1000 invocations (per-invocation) or per 1M tokens (per-token). */
  unitCost?: number;
  /** Monthly spend cap if known. */
  budget?: number;
}

export type AgentCapabilityCategory =
  | 'reasoning'
  | 'retrieval'
  | 'tools'
  | 'vision'
  | 'voice'
  | 'data'
  | 'safety';

export interface AgentCapability {
  label: string;
  category?: AgentCapabilityCategory;
}

export type AgentStatusState = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface AgentStatus {
  state: AgentStatusState;
  lastChecked?: string;
  latencyMs?: number;
  message?: string;
}

export interface AiAgent {
  /** Backstage entity ref, e.g. "component:default/support-triage-agent". */
  entityRef: string;
  name: string;
  title?: string;
  description?: string;
  avatarUrl?: string;
  owner?: string;
  system?: string;
  lifecycle?: string;
  version?: string;
  /** Human-readable purpose (defaults to description when no dedicated field). */
  purpose: string;
  runtime: AgentRuntimeInfo;
  billing: AgentBilling;
  capabilities: AgentCapability[];
  tags: string[];
  links: { url: string; title: string; icon?: string }[];
  /** Populated by the backend status probe; undefined in the static view. */
  status?: AgentStatus;
  rawEntity: Entity;
}

const VALID_CATEGORIES = new Set<AgentCapabilityCategory>([
  'reasoning',
  'retrieval',
  'tools',
  'vision',
  'voice',
  'data',
  'safety',
]);

function annotation(entity: Entity, key: string): string | undefined {
  return entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX}/${key}`];
}

function parseFloatSafe(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseCapabilities(raw: string | undefined): AgentCapability[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(token => {
      const [label, catRaw] = token.split(':').map(s => s.trim());
      const category = catRaw ? (catRaw as AgentCapabilityCategory) : undefined;
      return {
        label,
        category:
          category && VALID_CATEGORIES.has(category) ? category : undefined,
      };
    });
}

function entityRef(entity: Entity): string {
  const ns = entity.metadata.namespace ?? 'default';
  return `${entity.kind.toLowerCase()}:${ns}/${entity.metadata.name}`;
}

function purpose(entity: Entity): string {
  const explicit = annotation(entity, 'purpose');
  return (explicit ?? entity.metadata.description ?? '').trim();
}

/** Map a Backstage catalog Component entity to the plugin's AiAgent shape. */
export function entityToAgent(
  entity: Entity,
  status?: AgentStatus,
): AiAgent | undefined {
  if (entity.spec?.type !== AI_AGENT_TYPE) return undefined;

  const links = (entity.metadata.links ?? []).map(l => ({
    url: l.url,
    title: l.title ?? l.url,
    icon: l.icon,
  }));

  return {
    entityRef: entityRef(entity),
    name: entity.metadata.name,
    title: entity.metadata.title,
    description: entity.metadata.description,
    avatarUrl: annotation(entity, 'avatar'),
    owner: (entity.spec as Record<string, unknown> | undefined)?.owner as
      | string
      | undefined,
    system: (entity.spec as Record<string, unknown> | undefined)?.system as
      | string
      | undefined,
    lifecycle: (entity.spec as Record<string, unknown> | undefined)?.lifecycle as
      | string
      | undefined,
    version: annotation(entity, 'version'),
    purpose: purpose(entity),
    runtime: {
      runtime: annotation(entity, 'runtime') ?? 'custom',
      runtimeHandle: annotation(entity, 'runtime-handle'),
      endpoint: annotation(entity, 'endpoint'),
      healthUrl: annotation(entity, 'health'),
    },
    billing: {
      model: annotation(entity, 'billing-model') ?? 'free',
      unitCost: parseFloatSafe(annotation(entity, 'cost-per-1k')),
      budget: parseFloatSafe(annotation(entity, 'budget')),
    },
    capabilities: parseCapabilities(annotation(entity, 'capabilities')),
    tags: entity.metadata.tags ?? [],
    links,
    status,
    rawEntity: entity,
  };
}