import React from 'react';
import { SmartToy as AgentIcon } from '@mui/icons-material';
import {
  ApiBlueprint,
  PageBlueprint,
  createFrontendPlugin,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
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

// Entity-page card shown on Component entities with spec.type: ai-agent.
// Renders an agent overview (runtime, billing, capabilities, status) inside
// the catalog entity Overview page. The filter restricts it to ai-agent
// entities so it stays hidden on regular services/APIs/resources.
const aiAgentOverviewCard = EntityCardBlueprint.make({
  name: 'overview',
  params: {
    filter: {
      'spec.type': 'ai-agent',
    },
    loader: async () => {
      const { AgentOverviewCard } = await import('./components/AgentOverviewCard');
      return <AgentOverviewCard />;
    },
  },
});

export const aiAgentsPlugin = createFrontendPlugin({
  pluginId: 'ai-agents',
  extensions: [aiAgentsApi, aiAgentsPage, aiAgentOverviewCard],
});