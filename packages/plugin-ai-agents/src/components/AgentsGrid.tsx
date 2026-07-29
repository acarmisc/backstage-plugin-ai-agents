import React from 'react';
import Box from '@mui/material/Box';
import type { AiAgent } from '../types';
import { AgentCard } from './AgentCard';

export interface AgentsGridProps {
  agents: AiAgent[];
  onAgentClick?: (agent: AiAgent) => void;
  onRuntimeClick?: (runtime: string) => void;
  onHire?: (agent: AiAgent) => void;
}

export const AgentsGrid: React.FC<AgentsGridProps> = ({
  agents,
  onAgentClick,
  onRuntimeClick,
  onHire,
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
          onHire={onHire}
        />
      ))}
    </Box>
  );
};