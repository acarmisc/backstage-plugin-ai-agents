import React, { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TimelineIcon from '@mui/icons-material/Timeline';
import WorkIcon from '@mui/icons-material/Work';
import { useNavigate } from 'react-router-dom';
import type { AiAgent } from '../types';
import { isSafeUrl } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { RuntimeBadge } from './RuntimeBadge';
import { BillingBadge } from './BillingBadge';
import { getLinkIcon } from './linkIcon';
import { useAvatarSrc } from '../hooks/useAvatarBlob';

import { InvocationHistory } from './InvocationHistory';
import { AgentReviews } from './AgentReviews';
import { AgentSpend } from './AgentSpend';

export interface AgentDetailDrawerProps {
  agent: AiAgent | null;
  open: boolean;
  onClose: () => void;
  onRefreshStatus?: (entityRef: string) => void;
  onHire?: (agent: AiAgent) => void;
  /** Bump to refetch the invocation history (e.g. after a new run). */
  historyReloadKey?: number;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110, flexShrink: 0 }}>
      {label}
    </Typography>
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>{children}</Box>
  </Box>
);

const SafeLink: React.FC<{ text: string }> = ({ text }) => {
  const [kind, rest] = text.split(':');
  const [ns, name] = (rest ?? 'default/').split('/');
  return (
    <Link href={`/catalog/${ns ?? 'default'}/${kind}/${name}`}>
      Open in catalog <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
    </Link>
  );
};

