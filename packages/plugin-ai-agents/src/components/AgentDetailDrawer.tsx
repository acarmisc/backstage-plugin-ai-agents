import React, { useState } from 'react';
import {
  Accordion,
  AccordionGroup,
  AccordionPanel,
  AccordionTrigger,
  Badge,
  Button,
  ButtonIcon,
  DialogBody,
  DialogHeader,
  Flex,
  Link,
  Text,
} from '@backstage/ui';
import type { Key } from '@backstage/ui';
import {
  RiBriefcaseLine,
  RiFileCopyLine,
  RiPulseLine,
  RiRefreshLine,
} from '@remixicon/react';
import { useNavigate } from 'react-router-dom';
import type { AiAgent } from '../types';
import { isSafeUrl } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { RuntimeBadge } from './RuntimeBadge';
import { BillingBadge } from './BillingBadge';
import { getLinkIcon } from './linkIcon';
import { SidePanel } from '../ui';
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
  /**
   * Where "Open activity" goes for an agent's telemetry id. Defaults to the
   * Activity sub-page of the `/ai-agents` page.
   */
  activityHref?: (telemetryId: string) => string;
}

const defaultActivityHref = (telemetryId: string) =>
  `/ai-agents/activity?agent=${encodeURIComponent(telemetryId)}`;

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Flex gap="3" align="start" style={{ padding: 'var(--bui-space-1) 0' }}>
      <Text
        variant="body-small"
        color="secondary"
        style={{ minWidth: 100, flexShrink: 0 }}
      >
        {label}
      </Text>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body-medium" as="div">
          {children}
        </Text>
      </div>
    </Flex>
  );
}

function SafeLink({ text }: { text: string }) {
  const [kind, rest] = text.split(':');
  const [ns, name] = (rest ?? 'default/').split('/');
  return (
    <Link href={`/catalog/${ns ?? 'default'}/${kind}/${name}`}>
      Open in catalog
    </Link>
  );
}

const DESCRIPTION_CLAMP = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
} as const;

