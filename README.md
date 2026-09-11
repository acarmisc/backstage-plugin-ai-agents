# Backstage AI Agents Plugin

A Backstage plugin that manages **AI Agents** stored as catalog `Component`
entities, surfaced through a dedicated, card-based view at `/ai-agents` —
separate from the standard catalog browse.

## What it does

- Treats each AI agent as a first-class Backstage catalog `Component` with
  `spec.type: ai-agent`, so agents inherit ownership, relations, tags,
  metadata, RBAC, and searchability like any other component.
- Renders a responsive grid of rich **agent cards**: avatar, name, purpose,
  runtime environment, capabilities (chips), billing model, owner, lifecycle,
  version, links, and a live health badge.
- Provides filters (search, runtime, capability, lifecycle, owner) and a
  detail drawer with a deep link into the catalog entity page.
- Optional **backend** probes each agent's health/endpoint annotation and
  returns live status (healthy / degraded / down / unknown) with an
  in-memory TTL cache.

## Packages

- `packages/plugin-ai-agents` — frontend
  (`@acarmisc/backstage-plugin-ai-agents`)
- `packages/plugin-ai-agents-backend` — backend, optional but recommended
  (`@acarmisc/backstage-plugin-ai-agents-backend`)
- `packages/plugin-ai-agents-backend-module-agentcore` — AWS Bedrock
  AgentCore invocation module
  (`@acarmisc/backstage-plugin-ai-agents-backend-module-agentcore`)
- `packages/plugin-ai-agents-backend-module-kagent` — kagent
  (Kubernetes-native agent runtime) invocation module
  (`@acarmisc/backstage-plugin-ai-agents-backend-module-kagent`)

> **Where this is going:** see [docs/EVOLUTION_PLAN.md](docs/EVOLUTION_PLAN.md)
> for the roadmap towards a vendor-neutral, multi-runtime agent control
> plane, and the reasoning behind it.

Built with the Backstage **New Frontend System**
(`@backstage/frontend-plugin-api`, `PageBlueprint`, `ApiBlueprint`) and the
**New Backend System** (`@backstage/backend-plugin-api`).

## Documentation

- [Catalog model](docs/catalog-model.md) — the `ai-agent` entity shape, annotations, and how to add an agent
- [Installation](docs/install.md) — installing and wiring the frontend/backend packages
- [Providers](docs/providers.md) — configuring the shipped AgentCore/kagent invocation modules
- [Writing a provider module](docs/writing-a-provider.md) — plugging in your own invoker
- [Operations](docs/operations.md) — discovery, the API surface, permissions, reviews, and releasing

## Development

```bash
# Build both packages
npm run build --workspaces

# Run tests (node --test)
npm test --workspace @acarmisc/backstage-plugin-ai-agents
npm test --workspace @acarmisc/backstage-plugin-ai-agents-backend

# Standalone frontend dev mode (renders sample agents, no catalog/backend)
cd packages/plugin-ai-agents && npm start
```

The dev mode (`packages/plugin-ai-agents/dev/index.tsx`) bundles six sample
agents covering all runtimes, billing models, lifecycles, and capability
categories, served through an in-memory stub `CatalogApi` — no live catalog
or backend required.

## Architecture

- **Frontend** lists agents via the Backstage `CatalogApi` filtered to
  `kind: Component, spec.type: ai-agent`; an `entityToAgent` mapper reads the
  annotation namespace into a typed `AiAgent` shape. The optional status
  overlay is fetched from the backend and merged client-side.
- **Backend** provides two modes: stateless status probing (default), and
  optional persistence. The stateless path resolves entity refs via the
  catalog service token, reads each agent's `health`/`endpoint` annotation,
  probes it with a short timeout, and maps the HTTP result to a status state,
  cached in-memory for `statusCacheTtlMs` to survive bursts. When a database
  is configured, the backend additionally persists invocation history and
  reviews to `invocations` and `agent_reviews` tables; the plugin degrades
  gracefully to status-only mode without one. The catalog remains the single
  source of truth for agent data.

## Design decisions

- **Agents as catalog Components** — inherit ownership, RBAC, search,
  relations, providers. No new persistence.
- **Annotations, not custom `spec`** — catalog processors tolerate unknown
  annotations; structured `spec` custom fields are riskier across versions.
- **Backend probes only** — no agent CRUD. Create/edit agents via the normal
  catalog workflow (`catalog-info.yaml`, providers, scaffolder templates).
- **Drawer + catalog deep link** — quick view in the drawer, full entity
  page via "Open in catalog", avoiding duplication of the catalog UI.
- **Entity-page card** — an `EntityCardBlueprint` (filtered to
  `spec.type: ai-agent`) shows the same agent overview on the catalog entity
  page, so the agent's context is visible wherever it's referenced.

## License

Apache-2.0
