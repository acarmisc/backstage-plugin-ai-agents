import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { AgentInvoker } from './types';

export interface AiAgentsExtensionPoint {
  /**
   * Register the invocation transport used by `POST /invocations/:ref`.
   * Provided by a provider module (e.g. `-backend-module-agentcore`).
   * When no module registers an invoker, the endpoint responds 501.
   */
  setInvoker(invoker: AgentInvoker): void;
}

export const aiAgentsExtensionPoint = createExtensionPoint<AiAgentsExtensionPoint>({
  id: 'ai-agents.invoker',
});
