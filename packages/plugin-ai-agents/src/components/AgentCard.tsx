import React from 'react';
import { Box, Card, CardActionArea, Chip, Typography } from '@mui/material';
import { chipClasses } from '@mui/material/Chip';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { AiAgent } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { RuntimeBadge } from './RuntimeBadge';
import { BillingBadge } from './BillingBadge';
import { getLinkIcon } from './linkIcon';

const LIFECYCLE_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  production: 'success',
  experimental: 'warning',
  deprecated: 'error',
};

export interface AgentCardProps {
  agent: AiAgent;
  onClick?: (agent: AiAgent) => void;
  onRuntimeClick?: (runtime: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onClick,
  onRuntimeClick,
}) => {
  const title = agent.title ?? agent.name;
  const lifecycleColor = agent.lifecycle
    ? LIFECYCLE_COLOR[agent.lifecycle] ?? 'default'
    : 'default';

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: theme => `box-shadow ${theme.transitions.duration.short}ms`,
        '&:hover': { boxShadow: 6 },
      }}
    >
      <CardActionArea
        onClick={() => onClick?.(agent)}
        sx={{ flexGrow: 1, p: 2, alignItems: 'stretch', display: 'flex' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Header: avatar + title + status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <AgentAvatar name={agent.name} avatarUrl={agent.avatarUrl} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap title={title}>
                {title}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {agent.name}
              </Typography>
            </Box>
            <AgentStatusBadge status={agent.status} />
          </Box>

          {/* Purpose */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.6em',
              mb: 1.5,
            }}
          >
            {agent.purpose || 'No description provided.'}
          </Typography>

          {/* Runtime + billing */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
            <RuntimeBadge
              runtime={agent.runtime.runtime}
              onClick={onRuntimeClick}
            />
            <BillingBadge billing={agent.billing} compact />
          </Box>

          {/* Capabilities */}
          {agent.capabilities.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <AgentCapabilities capabilities={agent.capabilities} />
            </Box>
          )}

          {/* Footer: owner + lifecycle + version */}
          <Box
            sx={{
              mt: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              flexWrap: 'wrap',
            }}
          >
            {agent.owner && (
              <Typography variant="caption" color="text.secondary">
                {agent.owner}
              </Typography>
            )}
            {agent.lifecycle && (
              <Chip
                size="small"
                color={lifecycleColor}
                label={agent.lifecycle}
                variant="outlined"
                sx={{ height: 20, [`& .${chipClasses.label}`]: { px: 0.75, fontSize: '0.7rem' } }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {agent.version ? `v${agent.version}` : 'N/A'}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>

      {/* Links: outside the click area so they never fight the card click */}
      {agent.links.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            flexWrap: 'wrap',
            px: 2,
            py: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {agent.links.slice(0, 4).map((l, i) => (
            <Chip
              key={i}
              size="small"
              variant="outlined"
              clickable
              component="a"
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              icon={getLinkIcon(l.icon)}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{l.title}</span>
                  <OpenInNewIcon sx={{ fontSize: 12 }} />
                </Box>
              }
              sx={{
                maxWidth: 160,
                [`& .${chipClasses.icon}`]: { fontSize: 14 },
                [`& .${chipClasses.label}`]: {
                  fontSize: '0.7rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          ))}
        </Box>
      )}
    </Card>
  );
};
