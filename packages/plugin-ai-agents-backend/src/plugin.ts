import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { aiAgentsExtensionPoint, AiAgentsExtensionPoint } from './extensionPoint';
import { createRouter } from './router';
import { AgentInvoker } from './types';
import { aiAgentsPermissions } from './permissions';

export { aiAgentsExtensionPoint };
export type { AiAgentsExtensionPoint };

export const aiAgentsPlugin = createBackendPlugin({
  pluginId: 'ai-agents',
  register(reg) {
    const invokers = new Map<string, AgentInvoker>();

    reg.registerExtensionPoint(aiAgentsExtensionPoint, {
      registerInvoker(runtime: string, invoker: AgentInvoker) {
        invokers.set(runtime, invoker);
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
        permissionsRegistry: coreServices.permissionsRegistry,
        urlReader: coreServices.urlReader,
        cache: coreServices.cache,
      },
      async init({
        httpRouter,
        config,
        logger,
        auth,
        discovery,
        database,
        httpAuth,
        permissions,
        permissionsRegistry,
        urlReader,
        cache,
      }) {
        // Register the plugin's permissions so the RBAC backend can discover
        // them (they surface in the /rbac UI). Without this the ai-agent.*
        // permissions exist only in code and cannot be granted, so every
        // invocation is denied by the RBAC enforcer.
        permissionsRegistry.addPermissions(aiAgentsPermissions);
        const router = await createRouter({
          config,
          logger,
          auth,
          discovery,
          database,
          httpAuth,
          permissions,
          invokers,
          avatarProxy: { urlReader, cache },
        });
        httpRouter.use(router);
      },
    });
  },
});

export default aiAgentsPlugin;
