import React, { ReactNode } from 'react';
import { Flex, Text } from '@backstage/ui';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Usually a BUI `Button`. */
  action?: ReactNode;
}

/** Centered "nothing here" message with an optional call to action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Flex
      direction="column"
      align="center"
      gap="3"
      py="10"
      px="4"
      style={{ textAlign: 'center' }}
    >
      {icon && (
        <span aria-hidden="true" style={{ color: 'var(--bui-fg-secondary)' }}>
          {icon}
        </span>
      )}
      <Text as="h2" variant="body-large" weight="bold">
        {title}
      </Text>
      {description && (
        <Text variant="body-medium" color="secondary">
          {description}
        </Text>
      )}
      {action}
    </Flex>
  );
}
