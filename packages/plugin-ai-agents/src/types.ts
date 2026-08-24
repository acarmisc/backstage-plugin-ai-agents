import { Entity } from '@backstage/catalog-model';

/** Value of `spec.type` that marks a catalog Component as an AI agent. */
export const AI_AGENT_TYPE = 'ai-agent';

/** Annotation namespace for agent-specific fields on a catalog entity. */
export const AI_AGENT_ANNOTATION_PREFIX = 'ai-agent.io';

/** Legacy annotation namespace, kept for backward compatibility. */
export const AI_AGENT_ANNOTATION_PREFIX_LEGACY = 'ai-agent.acarmisc.org';

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
  /** AWS region for the AgentCore runtime (e.g. "eu-west-1"), used by the Hire preview. */
  region?: string;
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

/**
 * A single field in an agent's "Hire Agent" form, declared on the catalog
 * entity via the `ai-agent.io/hire-schema` annotation (a JSON
 * array of these objects). Drives the dynamic form rendered by
 * `HireAgentDialog`.
 */
export type HireFieldType = 'text' | 'url' | 'textarea' | 'select' | 'number';

export interface HireField {
  /** Machine key for the field; used as the form-state key. */
  name: string;
  /** Human-readable label shown above the input. */
  label: string;
  /** Input type to render. */
  type: HireFieldType;
  /** Whether the field must be filled before the form can be submitted. */
  required?: boolean;
  /** Default value when the form opens. */
  default?: string;
  /** For `select` fields: the list of selectable options. */
  options?: string[];
  /** Optional helper text shown under the input. */
  help?: string;
}

export type AgentStatusState = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface AgentStatus {
  state: AgentStatusState;
  lastChecked?: string;
  latencyMs?: number;
  message?: string;
}

/** A persisted agent invocation, as returned by the backend history API. */
export interface InvocationRecord {
  id?: number;
  entityRef: string;
  userRef?: string | null;
  sessionId: string;
  prompt: string;
  status: 'ok' | 'error';
  responseText?: string | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  createdAt?: string;
}

/** A persisted agent review, as returned by the backend reviews API. */
export interface AgentReview {
  id?: number;
  entityRef: string;
  userRef?: string | null;
  /** Star rating, integer 0-5. */
  rating: number;
  comment?: string | null;
  createdAt?: string;
}

export interface ReviewsSummary {
  reviews: AgentReview[];
  count: number;
  average: number | null;
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
  /**
   * Per-agent "Hire Agent" form schema parsed from the
   * `ai-agent.io/hire-schema` annotation (JSON array). When
   * missing/empty, the Hire Agent CTA is hidden.
   */
  hireSchema?: HireField[];
  /**
   * Prompt template parsed from the `ai-agent.io/prompt-template`
   * annotation, with `{field_name}` placeholders matching `hireSchema`
   * fields. Used by the Hire preview to build the AgentCore invocation
   * payload. When missing, the form values are assembled as a default
   * JSON object prompt.
   */
  promptTemplate?: string;
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
  return (
    entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX}/${key}`] ??
    entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX_LEGACY}/${key}`]
  );
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

const VALID_HIRE_TYPES = new Set<HireFieldType>([
  'text',
  'url',
  'textarea',
  'select',
  'number',
]);

function parseHireSchema(raw: string | undefined): HireField[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .filter(
        (f: unknown): f is Record<string, unknown> =>
          !!f && typeof f === 'object',
      )
      .map(f => ({
        name: String(f.name ?? ''),
        label: String(f.label ?? f.name ?? ''),
        type: (VALID_HIRE_TYPES.has(f.type as HireFieldType)
          ? f.type
          : 'text') as HireFieldType,
        required: f.required === true,
        default: f.default !== undefined ? String(f.default) : undefined,
        options: Array.isArray(f.options)
          ? f.options.map((o: unknown) => String(o))
          : undefined,
        help:
          typeof f.help === 'string' && f.help ? f.help : undefined,
      }))
      .filter(f => f.name.length > 0);
  } catch {
    return undefined;
  }
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
      region: annotation(entity, 'region'),
    },
    billing: {
      model: annotation(entity, 'billing-model') ?? 'free',
      unitCost: parseFloatSafe(annotation(entity, 'cost-per-1k')),
      budget: parseFloatSafe(annotation(entity, 'budget')),
    },
    capabilities: parseCapabilities(annotation(entity, 'capabilities')),
    hireSchema: parseHireSchema(annotation(entity, 'hire-schema')),
    promptTemplate: annotation(entity, 'prompt-template'),
    tags: entity.metadata.tags ?? [],
    links,
    status,
    rawEntity: entity,
  };
}