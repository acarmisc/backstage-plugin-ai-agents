import { createDevApp } from '@backstage/frontend-dev-utils';
import {
  ApiBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { aiAgentsApiRef, aiAgentsPlugin } from '../src';
import { stubAiAgentsApi, stubCatalogApi } from './stubs';

// The real New Frontend System shell (header, sidebar, theme) around the
// plugin as a host app would load it. There is no catalog or backend here,
// so the two APIs the plugin talks to are replaced with in-memory stubs.
const catalogStub = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    ApiBlueprint.make({
      params: defineParams =>
        defineParams({
          api: catalogApiRef,
          deps: {},
          factory: () => stubCatalogApi,
        }),
    }),
  ],
});

const aiAgentsStub = createFrontendModule({
  pluginId: 'ai-agents',
  extensions: [
    ApiBlueprint.make({
      params: defineParams =>
        defineParams({
          api: aiAgentsApiRef,
          deps: {},
          factory: () => stubAiAgentsApi,
        }),
    }),
  ],
});

createDevApp({ features: [aiAgentsPlugin, catalogStub, aiAgentsStub] });
