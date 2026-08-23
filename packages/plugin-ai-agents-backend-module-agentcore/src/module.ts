import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { aiAgentsExtensionPoint } from '@acarmisc/backstage-plugin-ai-agents-backend';
import { AgentCoreInvoker } from './invoker';

/**
 * AWS Bedrock AgentCore invocation transport for the ai-agents backend
 * plugin. Reads its configuration from `ai-agents.invocations.agentCore`
 * and resolves per-agent details (region, runtime handle) from the entity's
 * `ai-agent.acarmisc.org/region` and `/runtime-handle` annotations.
 */
export const aiAgentsModuleAgentcore = createBackendModule({
  pluginId: 'ai-agents',
  moduleId: 'agentcore',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        invokers: aiAgentsExtensionPoint,
      },
      async init({ config, invokers }) {
        invokers.setInvoker(new AgentCoreInvoker(config));
      },
    });
  },
});
