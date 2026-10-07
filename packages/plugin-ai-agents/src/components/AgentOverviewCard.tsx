import React from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { entityToAgent } from '../types';
import { AgentOverviewCardView } from './AgentOverviewCardView';

/** @public */
export function AgentOverviewCard() {
  const { entity } = useEntity();
  const agent =
    entity && entity.spec?.type === 'ai-agent'
      ? entityToAgent(entity)
      : undefined;
  return <AgentOverviewCardView agent={agent} />;
}
