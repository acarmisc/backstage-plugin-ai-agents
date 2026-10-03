import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { aiAgentsExtensionPoint } from '@acarmisc/backstage-plugin-ai-agents-backend';
import { LangfuseTelemetryProvider, readLangfuseConfig } from './provider';

/**
 * Registers Langfuse as the telemetry source for agent run timelines.
 * Configured under `ai-agents.telemetry.langfuse`; a no-op when absent.
 */
export const aiAgentsModuleLangfuse = createBackendModule({
  pluginId: 'ai-agents',
  moduleId: 'langfuse',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        telemetry: aiAgentsExtensionPoint,
      },
      async init({ config, logger, telemetry }) {
        const cfg = readLangfuseConfig(config);
        if (!cfg) {
          logger.info('ai-agents.telemetry.langfuse not configured; Langfuse telemetry disabled');
          return;
        }
        telemetry.registerTelemetryProvider(new LangfuseTelemetryProvider(cfg));
      },
    });
  },
});
