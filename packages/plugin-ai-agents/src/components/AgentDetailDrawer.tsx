import React from 'react';
import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WorkIcon from '@mui/icons-material/Work';
import type { AiAgent } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { RuntimeBadge } from './RuntimeBadge';
import { BillingBadge } from './BillingBadge';
import { getLinkIcon } from './linkIcon';
import { InvocationHistory } from './InvocationHistory';
import { AgentReviews } from './AgentReviews';

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
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
      {label}
    </Typography>
    <Box sx={{ flexGrow: 1 }}>{children}</Box>
  </Box>
);

export const AgentDetailDrawer: React.FC<AgentDetailDrawerProps> = ({
  agent,
  open,
  onClose,
  onRefreshStatus,
  onHire,
  historyReloadKey = 0,
}) => {
  if (!agent) return null;
  const title = agent.title ?? agent.name;

  const copyRef = () => {
    navigator.clipboard?.writeText(agent.entityRef).catch(() => {});
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <AgentAvatar name={agent.name} avatarUrl={agent.avatarUrl} size={56} />
        <Box sx={{ flexGrow: 1 }}>
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
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, pb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AgentStatusBadge status={agent.status} />
        {onRefreshStatus && (
          <IconButton
            size="small"
            title="Refresh status"
            onClick={() => onRefreshStatus(agent.entityRef)}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Box sx={{ px: 2, pb: 3 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {agent.purpose || agent.description || 'No description provided.'}
        </Typography>

        <Row label="Runtime">
          <Stack direction="row" spacing={1} alignItems="center">
            <RuntimeBadge runtime={agent.runtime.runtime} />
            {agent.runtime.endpoint && (
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

        <Row label="Capabilities">
          {agent.capabilities.length ? (
            <AgentCapabilities capabilities={agent.capabilities} max={20} />
          ) : (
            <Typography variant="body2" color="text.secondary">—</Typography>
          )}
        </Row>

        <Row label="Billing">
          <BillingBadge billing={agent.billing} />
        </Row>

        <Row label="Owner">{agent.owner ?? '—'}</Row>
        <Row label="System">{agent.system ?? '—'}</Row>
        <Row label="Lifecycle">{agent.lifecycle ?? '—'}</Row>
        <Row label="Version">{agent.version ?? 'N/A'}</Row>
        <Row label="Tags">
          {agent.tags.length ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {agent.tags.map(t => (
                <Chip key={t} size="small" label={t} variant="outlined" />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">—</Typography>
          )}
        </Row>

        {agent.links.length > 0 && (
          <Row label="Links">
            <List dense disablePadding>
              {agent.links.map((l, i) => (
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
                  <ListItemText primary={l.title} secondary={l.url}
                    secondaryTypographyProps={{ sx: { fontSize: '0.7rem' } as const, noWrap: true }} />
                </ListItem>
              ))}
            </List>
          </Row>
        )}

        <Row label="Catalog">
          {(() => {
            const [kind, rest] = agent.entityRef.split(':');
            const [ns, name] = (rest ?? 'default/').split('/');
            return (
              <Link href={`/catalog/${ns ?? 'default'}/${kind}/${name}`}>
                Open in catalog{' '}
                <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
              </Link>
            );
          })()}
        </Row>

        <InvocationHistory entityRef={agent.entityRef} limit={8} reloadKey={historyReloadKey} />

        <AgentReviews entityRef={agent.entityRef} />

        {onHire && agent.hireSchema && agent.hireSchema.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<WorkIcon />}
              onClick={() => onHire(agent)}
            >
              Hire Agent
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};