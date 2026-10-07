import React, { useEffect, useState } from 'react';
import { Flex, Text } from '@backstage/ui';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import { Hint, TONE_FG } from '../ui';

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
export function AgentJobStats({ entityRef }: { entityRef: string }) {
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
  const summary = `${stats.ok} succeeded · ${stats.failed} failed`;
  return (
    <Flex align="center" gap="2">
      <Text
        variant="body-small"
        color="secondary"
        style={{ whiteSpace: 'nowrap' }}
      >
        {stats.total}
        {stats.total >= LIMIT ? '+' : ''} runs
      </Text>
      <Hint label={summary}>
        <span
          role="img"
          aria-label={summary}
          tabIndex={0}
          style={{
            flexGrow: 1,
            height: 4,
            overflow: 'hidden',
            display: 'flex',
            borderRadius: 'var(--bui-radius-full)',
            background: stats.failed > 0 ? TONE_FG.danger : TONE_FG.success,
          }}
        >
          {stats.failed > 0 && (
            <span style={{ width: `${okPct}%`, background: TONE_FG.success }} />
          )}
        </span>
      </Hint>
    </Flex>
  );
}
