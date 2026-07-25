import React from 'react';
import { Box, Card, CardActionArea, Chip, Link, Tooltip, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import BugReportIcon from '@mui/icons-material/BugReport';
import type { AiAgent } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { RuntimeBadge } from './RuntimeBadge';
import { BillingBadge } from './BillingBadge';

const LIFECYCLE_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  production: 'success',
  experimental: 'warning',
  deprecated: 'error',
};

const LINK_ICON: Record<string, React.ReactNode> = {
  dashboard: <DashboardIcon fontSize="small" />,
  docs: <DescriptionIcon fontSize="small" />,
  playbook: <ArticleIcon fontSize="small" />,
  issues: <BugReportIcon fontSize="small" />,
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

          {/* Runtime */}
          <Box sx={{ mb: 1 }}>
            <RuntimeBadge
              runtime={agent.runtime.runtime}
              onClick={onRuntimeClick}
            />
          </Box>

          {/* Capabilities */}
          {agent.capabilities.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <AgentCapabilities capabilities={agent.capabilities} />
            </Box>
          )}

          {/* Billing */}
          <Box sx={{ mb: 1.5 }}>
            <BillingBadge billing={agent.billing} />
          </Box>

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
                sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
              />
            )}
            {agent.version && (
              <Typography variant="caption" color="text.secondary">
                v{agent.version}
              </Typography>
            )}
          </Box>

          {/* Links */}
          {agent.links.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              {agent.links.slice(0, 4).map((l, i) => (
                <Tooltip key={i} title={l.title}>
                  <Link
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    sx={{ display: 'inline-flex', color: 'text.secondary' }}
                  >
                    {LINK_ICON[l.icon ?? ''] ?? <DescriptionIcon fontSize="small" />}
                  </Link>
                </Tooltip>
              ))}
            </Box>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
};