import React from 'react';
import { Box, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { useEntity } from '@backstage/plugin-catalog-react';
import { entityToAgent } from '../types';
import { InvocationHistory } from './InvocationHistory';

/**
 * Entity-page card listing recent invocations for an ai-agent Component.
 * Hidden entirely when the agent has no recorded invocations yet.
 */
export const AgentInvocationsCard: React.FC = () => {
  const { entity } = useEntity();
  const agent = entityToAgent(entity);
  if (!agent) return null;

  return (
    <Box sx={{ pt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <HistoryIcon fontSize="small" />
        <Typography variant="h6">Recent invocations</Typography>
      </Box>
      <InvocationHistory
        entityRef={agent.entityRef}
        limit={10}
        emptyText="No invocations recorded yet. Use the Hire Agent action to run this agent."
      />
    </Box>
  );
};
