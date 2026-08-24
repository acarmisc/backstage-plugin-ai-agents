# Implementation Plan — `backstage-plugin-ai-agents`

A Backstage plugin that manages **AI Agents** stored as catalog `Component` entities, surfaced through a dedicated, card-based view (separate from the standard catalog browse).

## Mission

Treat each AI agent as a first-class Backstage catalog `Component` of a new `spec.type: ai-agent`. The plugin provides:

- A dedicated **Agents page** (`/ai-agents`) — a grid of rich cards.
- A **catalog filter** so only `ai-agent` components are shown.
- An optional **catalog extension** so the agent's own entity page shows an "Agent Overview" tab.
- Optional **backend** for live health/status probing and runtime metadata enrichment.

The plugin is **catalog-native**: agents live in the Backstage catalog (via `catalog-info.yaml` or providers), so they inherit ownership, relations, tags, metadata, RBAC, and searchability — exactly like any other Component.

---

## Reference patterns (from existing plugins)

Derived from `backstage-plugin-litellm-govai` (governance frontend/backend pair) and `backstage-plugin-litellm-rag-ai` (chat frontend/backend pair):

| Concern | Pattern | Source |
|---|---|---|
| Monorepo layout | `packages/plugin-<name>` + `packages/plugin-<name>-backend` | both |
| New Frontend System | `createFrontendPlugin` + `PageBlueprint` + `ApiBlueprint` from `@backstage/frontend-plugin-api` | `plugin.tsx` |
| API client | Class with `FetchApi`, `createApiRef`, base path `/api/<id>` | `api.ts` |
| Backend | `createBackendPlugin` + `coreServices.httpRouter` + `createRouter` (express) | `plugin.ts`, `router.ts` |
| Build | esbuild `build.js` emitting `dist/index.esm.js` + `dist/index.cjs.js`, `tsc` for `.d.ts` | `build.js` |
| Config schema | `config.d.ts` with `@visibility` annotations | backend |
| Catalog integration | `catalog-info.yaml` `kind: Plugin` + root `kind: Location` | govai root |
| Package metadata | `backstage.role`, `backstage.pluginId`, `backstage.pluginPackages` | all `package.json` |
| Scope | `@acarmisc/backstage-plugin-<name>` (frontend) / `-backend` suffix | both |

---

## Repository layout

```
backstage-plugin-ai-agents/
├── package.json                      # monorepo root, private, workspaces
├── README.md
├── catalog-info.yaml                  # root Location → both package catalog-info.yaml
├── .gitignore
├── packages/
│   ├── plugin-ai-agents/              # frontend
│   │   ├── package.json
│   │   ├── build.js
│   │   ├── tsconfig.json
│   │   ├── tsconfig.test.json
│   │   ├── config.d.ts                # (frontend-visible config, if any)
│   │   ├── catalog-info.yaml          # kind: Plugin
│   │   ├── dev/
│   │   │   └── index.tsx
│   │   └── src/
│   │       ├── index.ts
│   │       ├── plugin.tsx
│   │       ├── api.ts
│   │       ├── types.ts
│   │       ├── catalog-extension.tsx   # optional: AgentOverviewTab extension
│   │       ├── components/
│   │       │   ├── AgentsPage.tsx
│   │       │   ├── AgentsGrid.tsx
│   │       │   ├── AgentCard.tsx
│   │       │   ├── AgentAvatar.tsx
│   │       │   ├── AgentCapabilities.tsx
│   │       │   ├── AgentFilters.tsx
│   │       │   ├── AgentDetailDrawer.tsx
│   │       │   └── AgentStatusBadge.tsx
│   │       ├── hooks/
│   │       │   └── useAgents.ts
│   │       └── __fixtures__/           # sample agent entities for dev mode
│   │           └── sample-agents.yaml
│   └── plugin-ai-agents-backend/      # backend (optional, for live status)
│       ├── package.json
│       ├── build.js
│       ├── tsconfig.json
│       ├── tsconfig.test.json
│       ├── config.d.ts
│       ├── catalog-info.yaml
│       └── src/
│           ├── index.ts
│           ├── plugin.ts
│           ├── router.ts
│           ├── client.ts               # probes agent runtime endpoints
│           └── types.ts
```

