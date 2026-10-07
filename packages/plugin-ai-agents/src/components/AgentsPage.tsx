import React from 'react';
import { Container, Header, Tab, TabList, TabPanel, Tabs } from '@backstage/ui';
import { useSearchParams } from 'react-router-dom';
import { AgentsGallery } from './AgentsGallery';
import { ActivityWorkspace } from './activity/ActivityWorkspace';

type View = 'agents' | 'activity';

/** Where "Open activity" goes inside this page: the `?tab=` query. */
const activityHref = (telemetryId: string) =>
  `/ai-agents?tab=activity&agent=${encodeURIComponent(telemetryId)}`;

/**
 * The whole AI Agents experience as one self-contained page: a header and
 * an Agents / Activity switch (kept in the `?tab=` query).
 *
 * In a New Frontend System app the plugin does not use this: it registers
 * the two views as sub-pages, so the app shell draws the title and the tabs.
 * Use this component to mount the plugin in other hosts.
 *
 * @public
 */
export function AgentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View =
    searchParams.get('tab') === 'activity' ? 'activity' : 'agents';

  const select = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'agents') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params);
  };

  return (
    <>
      <Header
        title="AI Agents"
        description="AI agents registered in the catalog as Component entities with spec.type: ai-agent."
      />
      <Container>
        <Tabs
          selectedKey={view}
          onSelectionChange={key => select(key === 'activity' ? key : 'agents')}
        >
          <TabList aria-label="Agents view">
            <Tab id="agents">Agents</Tab>
            <Tab id="activity">Activity</Tab>
          </TabList>
          <TabPanel id="agents">
            <AgentsGallery activityHref={activityHref} />
          </TabPanel>
          <TabPanel id="activity">
            <ActivityWorkspace />
          </TabPanel>
        </Tabs>
      </Container>
    </>
  );
}
