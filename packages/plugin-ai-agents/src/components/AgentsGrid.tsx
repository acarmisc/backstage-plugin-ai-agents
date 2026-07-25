import React from 'react';
import Box from '@mui/material/Box';
import type { AiAgent } from '../types';
import { AgentCard } from './AgentCard';

export interface AgentsGridProps {
  agents: AiAgent[];
  onAgentClick?: (agent: AiAgent) => void;
  onRuntimeClick?: (runtime: string) => void;
}

export const AgentsGrid: React.FC<AgentsGridProps> = ({
  agents,
  onAgentClick,
  onRuntimeClick,
}) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 2,
      }}
    >
      {agents.map(a => (
        <AgentCard
          key={a.entityRef}
          agent={a}
          onClick={onAgentClick}
          onRuntimeClick={onRuntimeClick}
        />
      ))}
    </Box>
  );
};