export function AgentDetailDrawer({
  agent,
  open,
  onClose,
  onRefreshStatus,
  onHire,
  historyReloadKey = 0,
  activityHref = defaultActivityHref,
}: AgentDetailDrawerProps) {
  const navigate = useNavigate();
  const avatarSrc = useAvatarSrc(agent?.entityRef, agent?.avatarUrl);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [expanded, setExpanded] = useState<Set<Key>>(new Set());

  if (!agent) return null;
  const title = agent.title ?? agent.name;

  const copyRef = () => {
    navigator.clipboard?.writeText(agent.entityRef).catch(() => {});
  };

  const handleActivityClick = () => {
    const telemetryId = agent.runtime.telemetryId;
    if (telemetryId) {
      navigate(activityHref(telemetryId));
      onClose();
    }
  };

  const descriptionText =
    agent.purpose || agent.description || 'No description provided.';
  const isDescriptionLong =
    descriptionText.split('\n').length > 3 || descriptionText.length > 150;

  const safeLinks = agent.links.filter(l => isSafeUrl(l.url));
  const canHire = Boolean(
    onHire && agent.hireSchema && agent.hireSchema.length > 0,
  );

  return (
    <SidePanel
      isOpen={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose();
      }}
      width={560}
    >
      <DialogHeader>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden="true">
            <AgentAvatar name={agent.name} avatarUrl={avatarSrc} size={40} />
          </span>
          {title}
        </span>
      </DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="2" align="start">
            <Button
              variant="tertiary"
              size="small"
              iconEnd={<RiFileCopyLine size={14} />}
              aria-label={`Copy ${agent.entityRef}`}
              onPress={copyRef}
            >
              {agent.entityRef}
            </Button>
            <Flex align="center" gap="3" style={{ flexWrap: 'wrap' }}>
              <AgentStatusBadge status={agent.status} />
              {agent.runtime && (
                <RuntimeBadge runtime={agent.runtime.runtime} />
              )}
              {agent.billing && <BillingBadge billing={agent.billing} />}
              {onRefreshStatus && (
                <ButtonIcon
                  aria-label="Refresh status"
                  variant="tertiary"
                  size="small"
                  icon={<RiRefreshLine size={16} />}
                  onPress={() => onRefreshStatus(agent.entityRef)}
                />
              )}
            </Flex>
          </Flex>

          <Flex direction="column" gap="1" align="start">
            <Text
              variant="body-medium"
              style={{
                whiteSpace: 'pre-wrap',
                ...(descriptionExpanded ? {} : DESCRIPTION_CLAMP),
              }}
            >
              {descriptionText}
            </Text>
            {isDescriptionLong && (
              <Button
                variant="tertiary"
                size="small"
                onPress={() => setDescriptionExpanded(!descriptionExpanded)}
              >
                {descriptionExpanded ? 'Show less' : 'Show more'}
              </Button>
            )}
          </Flex>

          {(canHire || agent.runtime.telemetryId) && (
            <Flex gap="2">
              {canHire && (
                <Button
                  variant="primary"
                  size="small"
                  iconStart={<RiBriefcaseLine size={16} />}
                  onPress={() => onHire?.(agent)}
                >
                  Hire Agent
                </Button>
              )}
              {agent.runtime.telemetryId && (
                <Button
                  variant="secondary"
                  size="small"
                  iconStart={<RiPulseLine size={16} />}
                  onPress={handleActivityClick}
                  data-testid="open-activity-button"
                >
                  Open activity
                </Button>
              )}
            </Flex>
          )}

          <AccordionGroup
            allowsMultiple
            expandedKeys={expanded}
            onExpandedChange={setExpanded}
          >
            <Accordion id="runtime">
              <AccordionTrigger title="Runtime & billing" />
              <AccordionPanel>
                <Row label="Runtime">
                  <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
                    <RuntimeBadge runtime={agent.runtime.runtime} />
                    {agent.runtime.endpoint &&
                      isSafeUrl(agent.runtime.endpoint) && (
                        <Link
                          href={agent.runtime.endpoint}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          endpoint
                        </Link>
                      )}
                  </Flex>
                  {agent.runtime.runtimeHandle && (
                    <Text
                      variant="body-small"
                      color="secondary"
                      as="div"
                      style={{ wordBreak: 'break-all' }}
                    >
                      {agent.runtime.runtimeHandle}
                    </Text>
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
              </AccordionPanel>
            </Accordion>

            <Accordion id="capabilities">
              <AccordionTrigger
                title="Capabilities"
                subtitle={
                  agent.capabilities.length
                    ? `(${agent.capabilities.length})`
                    : undefined
                }
              />
              <AccordionPanel>
                {agent.capabilities.length ? (
                  <AgentCapabilities
                    capabilities={agent.capabilities}
                    max={20}
                  />
                ) : (
                  <Text variant="body-medium" color="secondary">
                    No capabilities defined.
                  </Text>
                )}
              </AccordionPanel>
            </Accordion>

            {safeLinks.length > 0 && (
              <Accordion id="links">
                <AccordionTrigger
                  title="Links"
                  subtitle={`(${safeLinks.length})`}
                />
                <AccordionPanel>
                  <Flex direction="column" gap="2">
                    {safeLinks.map((l, i) => (
                      <Link
                        key={i}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--bui-space-2)',
                        }}
                      >
                        {getLinkIcon(l.icon)}
                        <span style={{ minWidth: 0 }}>
                          <Text variant="body-medium" as="div">
                            {l.title}
                          </Text>
                          <Text
                            variant="body-small"
                            color="secondary"
                            as="div"
                            truncate
                          >
                            {l.url}
                          </Text>
                        </span>
                      </Link>
                    ))}
                  </Flex>
                </AccordionPanel>
              </Accordion>
            )}

            {agent.tags.length > 0 && (
              <Accordion id="tags">
                <AccordionTrigger
                  title="Tags"
                  subtitle={`(${agent.tags.length})`}
                />
                <AccordionPanel>
                  <Flex gap="1" style={{ flexWrap: 'wrap' }}>
                    {agent.tags.map(t => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </Flex>
                </AccordionPanel>
              </Accordion>
            )}

            {/* Lazy sections: they fetch on mount, so mount them only once
                the section is open. */}
            <Accordion id="spend">
              <AccordionTrigger title="Spend" />
              <AccordionPanel>
                {expanded.has('spend') && (
                  <AgentSpend entityRef={agent.entityRef} />
                )}
              </AccordionPanel>
            </Accordion>

            <Accordion id="invocations">
              <AccordionTrigger title="Recent invocations" />
              <AccordionPanel>
                {expanded.has('invocations') && (
                  <InvocationHistory
                    entityRef={agent.entityRef}
                    limit={8}
                    reloadKey={historyReloadKey}
                    hideTitle
                  />
                )}
              </AccordionPanel>
            </Accordion>

            <Accordion id="reviews">
              <AccordionTrigger title="Reviews" />
              <AccordionPanel>
                {expanded.has('reviews') && (
                  <AgentReviews entityRef={agent.entityRef} />
                )}
              </AccordionPanel>
            </Accordion>
          </AccordionGroup>
        </Flex>
      </DialogBody>
    </SidePanel>
  );
}
