import React from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Flex,
  Link,
  Text,
} from '@backstage/ui';
import { RiBriefcaseLine } from '@remixicon/react';
import type { AiAgent } from '../types';
import { isSafeUrl } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { useAvatarSrc } from '../hooks/useAvatarBlob';
import { AgentLiveStatus } from './AgentLiveStatus';
import type { AgentLive } from '../utils/live';
import { AgentCapabilities } from './AgentCapabilities';
import { RuntimeBadge } from './RuntimeBadge';
import { BillingBadge } from './BillingBadge';
import { AgentJobStats } from './AgentJobStats';
import { getLinkIcon } from './linkIcon';

/** @public */
export interface AgentCardProps {
  agent: AiAgent;
  /** Activity state and last seen, when the agent has telemetry. */
  live?: AgentLive;
  onClick?: (agent: AiAgent) => void;
  onRuntimeClick?: (runtime: string) => void;
  onHire?: (agent: AiAgent) => void;
}

const PURPOSE_CLAMP = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  minHeight: '2.6em',
} as const;

/** @public */
export function AgentCard({
  agent,
  live,
  onClick,
  onRuntimeClick,
  onHire,
}: AgentCardProps) {
  const title = agent.title ?? agent.name;
  const avatarSrc = useAvatarSrc(agent.entityRef, agent.avatarUrl);
  const owner = agent.owner?.replace(/^group:/, '');
  const meta = [
    owner,
    agent.lifecycle,
    agent.version ? `v${agent.version}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  const links = agent.links.filter(l => isSafeUrl(l.url)).slice(0, 4);
  const canHire = Boolean(
    onHire && agent.hireSchema && agent.hireSchema.length > 0,
  );

  // Interactive only when someone listens: BUI's Card then overlays an
  // accessible trigger and leaves the buttons and links inside it alone.
  const interaction = onClick
    ? { onPress: () => onClick(agent), label: `Open ${title}` }
    : {};

  return (
    <Card style={{ height: '100%' }} {...interaction}>
      <CardHeader>
        <Flex align="center" gap="3">
          <AgentAvatar name={agent.name} avatarUrl={avatarSrc} size={48} />
          <Flex direction="column" gap="0.5" style={{ flex: 1, minWidth: 0 }}>
            <Text as="h3" variant="body-large" weight="bold">
              {title}
            </Text>
            {meta && (
              <Text variant="body-small" color="secondary" truncate>
                {meta}
              </Text>
            )}
          </Flex>
          <RuntimeBadge
            runtime={agent.runtime.runtime}
            onClick={onRuntimeClick}
            variant="icon"
          />
          <AgentLiveStatus live={live} status={agent.status} />
        </Flex>
      </CardHeader>

      <CardBody>
        <Flex direction="column" gap="3">
          <Text variant="body-medium" color="secondary" style={PURPOSE_CLAMP}>
            {agent.purpose || 'No description provided.'}
          </Text>
          <BillingBadge billing={agent.billing} compact variant="text" />
          <AgentJobStats entityRef={agent.entityRef} />
          {agent.capabilities.length > 0 && (
            <AgentCapabilities capabilities={agent.capabilities} />
          )}
        </Flex>
      </CardBody>

      {(links.length > 0 || canHire) && (
        <CardFooter>
          <Flex direction="column" gap="2">
            {links.length > 0 && (
              <Flex gap="3" style={{ flexWrap: 'wrap' }}>
                {links.map((l, i) => (
                  <Link
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body-small"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--bui-space-1)',
                    }}
                  >
                    {getLinkIcon(l.icon)}
                    {l.title}
                  </Link>
                ))}
              </Flex>
            )}
            {canHire && (
              <Button
                variant="primary"
                size="small"
                iconStart={<RiBriefcaseLine size={18} />}
                onPress={() => onHire?.(agent)}
              >
                Hire Agent
              </Button>
            )}
          </Flex>
        </CardFooter>
      )}
    </Card>
  );
}
