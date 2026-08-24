import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';

const LIMIT = 100;

interface JobStats {
  total: number;
  ok: number;
  failed: number;
}

/**
 * Smallest possible jobs summary for a card: total run count plus a tiny
 * succeeded/failed balance bar. Renders nothing when the backend has no
 * invocation history (or is disabled), so static setups stay clean.
 */
export const AgentJobStats: React.FC<{ entityRef: string }> = ({ entityRef }) => {
  const api = useApi(aiAgentsApiRef);
  const [stats, setStats] = useState<JobStats | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getInvocations(entityRef, LIMIT)
      .then(records => {
        if (!alive) return;
        const ok = records.filter(r => r.status === 'ok').length;
        setStats({ total: records.length, ok, failed: records.length - ok });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [api, entityRef]);

  if (!stats || !stats.total) return null;

  const okPct = (stats.ok / stats.total) * 100;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        whiteSpace="nowrap"
        title={`${stats.ok} succeeded · ${stats.failed} failed`}
      >
        {stats.total}
        {stats.total >= LIMIT ? '+' : ''} runs
      </Typography>
      <Tooltip title={`${stats.ok} succeeded · ${stats.failed} failed`} arrow>
        <Box
          sx={{
            flexGrow: 1,
            height: 4,
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            bgcolor: 'success.main',
          }}
        >
          {stats.failed > 0 && <Box sx={{ width: `${okPct}%`, bgcolor: 'success.main' }} />}
          {stats.failed > 0 && <Box sx={{ flexGrow: 1, bgcolor: 'error.main' }} />}
        </Box>
      </Tooltip>
    </Box>
  );
};
