import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { aiAgentsExtensionPoint } from '@acarmisc/backstage-plugin-ai-agents-backend';
import { KagentInvoker } from './invoker';

/**
 * kagent (https://kagent.dev) invocation transport for the ai-agents
 * backend plugin. Talks to the kagent controller's A2A endpoint, reading
 * its base URL from `ai-agents.invocations.kagent` and resolving the
 * per-agent namespace/name from the entity's `ai-agent.io/namespace` and
 * `/runtime-handle` annotations.
 */
export const aiAgentsModuleKagent = createBackendModule({
  pluginId: 'ai-agents',
  moduleId: 'kagent',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        invokers: aiAgentsExtensionPoint,
      },
      async init({ config, invokers }) {
        invokers.registerInvoker('kagent', new KagentInvoker(config));
      },
    });
  },
});
