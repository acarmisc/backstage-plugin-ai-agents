import React from 'react';
import { SmartToy as AgentIcon } from '@mui/icons-material';
import {
  ApiBlueprint,
  PageBlueprint,
  createFrontendPlugin,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { aiAgentsApiRef, AiAgentsApi } from './api';

const aiAgentsApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: aiAgentsApiRef,
      deps: { fetchApi: fetchApiRef, catalogApi: catalogApiRef },
      factory: ({ fetchApi, catalogApi }) =>
        new AiAgentsApi({ fetchApi, catalogApi }),
    }),
});

const aiAgentsPage = PageBlueprint.make({
  params: {
    path: '/ai-agents',
    title: 'AI Agents',
    icon: <AgentIcon />,
    loader: async () => {
      const { AgentsPage } = await import('./components/AgentsPage');
      return <AgentsPage />;
    },
  },
});

export const aiAgentsPlugin = createFrontendPlugin({
  pluginId: 'ai-agents',
  extensions: [aiAgentsApi, aiAgentsPage],
});