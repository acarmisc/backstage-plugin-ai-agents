import React, { useEffect, useState } from 'react';
import { Badge, ButtonIcon, Flex, Skeleton, Text } from '@backstage/ui';
import {
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiRefreshLine,
} from '@remixicon/react';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { InvocationRecord } from '../types';
import { TONE_BG, TONE_FG } from '../ui';

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

function SectionTitle() {
  return (
    <Text as="h3" variant="body-medium" weight="bold">
      Recent invocations
    </Text>
  );
}

function InvocationRow({ record: r }: { record: InvocationRecord }) {
  const failed = r.status === 'error';
  const detail = failed
    ? (r.errorMessage ?? 'failed')
    : r.responseText?.trim() || '(empty response)';
  return (
    <li
      title={detail.slice(0, 400)}
      style={{
        listStyle: 'none',
        padding: 'var(--bui-space-1) var(--bui-space-2)',
        borderRadius: 'var(--bui-radius-2)',
        minWidth: 0,
      }}
    >
      <Flex align="center" gap="2" style={{ minWidth: 0 }}>
        {failed ? (
          <RiErrorWarningFill
            size={16}
            role="img"
            aria-label="Failed"
            style={{ color: TONE_FG.danger, flexShrink: 0 }}
          />
        ) : (
          <RiCheckboxCircleFill
            size={16}
            role="img"
            aria-label="Succeeded"
            style={{ color: TONE_FG.success, flexShrink: 0 }}
          />
        )}
        <Text variant="body-small" truncate style={{ flex: 1, minWidth: 0 }}>
          {r.prompt.replace(/\s+/g, ' ').slice(0, 60)}
        </Text>
        {r.post ? (
          <Badge
            size="small"
            style={{ background: TONE_BG.warning, color: TONE_FG.warning }}
          >
            published
          </Badge>
        ) : (
          <Badge size="small">dry-run</Badge>
        )}
        {r.latencyMs !== undefined && r.latencyMs !== null && !failed && (
          <Badge size="small">{`${(r.latencyMs / 1000).toFixed(1)}s`}</Badge>
        )}
        {r.userRef && <Badge size="small">{r.userRef.split('/').pop()}</Badge>}
        <Text
          variant="body-small"
          color="secondary"
          style={{ whiteSpace: 'nowrap' }}
        >
          {formatWhen(r.createdAt)}
        </Text>
      </Flex>
      {failed && (
        <Text variant="body-small" color="danger" truncate>
          {detail}
        </Text>
      )}
    </li>
  );
}

/**
 * Recent agent invocations with status, user and latency. Renders nothing
 * when there is no history yet so cards stay clean on fresh agents.
 */
export function InvocationHistory({
  entityRef,
  limit = 10,
  reloadKey = 0,
  emptyText,
  hideTitle = false,
}: {
  entityRef: string;
  limit?: number;
  /** Reload trigger — change to refetch. */
  reloadKey?: number;
  emptyText?: string;
  /** Skip the "Recent invocations" heading when the host shows one. */
  hideTitle?: boolean;
}) {
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
      <Flex direction="column" gap="2" aria-busy="true">
        {!hideTitle && <SectionTitle />}
        <Skeleton height={24} />
        <Skeleton height={24} />
        <Skeleton height={24} />
      </Flex>
    );
  }
  if (!records.length) {
    return emptyText ? (
      <Flex direction="column" gap="2">
        {!hideTitle && <SectionTitle />}
        <Text variant="body-medium" color="secondary">
          {emptyText}
        </Text>
      </Flex>
    ) : null;
  }

  return (
    <Flex direction="column" gap="2" data-testid="invocation-history">
      <Flex align="center" justify={hideTitle ? 'end' : 'between'}>
        {!hideTitle && <SectionTitle />}
        <ButtonIcon
          aria-label="Refresh invocations"
          variant="tertiary"
          size="small"
          icon={<RiRefreshLine size={16} />}
          onPress={() => setNonce(n => n + 1)}
        />
      </Flex>
      <ul style={{ margin: 0, padding: 0 }}>
        {records.map(r => (
          <InvocationRow key={r.id ?? r.sessionId} record={r} />
        ))}
      </ul>
    </Flex>
  );
}
