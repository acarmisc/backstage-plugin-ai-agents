# @acarmisc/backstage-plugin-ai-agents

Frontend of the AI Agents plugin for Backstage: an **AI Agents** page, entity
page cards and an Activity tab for catalog components with
`spec.type: ai-agent`.

See the [repository README](https://github.com/acarmisc/backstage-plugin-ai-agents#readme)
for the catalog model and the annotation reference.

![The AI Agents page](https://raw.githubusercontent.com/acarmisc/backstage-plugin-ai-agents/main/docs/images/agents-page.png)

![The Activity view](https://raw.githubusercontent.com/acarmisc/backstage-plugin-ai-agents/main/docs/images/activity.png)

## Requirements

- Backstage 1.53 or later, on the
  [new frontend system](https://backstage.io/docs/frontend-system/).
- `@acarmisc/backstage-plugin-ai-agents-backend` for status, invocations,
  reviews, spend and activity. Without it the page lists agents only.

## Installation

```bash
yarn --cwd packages/app add @acarmisc/backstage-plugin-ai-agents
```

Apps with feature discovery pick the plugin up automatically. Otherwise add it
to `createApp`:

```ts
import aiAgentsPlugin from '@acarmisc/backstage-plugin-ai-agents';

export default createApp({ features: [aiAgentsPlugin] });
```

## Extensions

| Extension                           | What it adds                                                      |
| ----------------------------------- | ----------------------------------------------------------------- |
| `page:ai-agents`                    | The `/ai-agents` page: agent cards, filters, drawer, Activity tab |
| `api:ai-agents`                     | `aiAgentsApiRef`, the client for the catalog and `/api/ai-agents` |
| `entity-card:ai-agents/overview`    | Agent overview card on `ai-agent` entity pages                    |
| `entity-card:ai-agents/invocations` | Recent invocations card on `ai-agent` entity pages                |
| `entity-content:ai-agents/activity` | Activity tab on `ai-agent` entity pages                           |

The entity extensions only show on components with `spec.type: ai-agent`.
Disable or configure any of them under `app.extensions`:

```yaml
app:
  extensions:
    - entity-card:ai-agents/invocations: false
```

The page registers the route; add a navigation item if your sidebar is not
generated from the nav extensions.

## Development

```bash
npm start   # from this directory: dev app with sample agents, no backend
```
