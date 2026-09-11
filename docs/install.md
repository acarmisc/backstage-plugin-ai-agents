# Installation

## 1. Add the packages

```bash
# app (frontend)
yarn workspace app add @acarmisc/backstage-plugin-ai-agents
# backend
yarn workspace backend add @acarmisc/backstage-plugin-ai-agents-backend
```

For local development against an unreleased copy, use a `file:` dependency
in `packages/app/package.json` and `packages/backend/package.json`:

```json
"@acarmisc/backstage-plugin-ai-agents": "file:/abs/path/to/backstage-plugin-ai-agents/packages/plugin-ai-agents"
"@acarmisc/backstage-plugin-ai-agents-backend": "file:/abs/path/to/backstage-plugin-ai-agents/packages/plugin-ai-agents-backend"
```

## 2. Register the backend

`packages/backend/src/index.ts`:

```typescript
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
```

## 3. Register the frontend

`packages/app/src/App.tsx` (New Frontend System):

```typescript
import { aiAgentsPlugin } from '@acarmisc/backstage-plugin-ai-agents';

export default createApp({
  features: [
    /* ...other plugins... */
    aiAgentsPlugin,
  ],
});
```

The `PageBlueprint` registers the `/ai-agents` route automatically. For the
sidebar, add a nav item (the host app's `Sidebar.tsx` is hand-wired):

```tsx
import ExtensionIcon from '@material-ui/icons/Extension';
<SidebarItem
  icon={ExtensionIcon}
  to="/ai-agents"
  text="AI Agents"
/>;
```

> **Icon note**: `@material-ui/icons/SmartToy` does not exist in v4 (the
> Backstage app pins `@material-ui/icons`, not `@mui/icons-material`). Use
> `Extension` or another v4 icon. Inside the plugin's own source,
> `@mui/icons-material` (v5) is used and `SmartToy` is available there.

## 4. Configuration

`app-config.yaml`:

```yaml
ai-agents:
  enabled: true
  probeTimeoutMs: 3000
  statusCacheTtlMs: 15000
  # probeAuthHeader: ${AI_AGENTS_PROBE_TOKEN}   # optional, for gated agents
  # probeAllowlist:
  #   - "https://*.execute-api.*.amazonaws.com/*"
```

| Key | Type | Default | Description |
|---|---|---|---|
| `ai-agents.enabled` | boolean | `true` | Enable live status probing |
| `ai-agents.probeTimeoutMs` | number | `3000` | Per-probe timeout |
| `ai-agents.statusCacheTtlMs` | number | `15000` | In-memory status cache TTL |
| `ai-agents.probeAuthHeader` | string | — | Static Authorization header for probes (`@visibility secret`) |
| `ai-agents.probeAllowlist` | string[] | `[]` | Allowed probe URL origin globs (empty = no probing) |

Without the backend (or with `enabled: false`), the plugin still works —
cards just show an `unknown` status badge.

## 5. Entity-page card (optional, included automatically)

The plugin also registers an **Agent Overview** card via
`EntityCardBlueprint`, filtered to entities with `spec.type: ai-agent`. When
the plugin is registered in the app, every `ai-agent` Component's catalog
entity page automatically gets a card showing the runtime, billing,
capabilities, tags, endpoint, runtime handle, and a "View on the AI Agents
page" link — no extra wiring needed.

The card renders inside the catalog entity Overview page alongside the
other entity cards (About, Tech Insights, etc.). It's hidden on non-agent
entities, so regular services/APIs/resources are unaffected.

If you need to restrict or reorder it, use the standard
`app-config.yaml` entity-card config:

```yaml
app:
  extensions:
    - entity-card:ai-agents/overview:
        config:
          type: info   # render as a compact info card (default)
```
