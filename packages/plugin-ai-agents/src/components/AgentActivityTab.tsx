import React from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { entityToAgent } from '../types';
import { AgentActivityTabView } from './AgentActivityTabView';

/**
 * Catalog entity tab ("Activity") for `spec.type: ai-agent` entities: the same
 * workspace panel as the activity page, scoped to this agent.
 */
export function AgentActivityTab() {
  const { entity } = useEntity();
  const agent =
    entity?.spec?.type === 'ai-agent' ? entityToAgent(entity) : undefined;
  return <AgentActivityTabView agent={agent} />;
}
