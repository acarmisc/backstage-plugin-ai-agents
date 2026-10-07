import React from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { entityToAgent } from '../types';
import { AgentInvocationsCardView } from './AgentInvocationsCardView';

/**
 * Entity-page card listing recent invocations for an ai-agent Component.
 */
export function AgentInvocationsCard() {
  const { entity } = useEntity();
  const agent = entityToAgent(entity);
  if (!agent) return null;
  return <AgentInvocationsCardView entityRef={agent.entityRef} />;
}
