import React, { useEffect, useState } from 'react';
import { Badge, Flex, Text } from '@backstage/ui';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { SpendSummary } from '../api';

function formatUsd(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/**
 * LiteLLM spend attributed to this agent (all threads) or a single
 * conversation thread. Renders nothing when LiteLLM is not configured, so
 * static setups stay clean.
 */
export function AgentSpend({
  entityRef,
  threadId,
  days = 30,
}: {
  entityRef: string;
  /** When set, the spend is scoped to this conversation thread. */
  threadId?: string;
  days?: number;
}) {
  const api = useApi(aiAgentsApiRef);
  const [summary, setSummary] = useState<SpendSummary | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getSpend(entityRef, { threadId, days })
      .then(s => alive && setSummary(s))
      .catch(() => alive && setSummary(null));
    return () => {
      alive = false;
    };
  }, [api, entityRef, threadId, days]);

  if (!summary || summary.requests === 0) return null;

  const models = Object.entries(summary.byModel)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <Flex direction="column" gap="2" data-testid="agent-spend">
      <Text variant="body-medium" weight="bold">
        {threadId ? 'Conversation cost' : `Cost (last ${days}d)`}
      </Text>
      <Flex align="center" gap="2">
        <Text variant="body-large" weight="bold">
          {formatUsd(summary.spend)}
        </Text>
        <Badge size="small">{`${summary.requests} calls`}</Badge>
        <Badge size="small">{`${formatTokens(summary.totalTokens)} tok`}</Badge>
      </Flex>
      {models.length > 0 && (
        <Flex direction="column" gap="0.5">
          {models.map(([model, spend]) => (
            <Flex key={model} align="center" justify="between" gap="2">
              <Text variant="body-small" color="secondary" truncate>
                {model}
              </Text>
              <Text variant="body-small" color="secondary">
                {formatUsd(spend)}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
