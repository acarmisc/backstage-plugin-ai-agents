import React, { useState } from 'react';
import { useAvatarSrc } from '../hooks/useAvatarBlob';
import { EmptyState } from '../ui';
import type { AiAgent } from '../types';
import { AgentWorkspacePanel } from './activity/AgentWorkspacePanel';

/** Presentation of the catalog "Activity" tab for one agent (no catalog dependency, so it is unit-testable). */
export function AgentActivityTabView({ agent }: { agent?: AiAgent }) {
  const avatarSrc = useAvatarSrc(agent?.entityRef, agent?.avatarUrl);
  const [hours, setHours] = useState(24);

  if (!agent) return null;

  const telemetryId = agent.runtime.telemetryId;
  if (!telemetryId) {
    return (
      <div data-testid="activity-tab-hint">
        <EmptyState
          title="Activity is not enabled for this agent"
          description={
            <>
              Add the <code>ai-agent.io/telemetry-id</code> annotation (the
              agent&apos;s name in your telemetry store) to see its runs, tool
              calls and statistics here.
            </>
          }
        />
      </div>
    );
  }

  return (
    <AgentWorkspacePanel
      entityRef={agent.entityRef}
      telemetryId={telemetryId}
      title={agent.title ?? agent.name}
      avatarUrl={avatarSrc}
      hours={hours}
      onHoursChange={setHours}
    />
  );
}
