import { Entity } from '@backstage/catalog-model';
import { AI_AGENT_ANNOTATION_PREFIX } from './types';

function annotation(entity: Entity, key: string): string | undefined {
  return entity.metadata.annotations?.[`${AI_AGENT_ANNOTATION_PREFIX}/${key}`];
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
 * `ai-agent.acarmisc.org/prompt-template` annotation with the submitted
 * form values, or fall back to a JSON dump of the values.
 */
export function buildPrompt(entity: Entity, values: Record<string, string>): string {
  const template = annotation(entity, 'prompt-template');
  if (template) return fillTemplate(template, values);
  return JSON.stringify(values, null, 2);
}

/** AgentCore requires session ids of at least 33 characters. */
export function makeSessionId(entityName: string, random: () => string = defaultRandom): string {
  return `${entityName}-${Date.now().toString(36)}-${random()}`.padEnd(33, '0').slice(0, 80);
}

function defaultRandom(): string {
  return Math.random().toString(36).slice(2, 12);
}
