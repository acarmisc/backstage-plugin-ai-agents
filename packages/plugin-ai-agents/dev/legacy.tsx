import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { AgentsPage, aiAgentsApiRef } from '../src';
import { stubAiAgentsApi, stubCatalogApi } from './stubs';

// The standalone `AgentsPage` in a legacy-frontend-system app (for hosts
// that do not use the New Frontend System). Run it with `npm run start:legacy`.
createDevApp()
  .registerApi({
    api: catalogApiRef,
    deps: {},
    factory: () => stubCatalogApi,
  })
  .registerApi({
    api: aiAgentsApiRef,
    deps: {},
    factory: () => stubAiAgentsApi,
  })
  .addPage({
    element: <AgentsPage />,
    title: 'AI Agents',
    path: '/ai-agents',
  })
  .render();