export const AgentDetailDrawer: React.FC<AgentDetailDrawerProps> = ({
  agent,
  open,
  onClose,
  onRefreshStatus,
  onHire,
  historyReloadKey = 0,
}) => {
  const navigate = useNavigate();
  const avatarSrc = useAvatarSrc(agent?.entityRef, agent?.avatarUrl);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  if (!agent) return null;
  const title = agent.title ?? agent.name;

  const copyRef = () => {
    navigator.clipboard?.writeText(agent.entityRef).catch(() => {});
  };

  const handleActivityClick = () => {
    const telemetryId = agent.runtime.telemetryId;
    if (telemetryId) {
      navigate(`/ai-agents?tab=activity&agent=${encodeURIComponent(telemetryId)}`);
      onClose();
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const descriptionText = agent.purpose || agent.description || 'No description provided.';
  const isDescriptionLong = descriptionText.split('\n').length > 3 || descriptionText.length > 150;

  const safeLinks = agent.links.filter(l => isSafeUrl(l.url));

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, overflowX: 'hidden' } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Compact header (always visible) */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <AgentAvatar name={agent.name} avatarUrl={avatarSrc} size={56} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6">{title}</Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
              }}
              onClick={copyRef}
            >
              {agent.entityRef}
              <ContentCopyIcon sx={{ fontSize: 12 }} />
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <AgentStatusBadge status={agent.status} />
              {agent.runtime && (
                <RuntimeBadge runtime={agent.runtime.runtime} />
              )}
              {agent.billing && (
                <BillingBadge billing={agent.billing} />
              )}
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Refresh button (always visible) */}
        {onRefreshStatus && (
          <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton
              size="small"
              title="Refresh status"
              onClick={() => onRefreshStatus(agent.entityRef)}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* Description with "Show more" toggle */}
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography
            variant="body2"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: descriptionExpanded ? 'unset' : 3,
              WebkitBoxOrient: 'vertical',
              overflow: descriptionExpanded ? 'visible' : 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {descriptionText}
          </Typography>
          {isDescriptionLong && (
            <Button
              size="small"
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              sx={{ mt: 0.5, textTransform: 'none' }}
            >
              {descriptionExpanded ? 'Show less' : 'Show more'}
            </Button>
          )}
        </Box>

        {/* Primary action row */}
        <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
          {onHire && agent.hireSchema && agent.hireSchema.length > 0 && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<WorkIcon />}
              onClick={() => onHire(agent)}
            >
              Hire Agent
            </Button>
          )}
          {agent.runtime.telemetryId && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<TimelineIcon />}
              onClick={handleActivityClick}
              data-testid="open-activity-button"
            >
              Open activity
            </Button>
          )}
        </Box>

        {/* Scrollable accordion sections */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1 }}>
          {/* Runtime & billing section */}
          <Accordion
            disableGutters
            elevation={0}
            square
            expanded={expandedSections.runtime ?? false}
            onChange={() => toggleSection('runtime')}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="runtime-content"
              id="runtime-header"
            >
              <Typography variant="subtitle2">Runtime & billing</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box>
                <Row label="Runtime">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <RuntimeBadge runtime={agent.runtime.runtime} />
                    {agent.runtime.endpoint && isSafeUrl(agent.runtime.endpoint) && (
                      <Link
                        href={agent.runtime.endpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      >
                        endpoint <OpenInNewIcon sx={{ fontSize: 12 }} />
                      </Link>
                    )}
                  </Stack>
                  {agent.runtime.runtimeHandle && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
                      {agent.runtime.runtimeHandle}
                    </Typography>
                  )}
                </Row>
                <Row label="Billing">
                  <BillingBadge billing={agent.billing} />
                </Row>
                <Row label="Owner">{agent.owner ?? '—'}</Row>
                <Row label="System">{agent.system ?? '—'}</Row>
                <Row label="Lifecycle">{agent.lifecycle ?? '—'}</Row>
                <Row label="Version">{agent.version ?? 'N/A'}</Row>
                <Row label="Catalog">
                  <SafeLink text={agent.entityRef} />
                </Row>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Capabilities section */}
          <Accordion
            disableGutters
            elevation={0}
            square
            expanded={expandedSections.capabilities ?? false}
            onChange={() => toggleSection('capabilities')}
            sx={{ border: '1px solid', borderColor: 'divider', mt: 0 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="capabilities-content"
              id="capabilities-header"
            >
              <Typography variant="subtitle2">Capabilities</Typography>
              {agent.capabilities.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  {agent.capabilities.length}
                </Typography>
              )}
            </AccordionSummary>
            <AccordionDetails>
              {agent.capabilities.length ? (
                <AgentCapabilities capabilities={agent.capabilities} max={20} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No capabilities defined.
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Links section */}
          {safeLinks.length > 0 && (
            <Accordion
              disableGutters
              elevation={0}
              square
              expanded={expandedSections.links ?? false}
              onChange={() => toggleSection('links')}
              sx={{ border: '1px solid', borderColor: 'divider', mt: 0 }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="links-content"
                id="links-header"
              >
                <Typography variant="subtitle2">Links</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  {safeLinks.length}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense disablePadding>
                  {safeLinks.map((l, i) => (
                    <ListItem
                      key={i}
                      component="a"
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'text.primary', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        {getLinkIcon(l.icon)}
                      </ListItemIcon>
                      <ListItemText
                        primary={l.title}
                        secondary={l.url}
                        secondaryTypographyProps={{ sx: { fontSize: '0.7rem' } as const, noWrap: true }}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Tags section */}
          {agent.tags.length > 0 && (
            <Accordion
              disableGutters
              elevation={0}
              square
              expanded={expandedSections.tags ?? false}
              onChange={() => toggleSection('tags')}
              sx={{ border: '1px solid', borderColor: 'divider', mt: 0 }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="tags-content"
                id="tags-header"
              >
                <Typography variant="subtitle2">Tags</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  {agent.tags.length}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {agent.tags.map(t => (
                    <Chip key={t} size="small" label={t} variant="outlined" />
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Spend section (lazy loaded) */}
          <Accordion
            disableGutters
            elevation={0}
            square
            expanded={expandedSections.spend ?? false}
            onChange={() => toggleSection('spend')}
            sx={{ border: '1px solid', borderColor: 'divider', mt: 0 }}
            TransitionProps={{ unmountOnExit: true }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="spend-content"
              id="spend-header"
            >
              <Typography variant="subtitle2">Spend</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <AgentSpend entityRef={agent.entityRef} />
            </AccordionDetails>
          </Accordion>

          {/* Recent invocations section (lazy loaded) */}
          <Accordion
            disableGutters
            elevation={0}
            square
            expanded={expandedSections.invocations ?? false}
            onChange={() => toggleSection('invocations')}
            sx={{ border: '1px solid', borderColor: 'divider', mt: 0 }}
            TransitionProps={{ unmountOnExit: true }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="invocations-content"
              id="invocations-header"
            >
              <Typography variant="subtitle2">Recent invocations</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <InvocationHistory
                entityRef={agent.entityRef}
                limit={8}
                reloadKey={historyReloadKey}
              />
            </AccordionDetails>
          </Accordion>

          {/* Reviews section (lazy loaded) */}
          <Accordion
            disableGutters
            elevation={0}
            square
            expanded={expandedSections.reviews ?? false}
            onChange={() => toggleSection('reviews')}
            sx={{ border: '1px solid', borderColor: 'divider', mt: 0 }}
            TransitionProps={{ unmountOnExit: true }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="reviews-content"
              id="reviews-header"
            >
              <Typography variant="subtitle2">Reviews</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <AgentReviews entityRef={agent.entityRef} />
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>
    </Drawer>
  );
};
