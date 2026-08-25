import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { AgentInvoker } from './types';

export interface AiAgentsExtensionPoint {
  /**
   * Register the invocation transport for a given runtime, matched against
   * the entity's `ai-agent.io/runtime` annotation (e.g. `bedrock-agentcore`,
   * `kagent`). Provided by a provider module (e.g. `-backend-module-agentcore`,
   * `-backend-module-kagent`). Multiple modules can be installed side by
   * side; `POST /invocations/:ref` picks the invoker whose runtime key
   * matches the entity, falling back to the single registered invoker when
   * only one module is installed and the entity has no `runtime` annotation.
   * When no invoker matches, the endpoint responds 501.
   */
  registerInvoker(runtime: string, invoker: AgentInvoker): void;
}

export const aiAgentsExtensionPoint = createExtensionPoint<AiAgentsExtensionPoint>({
  id: 'ai-agents.invoker',
});
