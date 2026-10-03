import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Permission for invoking an AI agent
 *
 * @public
 */
export const aiAgentInvokePermission = createPermission({
  name: 'ai-agent.invoke',
  attributes: { action: 'update' },
});

/**
 * Permission for reading an agent's invocation history
 *
 * @public
 */
export const aiAgentHistoryReadPermission = createPermission({
  name: 'ai-agent.history.read',
  attributes: { action: 'read' },
});

/** @public */
export const aiAgentsPermissions = [
  aiAgentInvokePermission,
  aiAgentHistoryReadPermission,
];
