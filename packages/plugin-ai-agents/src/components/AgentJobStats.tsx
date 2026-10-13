import React, { useEffect, useState } from 'react';
import { Flex, Text } from '@backstage/ui';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import { Hint, TONE_FG } from '../ui';

const LIMIT = 100;
const WINDOW_HOURS = 24;

interface JobStats {
  total: number;
  ok: number;
  failed: number;
  /** Where the numbers come from, shown so the card says what it counts. */
  source: 'telemetry' | 'backstage';
}

/**
 * Smallest possible jobs summary for a card: run count plus a tiny
 * succeeded/failed balance bar. Prefers the telemetry insights (every run,
 * same numbers as the Activity tab); without telemetry it falls back to the
 * runs launched from Backstage. Renders nothing when neither has runs.
 */
export function AgentJobStats({ entityRef }: { entityRef: string }) {
  const api = useApi(aiAgentsApiRef);
  const [stats, setStats] = useState<JobStats | null>(null);

  useEffect(() => {
    let alive = true;
    (async (): Promise<JobStats> => {
      let insights = null;
      try {
        insights = await api.getInsights(entityRef, WINDOW_HOURS);
      } catch {
        // Telemetry down: fall back to the Backstage history below.
      }
      if (insights) {
        const { runs, completed, failed } = insights.totals;
        return { total: runs, ok: completed, failed, source: 'telemetry' };
      }
      const records = await api.getInvocations(entityRef, LIMIT);
      const ok = records.filter(r => r.status === 'ok').length;
      return {
        total: records.length,
        ok,
        failed: records.length - ok,
        source: 'backstage',
      };
    })()
      .then(result => alive && setStats(result))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [api, entityRef]);

  if (!stats || !stats.total) return null;

  // Telemetry runs still in flight count in the total but in neither side.
  const done = stats.ok + stats.failed;
  const okPct = done ? (stats.ok / done) * 100 : 100;
  const summary =
    stats.source === 'telemetry'
      ? `Last ${WINDOW_HOURS}h: ${stats.ok} completed · ${stats.failed} failed`
      : `Launched from Backstage: ${stats.ok} succeeded · ${stats.failed} failed`;
  return (
    <Flex align="center" gap="2">
      <Text
        variant="body-small"
        color="secondary"
        style={{ whiteSpace: 'nowrap' }}
      >
        {stats.source === 'telemetry'
          ? `${stats.total} runs · ${WINDOW_HOURS}h`
          : `${stats.total}${stats.total >= LIMIT ? '+' : ''} runs from Backstage`}
      </Text>
      <Hint label={summary}>
        <span
          role="img"
          aria-label={summary}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a tooltip trigger must be keyboard focusable
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
