import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import IconButton from '@mui/material/IconButton';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { InvocationRecord } from '../types';

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

const SectionTitle: React.FC<{ entityRef?: string }> = () => (
  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
    Recent invocations
  </Typography>
);

/**
 * Recent agent invocations with status, user and latency. Renders nothing
 * when there is no history yet so cards stay clean on fresh agents.
 */
export const InvocationHistory: React.FC<{
  entityRef: string;
  limit?: number;
  /** Reload trigger — change to refetch. */
  reloadKey?: number;
  emptyText?: string;
}> = ({ entityRef, limit = 10, reloadKey = 0, emptyText }) => {
  const api = useApi(aiAgentsApiRef);
  const [records, setRecords] = useState<InvocationRecord[] | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setRecords(null);
    api
      .getInvocations(entityRef, limit)
      .then(r => alive && setRecords(r))
      .catch(() => alive && setRecords([]));
    return () => {
      alive = false;
    };
  }, [api, entityRef, limit, nonce, reloadKey]);

  if (records === null) {
    return (
      <Box>
        <SectionTitle />
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      </Box>
    );
  }
  if (!records.length) {
    return emptyText ? (
      <Box>
        <SectionTitle />
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      </Box>
    ) : null;
  }

  return (
    <Box data-testid="invocation-history">
      <SectionTitle />
      <Stack spacing={0.5}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton size="small" title="Refresh" onClick={() => setNonce(n => n + 1)}>
          <RefreshIcon fontSize="inherit" />
        </IconButton>
      </Box>
      {records.map(r => {
        const detail =
          r.status === 'error'
            ? r.errorMessage ?? 'failed'
            : r.responseText?.trim() || '(empty response)';
        return (
          <Tooltip key={r.id ?? r.sessionId} title={detail.slice(0, 400)} arrow placement="left">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {r.status === 'ok' ? (
                <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />
              ) : (
                <ErrorIcon color="error" sx={{ fontSize: 16 }} />
              )}
              <Typography variant="caption" noWrap sx={{ flexGrow: 1 }}>
                {r.prompt.replace(/\s+/g, ' ').slice(0, 60)}
              </Typography>
              {r.latencyMs !== undefined && r.latencyMs !== null && r.status === 'ok' && (
                <Chip
                  size="small"
                  label={`${(r.latencyMs / 1000).toFixed(1)}s`}
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              )}
              {r.userRef && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={r.userRef.split('/').pop()}
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              )}
              <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                {formatWhen(r.createdAt)}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
      </Stack>
    </Box>
  );
};
