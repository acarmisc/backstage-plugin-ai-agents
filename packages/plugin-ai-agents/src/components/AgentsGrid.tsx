import React from 'react';
import { Flex, Grid, Text } from '@backstage/ui';
import type { AiAgent } from '../types';
import type { GroupBy } from '../hooks/useAgents';
import type { AgentLive } from '../utils/live';
import { AgentCard } from './AgentCard';

export interface AgentsGridProps {
  agents: AiAgent[];
  /** Activity state and last seen by entity ref. */
  live?: Record<string, AgentLive>;
  groupBy?: GroupBy;
  onAgentClick?: (agent: AiAgent) => void;
  onRuntimeClick?: (runtime: string) => void;
  onHire?: (agent: AiAgent) => void;
}

const NO_SQUAD = 'No squad';

/** Agents sectioned by squad, alphabetical, agents without one last. */
export function groupBySquad(
  agents: AiAgent[],
): { name: string; agents: AiAgent[] }[] {
  const groups = new Map<string, AiAgent[]>();
  for (const a of agents) {
    const key = a.squad ?? NO_SQUAD;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === b) return 0;
      if (a === NO_SQUAD) return 1;
      if (b === NO_SQUAD) return -1;
      return a.localeCompare(b);
    })
    .map(([name, list]) => ({ name, agents: list }));
}

export function AgentsGrid({
  agents,
  live,
  groupBy = 'none',
  onAgentClick,
  onRuntimeClick,
  onHire,
}: AgentsGridProps) {
  const grid = (list: AiAgent[]) => (
    <Grid.Root
      gap="4"
      // As many columns as fit, regardless of the viewport (the page can sit
      // beside a sidebar of any width).
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
    >
      {list.map(a => (
        <AgentCard
          key={a.entityRef}
          agent={a}
          live={live?.[a.entityRef]}
          onClick={onAgentClick}
          onRuntimeClick={onRuntimeClick}
          onHire={onHire}
        />
      ))}
    </Grid.Root>
  );

  if (groupBy !== 'squad') return grid(agents);

  return (
    <Flex direction="column" gap="6">
      {groupBySquad(agents).map(group => (
        <section key={group.name} aria-label={group.name}>
          <Flex align="baseline" gap="2" mb="3">
            <Text as="h2" variant="title-x-small" weight="bold">
              {group.name}
            </Text>
            <Text variant="body-small" color="secondary">
              {group.agents.length}
            </Text>
          </Flex>
          {grid(group.agents)}
        </section>
      ))}
    </Flex>
  );
}
