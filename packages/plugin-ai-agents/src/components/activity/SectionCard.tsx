import React from 'react';
import { Card, CardBody, CardHeader, Flex, Text } from '@backstage/ui';

export interface SectionCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Remove the body padding (tables that go edge to edge). */
  flush?: boolean;
  children: React.ReactNode;
  'data-testid'?: string;
}

/** Shared surface for every block of the workspace: a BUI card with a header. */
export function SectionCard({
  title,
  subtitle,
  action,
  flush,
  children,
  ...rest
}: SectionCardProps) {
  return (
    <Card data-testid={rest['data-testid']} style={{ minWidth: 0 }}>
      <CardHeader>
        <Flex align="center" justify="between" gap="3">
          <div style={{ minWidth: 0 }}>
            <Text as="h3" variant="body-large" weight="bold">
              {title}
            </Text>
            {subtitle && (
              <Text variant="body-small" color="secondary" as="div">
                {subtitle}
              </Text>
            )}
          </div>
          {action}
        </Flex>
      </CardHeader>
      <CardBody style={flush ? { padding: 0 } : undefined}>{children}</CardBody>
    </Card>
  );
}
