import { Entity } from '@backstage/catalog-model';
import { AI_AGENT_ANNOTATION_PREFIX, AI_AGENT_ANNOTATION_PREFIX_LEGACY } from './types';

const warnedLegacyAnnotations = new Set<string>();

function annotation(entity: Entity, key: string): string | undefined {
  const newValue = entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX}/${key}`];
  if (newValue !== undefined) {
    return newValue;
  }

  const legacyValue = entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX_LEGACY}/${key}`];
  if (legacyValue !== undefined) {
    const ref = `${entity.kind.toLowerCase()}:${entity.metadata.namespace ?? 'default'}/${entity.metadata.name}`;
    const warnKey = `${ref}|${key}`;
    if (!warnedLegacyAnnotations.has(warnKey)) {
      warnedLegacyAnnotations.add(warnKey);
      console.warn(
        `ai-agents: entity ${ref} uses the legacy "${AI_AGENT_ANNOTATION_PREFIX_LEGACY}/${key}" annotation — migrate to "${AI_AGENT_ANNOTATION_PREFIX}/${key}" (legacy prefix support will be removed).`,
      );
    }
  }

  return legacyValue;
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
 * Build a reasonably unique session id for an invocation.
 * Session id format is: `{entityName}-{timestamp}-{random}`.
 */
export function makeSessionId(entityName: string, random: () => string = defaultRandom): string {
  return `${entityName}-${Date.now().toString(36)}-${random()}`;
}

function defaultRandom(): string {
  return Math.random().toString(36).slice(2, 12);
}
