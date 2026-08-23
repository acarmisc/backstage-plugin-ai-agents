import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { aiAgentsExtensionPoint, AiAgentsExtensionPoint } from './extensionPoint';
import { createRouter } from './router';
import { AgentInvoker } from './types';

export { aiAgentsExtensionPoint };
export type { AiAgentsExtensionPoint };

export const aiAgentsPlugin = createBackendPlugin({
  pluginId: 'ai-agents',
  register(reg) {
    let invoker: AgentInvoker | undefined;

    reg.registerExtensionPoint(aiAgentsExtensionPoint, {
      setInvoker(i: AgentInvoker) {
        invoker = i;
      },
    });

    reg.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
      },
      async init({ httpRouter, config, logger, auth, discovery, database, httpAuth }) {
        const router = await createRouter({
          config,
          logger,
          auth,
          discovery,
          database,
          httpAuth,
          invoker,
        });
        httpRouter.use(router);
      },
    });
  },
});

export default aiAgentsPlugin;