---

## Catalog model for an AI Agent

Agents are `Component` entities with `spec.type: ai-agent`. The agent-specific fields live in `metadata.annotations` and `metadata.tags`, plus a structured `spec` extension under a custom key (Backstage allows arbitrary `spec` fields; a custom annotation namespace is the safest for catalog processors that don't know the type).

### Sample `catalog-info.yaml` for an agent

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: support-triage-agent
  title: Support Triage Agent
  description: Classifies and routes incoming support tickets by severity and product area.
  tags:
    - ai-agent
    - llm
    - support
  labels:
    ai-agent/runtime: bedrock-agentcore
    ai-agent/billing: per-invocation
  annotations:
    ai-agent.io/avatar: https://example.com/avatars/triage.png
    ai-agent.io/runtime: bedrock-agentcore
    ai-agent.io/runtime-handle: arn:aws:bedrock:us-east-1:...:agent/TXXX
    ai-agent.io/endpoint: https://abc.execute-api.us-east-1.amazonaws.com/prod
    ai-agent.io/health: https://abc.execute-api.us-east-1.amazonaws.com/prod/health
    ai-agent.io/billing-model: per-invocation
    ai-agent.io/cost-per-1k: "0.012"
    ai-agent.io/owner-team: group:default/cs-ops
    ai-agent.io/version: "1.4.2"
  links:
    - url: https://grafana.example.com/d/agents/support-triage
      title: Metrics
      icon: dashboard
    - url: https://docs.example.com/agents/support-triage
      title: Playbook
      icon: docs
spec:
  type: ai-agent
  lifecycle: production
  owner: cs-ops
  system: customer-support
  dependsOn:
    - component:default/ticketing-api
    - resource:default/bedrock-claude-sonnet
```

### Typed shape (frontend `types.ts`)

```typescript
import { Entity } from '@backstage/catalog-model';

export const AI_AGENT_TYPE = 'ai-agent';
export const AI_AGENT_ANNOTATION_PREFIX = 'ai-agent.io';

export interface AgentRuntimeInfo {
  /** e.g. "bedrock-agentcore", "litellm", "lambda", "custom" */
  runtime: string;
  /** opaque handle/ARN/endpoint the backend uses to probe the agent */
  runtimeHandle?: string;
  /** public invocation endpoint, if any */
  endpoint?: string;
  /** health-check URL the backend can call */
  healthUrl?: string;
}

export interface AgentBilling {
  /** "per-invocation" | "per-token" | "subscription" | "free" */
  model: string;
  /** USD cost per 1000 invocations or per 1M tokens, depending on model */
  unitCost?: number;
  /** monthly spend cap if known */
  budget?: number;
}

export interface AgentCapability {
  /** short label, shown as a chip — e.g. "tool-use", "rag", "vision", "code-interp" */
  label: string;
  /** optional chip color/icon hint */
  category?: 'reasoning' | 'retrieval' | 'tools' | 'vision' | 'voice' | 'data' | 'safety';
}

export interface AgentStatus {
  /** "healthy" | "degraded" | "down" | "unknown" */
  state: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastChecked?: string;
  latencyMs?: number;
  message?: string;
}

export interface AiAgent {
  /** Backstage entity ref, e.g. "component:default/support-triage-agent" */
  entityRef: string;
  name: string;
  title?: string;
  description?: string;
  avatarUrl?: string;
  owner?: string;
  system?: string;
  lifecycle?: string;
  version?: string;
  purpose: string;            // derived from description or a dedicated annotation
  runtime: AgentRuntimeInfo;
  billing: AgentBilling;
  capabilities: AgentCapability[];
  tags: string[];
  links: { url: string; title: string; icon?: string }[];
  status?: AgentStatus;        // populated by backend, undefined in static view
  rawEntity: Entity;
}
```

### Entity → `AiAgent` mapping helper

A pure function `entityToAgent(entity: Entity): AiAgent` in `src/types.ts` reads `metadata.annotations[`${AI_AGENT_ANNOTATION_PREFIX}/...`]`, `metadata.tags`, `metadata.links`, `spec.owner`, `spec.system`, `spec.lifecycle`. Capabilities are parsed from a comma-or-newline-separated annotation (`ai-agent.io/capabilities: "tool-use,rag,vision"`) optionally with category suffixes (`tool-use:tools`).

---

## Frontend package — `@acarmisc/backstage-plugin-ai-agents`

### `package.json` (mirrors govai frontend)

```jsonc
{
  "name": "@acarmisc/backstage-plugin-ai-agents",
  "version": "0.1.0",
  "backstage": {
    "role": "frontend-plugin",
    "pluginId": "ai-agents",
    "pluginPackages": ["@acarmisc/backstage-plugin-ai-agents"]
  },
  "publishConfig": { "access": "public" },
  "license": "Apache-2.0",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js"
    }
  },
  "main": "dist/index.cjs.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "node build.js && tsc -p tsconfig.json",
    "test": "tsc -p tsconfig.test.json && node --test dist-test/**/*.test.js dist-test/*.test.js",
    "prepack": "npm run build"
  },
  "dependencies": {
    "@backstage/core-components": "^0.18.10",
    "@backstage/core-plugin-api": "^1.12.6",
    "@backstage/catalog-model": "^1.7.0",
    "@backstage/catalog-client": "^1.9.0",
    "@backstage/frontend-plugin-api": "^0.17.0",
    "@backstage/plugin-catalog-react": "^1.15.0",
    "@backstage/theme": "^0.6.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "@mui/icons-material": "^5.18.0",
    "@mui/material": "^5.16.0",
    "react": "^18.0.0",
    "react-use": "^17.2.4",
    "react-router-dom": "^6.30.0"
  },
  "peerDependencies": {
    "@types/react": "^18.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@backstage/cli": "^0.36.2",
    "@backstage/dev-utils": "^1.1.23",
    "@backstage/frontend-test-utils": "^0.6.0",
    "@backstage/test-utils": "^1.7.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.2.0",
    "esbuild": "^0.28.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.9.3"
  }
}
```

### `plugin.tsx`

```tsx
import React from 'react';
import { SmartToy as AgentIcon } from '@mui/icons-material';
import {
  createFrontendPlugin,
  ApiBlueprint,
  PageBlueprint,
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
```

### `api.ts`

```typescript
import { createApiRef, FetchApi } from '@backstage/core-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import { AI_AGENT_TYPE, AiAgent, entityToAgent, AgentStatus } from './types';

export interface AiAgentsApiInterface {
  listAgents(): Promise<AiAgent[]>;
  getAgent(entityRef: string): Promise<AiAgent | undefined>;
  getStatuses(entityRefs: string[]): Promise<Record<string, AgentStatus>>;
}

export const aiAgentsApiRef = createApiRef<AiAgentsApiInterface>({
  id: 'plugin.ai-agents.api',
});

export class AiAgentsApi implements AiAgentsApiInterface {
  constructor(
    private opts: { fetchApi: FetchApi; catalogApi: CatalogApi },
    private basePath = '/api/ai-agents',
  ) {}

  async listAgents(): Promise<AiAgent[]> {
    const entities = await this.opts.catalogApi.getEntities({
      filter: { kind: 'component', 'spec.type': AI_AGENT_TYPE },
    });
    return entities.items.map(entityToAgent);
  }

  async getAgent(entityRef: string): Promise<AiAgent | undefined> {
    const entity = await this.opts.catalogApi.getEntityByRef(entityRef);
    return entity ? entityToAgent(entity) : undefined;
  }

  async getStatuses(entityRefs: string[]): Promise<Record<string, AgentStatus>> {
    if (!entityRefs.length) return {};
    const res = await this.opts.fetchApi.fetch(
      `${this.basePath}/statuses?refs=${encodeURIComponent(entityRefs.join(','))}`,
    );
    if (!res.ok) return {};
    return res.json();
  }
}
```

### `index.ts` (public exports)

```typescript
export { aiAgentsPlugin } from './plugin';
export { AgentsPage } from './components/AgentsPage';
export { AgentCard } from './components/AgentCard';
export { aiAgentsApiRef, AiAgentsApi } from './api';
export type { AiAgentsApiInterface } from './api';
export * from './types';
```

### `src/components/AgentsPage.tsx`

Top-level page. Loads agents via `useAsync(() => api.listAgents())`, optionally fetches live statuses via the backend (`api.getStatuses` — guarded so absence of backend just hides the status chip), and renders `AgentsFilters` + `AgentsGrid`.

- **Filters**: search box (name/description), runtime multi-select, capability multi-select, lifecycle, owner. State held in `useState`; filtering done client-side on the loaded list.
- **Empty state**: friendly "No AI agents registered" with a hint to add a `Component` of `spec.type: ai-agent` to the catalog.
- **Loading**: `CircularProgress` centered (matching govai's `LiteLLMPage` loading block).

### `src/components/AgentsGrid.tsx`

MUI `Grid` (or `Box` with `display: grid` + `gridTemplateColumns: repeat(auto-fill, minmax(340px, 1fr))`). Responsive. Each cell is an `AgentCard`.

### `src/components/AgentCard.tsx` — the core visual unit

A `Card` raised, hover-elevated, clickable (opens `AgentDetailDrawer`). Layout top-to-bottom:

1. **Header row**
   - `AgentAvatar` (40–48 px rounded image; falls back to initials on a tinted circle when no `avatarUrl`).
   - Title (`metadata.title` or `name`) — `Typography variant="subtitle1"`, bold.
   - `AgentStatusBadge` (top-right): green/amber/red/grey dot + tooltip with `lastChecked` and `latencyMs`.
2. **Purpose** — `description` truncated to 2 lines (`-webkit-line-clamp`).
3. **Runtime environment** — icon + label (e.g. Bedrock, LiteLLM, Lambda). Small `Box` with `Chip`-like styling; clicking filters by runtime.
4. **Capabilities** — `AgentCapabilities` renders one `Chip` per capability, color-coded by category. Max 5 visible + "+N" overflow chip.
5. **Billing model** — row with `Chip` (`per-invocation` / `per-token` / `subscription` / `free`) and a secondary line `~$0.012 / 1k invocations` when `unitCost` is known.
6. **Meta footer** — owner avatar (Backstage `OwnerRef` if available, else text), lifecycle `Chip` (prod=green, experimental=amber, deprecated=grey), version `Typography variant="caption"`.
7. **Links** — small icon row: Metrics (dashboard), Docs, Logs, Playbook — using `metadata.links[].icon` to pick an MUI icon. Hidden when absent.

Hover/active states via `sx`. Card click opens the drawer; chip clicks and link clicks stop propagation.

### `src/components/AgentAvatar.tsx`

`<img>` with `onError` fallback to a `Box` showing initials derived from the name, background color derived from a hash of the name (stable palette). Used both on the card and in the drawer header.

### `src/components/AgentCapabilities.tsx`

Maps capability category → MUI `color` (`'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'default'`). Overflow handling: slice to `MAX_VISIBLE=5`, render `+N more` chip that opens a small `Popover` listing the rest.

### `src/components/AgentStatusBadge.tsx`

Renders a 10 px circle + optional latency text. Colors:
- `healthy` → `success.main`
- `degraded` → `warning.main`
- `down` → `error.main`
- `unknown` / undefined → `text.disabled` + dashed ring.

Tooltip shows `Last checked: <relative time> · <latencyMs>ms` when available. When the backend is not configured, the badge shows "unknown" silently (no error toast).

### `src/components/AgentDetailDrawer.tsx`

MUI `Drawer` (anchor right, width ~480 px). Shows:
- Full avatar + title + entity ref (copyable).
- Full description (no truncation).
- Runtime block: runtime name, `runtimeHandle`, `endpoint` (link), `healthUrl`.
- Capabilities (all, no truncation).
- Billing block: model, unit cost, budget.
- Owner, system, lifecycle, version, tags.
- All `metadata.links` as a list.
- A "Open in catalog" button → `Link to="/catalog/component/..."`.
- A "Invoke" button (placeholder; future work hooks into the chat/invocation plugin).
- Live status block with a manual "Refresh status" button hitting `api.getStatuses([ref])`.

### `src/components/AgentFilters.tsx`

A horizontal `Paper` toolbar:
- `TextField` (search) with `InputAdornment` search icon.
- `Select` (runtime) — multi.
- `Select` (capability) — multi.
- `Select` (lifecycle) — single.
- `Select` (owner) — single (options derived from loaded agents).
- "Clear filters" text button.

Filtering logic lives in `useAgents` hook so it's testable independently of the UI.

### `src/hooks/useAgents.ts`

```typescript
export function useAgents() {
  const api = useApi(aiAgentsApiRef);
  const { value, loading, error, retry } = useAsyncRetry(() => api.listAgents(), [api]);
  const [filters, setFilters] = useState<AgentFilterState>(initialFilters);
  const filtered = useMemo(() => applyFilters(value ?? [], filters), [value, filters]);
  return { agents: filtered, allAgents: value, loading, error, retry, filters, setFilters };
}
```

### `src/catalog-extension.tsx` (optional, deferred to v0.2)

A `EntityTabBlueprint` that adds an "Agent Overview" tab to catalog entity pages when `spec.type === 'ai-agent'`. Renders a compact read-only version of `AgentCard` plus the runtime/billing/capabilities blocks. Gated behind a feature flag to avoid coupling with the host app's catalog customization.

### Dev mode (`dev/index.tsx`)

Uses `createDevApp` (like govai). Registers a mock catalog with the sample agents from `__fixtures__/sample-agents.yaml` so the page renders standalone without a real Backstage backend.

---

## Backend package — `@acarmisc/backstage-plugin-ai-agents-backend`

**Optional but recommended.** Without it the plugin still works — cards just show `unknown` status and no live endpoint metadata. The backend's only job is to **probe agent health/runtime** and return a map of statuses; it does not own agent data (the catalog does).

### Routes (all under `/api/ai-agents`, Backstage-auth)

| Route | Method | Purpose |
|---|---|---|
| `/health` | GET | `{ status: 'ok' }` |
| `/statuses?refs=ref1,ref2` | GET | For each ref, resolve the entity from the catalog, read its `ai-agent.io/health` (or `endpoint`) annotation, probe it with a short timeout, return `{ [entityRef]: AgentStatus }`. |
| `/status/:entityRef` | GET | Same for a single agent — used by the drawer's "Refresh status" button. |

### `plugin.ts`

```typescript
import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { createRouter } from './router';

export const aiAgentsPlugin = createBackendPlugin({
  pluginId: 'ai-agents',
  register(reg) {
    reg.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
        catalog: coreServices.catalog,
      },
      async init({ httpRouter, config, logger, auth, discovery, catalog }) {
        const router = await createRouter({ config, logger, auth, discovery, catalog });
        httpRouter.use(router);
      },
    });
  },
});
```

### `router.ts`

- `express.json()` body parser (same caveat as govai — Backstage's `httpRouter` doesn't apply one).
- `/statuses` splits `refs`, calls `catalogClient.getEntitiesByRefs`, filters to `ai-agent` type, and for each entity with a health/endpoint annotation fires `probe(client, url)` with a 3 s `AbortController` timeout and a 5 s overall budget. Failures map to `{ state: 'down', message }`. Timeout → `degraded`. 2xx within budget → `healthy` with `latencyMs`.
- Caches results in-memory for `statusCacheTtlMs` (default 15 s, configurable) to survive bursts and the grid's parallel refetch.
- Uses `auth.authenticate(req)` to ensure the caller is a Backstage user (mirrors govai's `resolveUserId`).

### `client.ts`

`AgentProbe` class — a thin `fetch` wrapper that:
- Applies a configurable User-Agent (`backstage-ai-agents/<version>`).
- Adds an optional auth header when `ai-agents.probe.authHeader` is configured (for agents behind an API gateway).
- Returns `{ ok, status, latencyMs, bodySnippet }`.

### `config.d.ts`

```typescript
export interface Config {
  'ai-agents'?: {
    /** Enable live status probing. Default true when the backend is registered. */
    enabled?: boolean;
    /** Per-probe timeout in ms. @default 3000 */
    probeTimeoutMs?: number;
    /** In-memory status cache TTL in ms. @default 15000 */
    statusCacheTtlMs?: number;
    /** Optional static auth header injected into every probe. @visibility secret */
    probeAuthHeader?: string;
    /** Allowed probe URL origin allowlist (glob). Empty = allow all http(s). */
    probeAllowlist?: string[];
  };
}
```

### `package.json` (backend)

Mirrors govai backend. Key deps: `@backstage/backend-plugin-api`, `@backstage/catalog-client`, `@backstage/catalog-model`, `@backstage/config`, `express`, `@backstage/plugin-catalog-node` (for `coreServices.catalog`).

---

## Build, test, lint

- `build.js` — identical esbuild pattern to govai (ESM + CJS, external packages, sourcemaps).
- `tsconfig.json` — copy govai's (ES2020, ESNext module, strict, `emitDeclarationOnly`).
- `tsconfig.test.json` — emits to `dist-test/` for `node --test`.
- Lint: rely on the host Backstage monorepo's `@backstage/cli` (same as govai — root `lint` script defers to workspace).
- Tests:
  - `types.test.ts` — `entityToAgent` parsing (capabilities, billing, runtime, missing annotations).
  - `api.test.ts` — mock `CatalogApi` returning fixture entities; assert filtering and mapping.
  - `useAgents.test.ts` — filter combinations.
  - Backend `router.test.ts` — mock `CatalogClient` + `fetch`; assert `/statuses` returns correct states for healthy/degraded/down/timeout.

---

## Root files

### `package.json` (monorepo root)

```jsonc
{
  "name": "@acarmisc/backstage-plugin-ai-agents-monorepo",
  "version": "0.1.0",
  "private": true,
  "description": "AI Agents management plugin for Backstage — agents as catalog Components with a dedicated card view.",
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "yarn workspace @acarmisc/backstage-plugin-ai-agents build && yarn workspace @acarmisc/backstage-plugin-ai-agents-backend build",
    "test": "yarn workspace @acarmisc/backstage-plugin-ai-agents test && yarn workspace @acarmisc/backstage-plugin-ai-agents-backend test"
  },
  "devDependencies": { "typescript": "^5.0.0" }
}
```

### `catalog-info.yaml` (root)

```yaml
apiVersion: backstage.io/v1alpha1
kind: Location
metadata:
  name: backstage-plugin-ai-agents
  description: Root catalog location for the ai-agents plugin packages.
spec:
  targets:
    - ./packages/plugin-ai-agents/catalog-info.yaml
    - ./packages/plugin-ai-agents-backend/catalog-info.yaml
```

### `.gitignore`

```
node_modules/
dist/
dist-test/
*.log
.yarn/cache
```

---

## Host app integration

### Backend (`packages/backend/src/index.ts`)

```typescript
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
```

### Frontend (`packages/app/src/App.tsx`)

New Frontend System — add `aiAgentsPlugin` to the app's plugin list. The `PageBlueprint` registers the `/ai-agents` route automatically. For the sidebar, add a nav item pointing to `/ai-agents` with the `SmartToy` icon.

### App config (`app-config.yaml`)

```yaml
ai-agents:
  enabled: true
  probeTimeoutMs: 3000
  statusCacheTtlMs: 15000
  # probeAuthHeader: ${AI_AGENTS_PROBE_TOKEN}   # optional, @visibility secret
  # probeAllowlist:
  #   - "https://*.execute-api.*.amazonaws.com/*"
```

---

## Delivery phases

| Phase | Scope | Deliverable |
|---|---|---|
| **0 — Scaffolding** | Monorepo root, both `package.json`, `build.js`, `tsconfig*.json`, `catalog-info.yaml`, `.gitignore`, empty `src/index.ts` | `yarn workspaces` install + `yarn build` produces empty bundles. |
| **1 — Catalog model + types** | `types.ts` with `AiAgent`, `entityToAgent`, capability parsing; `__fixtures__/sample-agents.yaml` (≥6 agents covering all runtimes/capabilities/lifecycles); unit tests for `entityToAgent`. | Tests green. |
| **2 — API + plugin shell** | `api.ts`, `plugin.tsx`, `index.ts`, dev mode with mock catalog. `/ai-agents` renders a placeholder page listing fixture agents as raw text. | Dev server shows the page. |
| **3 — AgentCard + AgentsGrid** | `AgentCard`, `AgentAvatar`, `AgentCapabilities`, `AgentStatusBadge` (unknown-only stub), `AgentsGrid`. No filters yet. | Grid of rich cards from fixtures. |
| **4 — AgentsPage + filters** | `AgentsPage`, `AgentFilters`, `useAgents`. Search + runtime + capability + lifecycle + owner filters wired. | Interactive filtering. |
| **5 — AgentDetailDrawer** | Drawer with full agent info, links, "Open in catalog" button. | Click a card → drawer. |
| **6 — Backend (status probing)** | `plugin.ts`, `router.ts`, `client.ts`, `config.d.ts`, `coreServices.catalog` integration. `/statuses` + `/status/:ref`. | Cards show live health in dev against a mock agent endpoint. |
| **7 — Live status wiring** | `AgentStatusBadge` consumes real statuses; drawer "Refresh" button; cache + polling (30 s) on the page. | End-to-end live status. |
| **8 — Tests + docs** | Backend router tests, frontend component tests (rendering `AgentCard` with fixture entities), README with install + sample `catalog-info.yaml`. | `yarn test` green; README complete. |
| **9 (optional) — Catalog extension** | `catalog-extension.tsx` Agent Overview tab on entity pages for `spec.type: ai-agent`. | Tab visible on agent entities in the host app. |

---

## Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Agent storage | Backstage catalog `Component`, `spec.type: ai-agent` | Inherits ownership, RBAC, search, relations, providers. No new persistence. Matches "agents as catalog components" intent. |
| Agent-specific data | `metadata.annotations` under `ai-agent.io/*` + `metadata.tags` + `metadata.links` | Catalog processors tolerate unknown annotations; structured `spec` custom fields are riskier across catalog versions. Tags/links are first-class in the catalog UI already. |
| Frontend framework | New Frontend System (`@backstage/frontend-plugin-api`, `PageBlueprint`, `ApiBlueprint`) | Matches both reference plugins; Backstage 1.50+ standard. |
| API client deps | `catalogApiRef` + `fetchApiRef` | List/detail from catalog; status probing from the backend. No separate data source. |
| Backend scope | Health probing only; no agent CRUD | Catalog is the source of truth. Adding/ editing agents happens via the normal catalog workflow (`catalog-info.yaml`, providers, scaffolder templates). Keeps the backend tiny and stateless. |
| Status caching | In-memory, 15 s TTL | Prevents probe storms when the grid refetches; short enough to stay fresh. |
| Avatar fallback | Initials on hashed-color circle | Works offline; no external dependency; consistent visual. |
| Capability chips | Category → MUI color | Visual scannability without custom theming. |
| Drawer vs entity page | Drawer for quick view; "Open in catalog" deep-links to the full entity page | Avoids duplicating the catalog entity UI; keeps the plugin's surface small. |
| Packaging scope | `@acarmisc/backstage-plugin-ai-agents` (+ `-backend`) | Consistent with govai and chat plugins. |

---

## Sample fixture (`src/__fixtures__/sample-agents.yaml`)

Six agents covering: Bedrock AgentCore, LiteLLM, AWS Lambda, custom HTTP, a deprecated agent, and an experimental one. Each exercises different capability sets, billing models, lifecycle states, and owners so the grid and filters can be visually validated in dev mode without a live catalog.

---

## Out of scope (future work)

- Agent **creation/editing** UI (use scaffolder templates or the catalog UI).
- Agent **invocation** (separate chat/invocation plugin; this plugin only links to it).
- **Cost/spend analytics** per agent (reuse the govai usage backend if available).
- **Multi-agent orchestration** views.
- Persistent status history (would require a store; current design is in-memory TTL only).
- RBAC on the status endpoint beyond Backstage's default auth.