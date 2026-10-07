import React, { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  Link,
  Badge,
  Text,
} from '@backstage/ui';
import { RiBriefcaseLine } from '@remixicon/react';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import { isSafeUrl } from '../types';
import type { AiAgent } from '../types';
import { useAvatarSrc } from '../hooks/useAvatarBlob';
import { AgentAvatar } from './AgentAvatar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { BillingBadge } from './BillingBadge';
import { RuntimeBadge } from './RuntimeBadge';
import { HireAgentDialog } from './HireAgentDialog';
import { AgentReviews } from './AgentReviews';
import { getLinkIcon } from './linkIcon';

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Grid.Item>
      <Text variant="body-small" color="secondary" as="div">
        {label}
      </Text>
      <Text variant="body-medium" as="div" style={{ wordBreak: 'break-all' }}>
        {value ?? '—'}
      </Text>
    </Grid.Item>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Flex direction="column" gap="1">
      <Text variant="body-small" color="secondary">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

/**
 * Overview of one agent for the catalog entity page. Takes the agent as a
 * prop (no catalog dependency), so it can be unit-tested.
 */
export function AgentOverviewCardView({ agent }: { agent?: AiAgent }) {
  const api = useApi(aiAgentsApiRef);
  const [hireOpen, setHireOpen] = useState(false);
  const avatarSrc = useAvatarSrc(agent?.entityRef, agent?.avatarUrl);
  if (!agent) return null;
  const canHire = !!(agent.hireSchema && agent.hireSchema.length > 0);
  const safeLinks = agent.links.filter(l => isSafeUrl(l.url));

  return (
    <Card>
      <CardHeader>
        <Flex align="center" gap="3">
          <AgentAvatar name={agent.name} avatarUrl={avatarSrc} size={48} />
          <Flex direction="column" gap="0.5" style={{ flex: 1, minWidth: 0 }}>
            <Text as="h2" variant="body-large" weight="bold" truncate>
              {agent.title ?? agent.name}
            </Text>
            <Text variant="body-small" color="secondary" truncate>
              {agent.entityRef}
            </Text>
          </Flex>
          <AgentStatusBadge status={agent.status} />
        </Flex>
      </CardHeader>

      <CardBody>
        <Flex direction="column" gap="4">
          <Text variant="body-medium">
            {agent.purpose || agent.description || 'No description provided.'}
          </Text>

          <Grid.Root columns="2" gap="3">
            <Field
              label="Runtime"
              value={<RuntimeBadge runtime={agent.runtime.runtime} />}
            />
            <Field
              label="Billing"
              value={<BillingBadge billing={agent.billing} />}
            />
            <Field label="Owner" value={agent.owner} />
            <Field label="Lifecycle" value={agent.lifecycle} />
            <Field label="Version" value={agent.version ?? 'N/A'} />
            <Field label="System" value={agent.system} />
          </Grid.Root>

          {agent.runtime.endpoint && isSafeUrl(agent.runtime.endpoint) && (
            <Section label="Endpoint">
              <Text variant="body-medium" style={{ wordBreak: 'break-all' }}>
                <Link
                  href={agent.runtime.endpoint}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {agent.runtime.endpoint}
                </Link>
              </Text>
            </Section>
          )}

          {agent.runtime.runtimeHandle && (
            <Section label="Runtime handle">
              <Text
                variant="body-medium"
                style={{
                  fontFamily: 'var(--bui-font-monospace)',
                  wordBreak: 'break-all',
                }}
              >
                {agent.runtime.runtimeHandle}
              </Text>
            </Section>
          )}

          {agent.capabilities.length > 0 && (
            <Section label="Capabilities">
              <AgentCapabilities capabilities={agent.capabilities} max={20} />
            </Section>
          )}

          {agent.tags.length > 0 && (
            <Section label="Tags">
              <Flex gap="1" style={{ flexWrap: 'wrap' }}>
                {agent.tags.map(t => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </Flex>
            </Section>
          )}

          {safeLinks.length > 0 && (
            <Section label="Links">
              <Flex gap="4" style={{ flexWrap: 'wrap' }}>
                {safeLinks.map((l, i) => (
                  <Link
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
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
            </Section>
          )}

          <Flex align="center" gap="4">
            {canHire && (
              <Button
                variant="primary"
                iconStart={<RiBriefcaseLine size={16} />}
                onPress={() => setHireOpen(true)}
              >
                Hire Agent
              </Button>
            )}
            <Link href="/ai-agents">View on the AI Agents page</Link>
          </Flex>

          <AgentReviews entityRef={agent.entityRef} />
        </Flex>
      </CardBody>

      {canHire && (
        <HireAgentDialog
          agent={agent}
          open={hireOpen}
          onClose={() => setHireOpen(false)}
          onInvoke={(values, opts) =>
            api.invokeAgent(agent.entityRef, values, opts)
          }
        />
      )}
    </Card>
  );
}
