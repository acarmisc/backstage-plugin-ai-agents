import React from 'react';
import { Box, Chip, Grid, Link, Tooltip, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MemoryIcon from '@mui/icons-material/Memory';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import FunctionsIcon from '@mui/icons-material/Functions';
import ExtensionIcon from '@mui/icons-material/Extension';
import { entityToAgent } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { BillingBadge } from './BillingBadge';
import { useEntity } from '@backstage/plugin-catalog-react';

const RUNTIME_ICON: Record<string, React.ReactNode> = {
  'bedrock-agentcore': <CloudQueueIcon fontSize="small" />,
  litellm: <MemoryIcon fontSize="small" />,
  lambda: <FunctionsIcon fontSize="small" />,
  custom: <ExtensionIcon fontSize="small" />,
};

const Field: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <Grid item xs={6}>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" sx={{ wordBreak: 'break-all' }} style={mono ? { fontFamily: 'monospace' } : undefined}>
      {value ?? '—'}
    </Typography>
  </Grid>
);

export const AgentOverviewCard: React.FC = () => {
  const { entity } = useEntity();
  if (!entity || entity.spec?.type !== 'ai-agent') return null;
  const agent = entityToAgent(entity);
  if (!agent) return null;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <AgentAvatar name={agent.name} avatarUrl={agent.avatarUrl} size={48} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>{agent.title ?? agent.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {agent.entityRef}
          </Typography>
        </Box>
        <AgentStatusBadge status={agent.status} />
      </Box>

      <Typography variant="body2" sx={{ mb: 2 }}>
        {agent.purpose || agent.description || 'No description provided.'}
      </Typography>

      <Grid container spacing={2}>
        <Field label="Runtime" value={
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {RUNTIME_ICON[agent.runtime.runtime] ?? <ExtensionIcon fontSize="small" />}
            {agent.runtime.runtime}
          </Box>
        } />
        <Field label="Billing" value={<BillingBadge billing={agent.billing} />} />
        <Field label="Owner" value={agent.owner} />
        <Field label="Lifecycle" value={agent.lifecycle} />
        <Field label="Version" value={agent.version ?? 'N/A'} />
        <Field label="System" value={agent.system} />
      </Grid>

      {agent.runtime.endpoint && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Endpoint</Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            <Link href={agent.runtime.endpoint} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              {agent.runtime.endpoint} <OpenInNewIcon sx={{ fontSize: 12 }} />
            </Link>
          </Typography>
        </Box>
      )}

      {agent.runtime.runtimeHandle && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">Runtime handle</Typography>
          <Typography variant="body2" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {agent.runtime.runtimeHandle}
          </Typography>
        </Box>
      )}

      {agent.capabilities.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Capabilities</Typography>
          <Box sx={{ mt: 0.5 }}>
            <AgentCapabilities capabilities={agent.capabilities} max={20} />
          </Box>
        </Box>
      )}

      {agent.tags.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Tags</Typography>
          <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {agent.tags.map(t => <Chip key={t} size="small" label={t} variant="outlined" />)}
          </Box>
        </Box>
      )}

      {agent.links.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Links</Typography>
          <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {agent.links.map((l, i) => (
              <Tooltip key={i} title={l.title}>
                <Link href={l.url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  {l.title} <OpenInNewIcon sx={{ fontSize: 12 }} />
                </Link>
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        <Link href={`/ai-agents`}>View on the AI Agents page</Link>
      </Box>
    </Box>
  );
};