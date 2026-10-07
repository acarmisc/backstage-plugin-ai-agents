import React from 'react';
import { Grid } from '@backstage/ui';
import type { AiAgent } from '../types';
import { AgentCard } from './AgentCard';

export interface AgentsGridProps {
  agents: AiAgent[];
  onAgentClick?: (agent: AiAgent) => void;
  onRuntimeClick?: (runtime: string) => void;
  onHire?: (agent: AiAgent) => void;
}

export function AgentsGrid({
  agents,
  onAgentClick,
  onRuntimeClick,
  onHire,
}: AgentsGridProps) {
  return (
    <Grid.Root
      gap="4"
      // As many columns as fit, regardless of the viewport (the page can sit
      // beside a sidebar of any width).
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
    >
      {agents.map(a => (
        <AgentCard
          key={a.entityRef}
          agent={a}
          onClick={onAgentClick}
          onRuntimeClick={onRuntimeClick}
          onHire={onHire}
        />
      ))}
    </Grid.Root>
  );
}
