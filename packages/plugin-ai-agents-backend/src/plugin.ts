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
        permissions: coreServices.permissions,
      },
      async init({ httpRouter, config, logger, auth, discovery, database, httpAuth, permissions }) {
        const router = await createRouter({
          config,
          logger,
          auth,
          discovery,
          database,
          httpAuth,
          permissions,
          invoker,
        });
        httpRouter.use(router);
      },
    });
  },
});

export default aiAgentsPlugin;
