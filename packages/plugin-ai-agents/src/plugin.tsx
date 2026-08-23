import React from 'react';
import { SmartToy as AgentIcon } from '@mui/icons-material';
import {
  ApiBlueprint,
  FrontendPlugin,
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

// Entity-page card with the agent's recent invocation history (status, user,
// latency). Same ai-agent filter as the overview card.
const aiAgentInvocationsCard = EntityCardBlueprint.make({
  name: 'invocations',
  params: {
    filter: {
      'spec.type': 'ai-agent',
    },
    loader: async () => {
      const { AgentInvocationsCard } = await import('./components/AgentInvocationsCard');
      return <AgentInvocationsCard />;
    },
  },
});

// Explicit type annotation: without it, tsc may fail with TS2742 when
// node_modules layouts nest a second copy of frontend-plugin-api.
export const aiAgentsPlugin: FrontendPlugin = createFrontendPlugin({
  pluginId: 'ai-agents',
  extensions: [aiAgentsApi, aiAgentsPage, aiAgentOverviewCard, aiAgentInvocationsCard],
});