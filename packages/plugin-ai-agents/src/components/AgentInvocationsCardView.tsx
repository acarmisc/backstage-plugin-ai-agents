import React from 'react';
import { Card, CardBody, CardHeader, Flex, Text } from '@backstage/ui';
import { RiHistoryLine } from '@remixicon/react';
import { InvocationHistory } from './InvocationHistory';

/**
 * Recent invocations of one agent, as an entity-page card. Takes the entity
 * ref as a prop (no catalog dependency), so it can be unit-tested.
 */
export function AgentInvocationsCardView({ entityRef }: { entityRef: string }) {
  return (
    <Card>
      <CardHeader>
        <Flex align="center" gap="2">
          <RiHistoryLine size={20} aria-hidden="true" />
          <Text as="h2" variant="body-large" weight="bold">
            Recent invocations
          </Text>
        </Flex>
      </CardHeader>
      <CardBody>
        <InvocationHistory
          entityRef={entityRef}
          limit={10}
          hideTitle
          emptyText="No invocations recorded yet. Use the Hire Agent action to run this agent."
        />
      </CardBody>
    </Card>
  );
}
