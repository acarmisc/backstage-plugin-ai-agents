import { createPermission } from '@backstage/plugin-permission-common';

/** Permission for invoking an AI agent */
export const aiAgentInvokePermission = createPermission({
  name: 'ai-agent.invoke',
  attributes: { action: 'update' },
});

/** Permission for reading an agent's invocation history */
export const aiAgentHistoryReadPermission = createPermission({
  name: 'ai-agent.history.read',
  attributes: { action: 'read' },
});

export const aiAgentsPermissions = [aiAgentInvokePermission, aiAgentHistoryReadPermission];
