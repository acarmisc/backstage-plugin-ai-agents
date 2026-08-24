import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { chipClasses } from '@mui/material/Chip';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WorkIcon from '@mui/icons-material/Work';
import type { AiAgent } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { RuntimeBadge } from './RuntimeBadge';
import { BillingBadge } from './BillingBadge';
import { AgentJobStats } from './AgentJobStats';
import { getLinkIcon } from './linkIcon';

export interface AgentCardProps {
  agent: AiAgent;
  onClick?: (agent: AiAgent) => void;
  onRuntimeClick?: (runtime: string) => void;
  onHire?: (agent: AiAgent) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onClick,
  onRuntimeClick,
  onHire,
}) => {
  const title = agent.title ?? agent.name;
  const owner = agent.owner?.replace(/^group:/, '');
  const footer = [owner, agent.lifecycle, agent.version ? `v${agent.version}` : undefined]
    .filter(Boolean)
    .join(' · ');

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
          {/* Header: avatar + title + status dot */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <AgentAvatar name={agent.name} avatarUrl={agent.avatarUrl} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap title={title}>
                {title}
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

          {/* Runtime + billing: quiet icon+text notes, styled like the footer */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
            <RuntimeBadge
              runtime={agent.runtime.runtime}
              onClick={onRuntimeClick}
              variant="text"
            />
            <BillingBadge billing={agent.billing} compact variant="text" />
          </Box>

          {/* Jobs summary (only when invocation history exists) */}
          <Box sx={{ mb: 1.5 }}>
            <AgentJobStats entityRef={agent.entityRef} />
          </Box>

          {/* Capabilities — secondary info, kept visually quiet */}
          {agent.capabilities.length > 0 && (
            <Box
              sx={{
                mb: 1.5,
                '& .MuiChip-root': {
                  height: 20,
                  color: 'text.secondary',
                  borderColor: 'divider',
                  [`& .${chipClasses.label}`]: { px: 0.75, fontSize: '0.65rem' },
                },
              }}
            >
              <AgentCapabilities capabilities={agent.capabilities} />
            </Box>
          )}

          {/* Footer: owner · lifecycle · version in one uniform muted style */}
          {footer && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              title={footer}
              sx={{ mt: 'auto', mb: 0.25 }}
            >
              {footer}
            </Typography>
          )}
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

      {/* Hire Agent: outside the click area so it never fights the card click */}
      {onHire && agent.hireSchema && agent.hireSchema.length > 0 && (
        <Box
          sx={{
            px: 2,
            pb: 1.5,
            pt: agent.links.length > 0 ? 0 : 1,
          }}
        >
          <Button
            size="small"
            variant="contained"
            color="primary"
            fullWidth
            startIcon={<WorkIcon />}
            onClick={e => {
              e.stopPropagation();
              onHire(agent);
            }}
          >
            Hire Agent
          </Button>
        </Box>
      )}
    </Card>
  );
};
