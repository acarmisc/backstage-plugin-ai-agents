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

Built with the Backstage **New Frontend System**
(`@backstage/frontend-plugin-api`, `PageBlueprint`, `ApiBlueprint`) and the
**New Backend System** (`@backstage/backend-plugin-api`).

---

## Catalog model

Agents are `Component` entities with `spec.type: ai-agent`. Agent-specific
fields live under the `ai-agent.io/*` annotation namespace, plus
`metadata.tags` and `metadata.links`. No custom `spec` schema is needed —
catalog processors tolerate unknown annotations, which keeps the model
portable across Backstage versions.

> **Migration note:** Annotations moved from `ai-agent.acarmisc.org/*` to
> `ai-agent.io/*` in this version. The old prefix is still read as a fallback,
> so existing entities keep working, but new or updated entities should use
> the new prefix.

Only `spec.type: ai-agent` is required for an agent to appear on the
`/ai-agents` page. The `runtime` annotation defaults to `custom` if missing;
all other annotations are optional.

### Annotation reference

| Annotation | Required | Description |
|---|---|---|
| `ai-agent.io/runtime` | recommended | Runtime badge: `bedrock-agentcore`, `litellm`, `lambda`, `custom`, or any string. Defaults to `custom`. |
| `ai-agent.io/billing-model` | no | `per-invocation`, `per-token`, `subscription`, `free` (default `free`) |
| `ai-agent.io/capabilities` | no | Comma- or newline-separated chips, optionally `label:category` |
| `ai-agent.io/cost-per-1k` | no | USD per 1000 invocations (or per 1M tokens for `per-token`) |
| `ai-agent.io/budget` | no | Monthly spend cap |
| `ai-agent.io/avatar` | no | Image URL (falls back to initials on a tinted circle) |
| `ai-agent.io/version` | no | Version string in the card footer |
| `ai-agent.io/health` | no | URL the backend probes for live status (preferred) |
| `ai-agent.io/endpoint` | no | Invocation endpoint; probed if no `health` annotation |
| `ai-agent.io/runtime-handle` | no | ARN/handle shown in the detail drawer |
| `ai-agent.io/purpose` | no | Overrides `description` as the card's purpose text |
| `ai-agent.io/hire-schema` | no | JSON array declaring the "Hire Agent" form fields. See [Hiring an agent](#hiring-an-agent). |
| `ai-agent.io/prompt-template` | no | Prompt template with `{field_name}` placeholders matching `hire-schema` fields, used to build the AgentCore invocation preview. See [Hiring an agent](#hiring-an-agent). |
| `ai-agent.io/region` | no | AWS region for the AgentCore runtime, used in the Hire preview's CLI command (e.g. `eu-west-1`). |
| `ai-agent.io/namespace` | no | Kubernetes namespace for a kagent-hosted agent; defaults to the `-module-kagent` config's `namespace`. |

Capability categories (used for chip color): `reasoning`, `retrieval`,
`tools`, `vision`, `voice`, `data`, `safety`. A capability without a
category renders as a default-colored chip.

---

## Hiring an agent

Agents that declare a `ai-agent.io/hire-schema` annotation show a
**Hire Agent** button on their card, detail drawer, and entity-page card.
Clicking it opens a form rendered from the schema. When the backend is wired
with an invoker module, a **Run agent** button invokes the agent for real and
shows the live response; the dialog also builds an invocation preview (prompt
+ HTTP payload + AWS CLI command) with a **Copy CLI** fallback for manual runs.

The `hire-schema` annotation value is a JSON array of field objects:

```yaml
ai-agent.io/hire-schema: '[{"name":"project","label":"GitLab project","type":"text","required":true,"help":"e.g. my-org/my-project"},{"name":"target","label":"MR IID","type":"text","required":true},{"name":"action","label":"Action","type":"select","required":true,"options":["dry-run","post"],"default":"dry-run"}]'
```

| Field key | Type | Description |
|---|---|---|
| `name` | string (required) | Machine key for the field; used as the form-state key and the `{name}` placeholder in the prompt template |
| `label` | string (required) | Human-readable label shown above the input |
| `type` | `text` \| `url` \| `textarea` \| `select` \| `number` | Input to render (default `text`) |
| `required` | boolean | Whether the field must be filled before submit |
| `default` | string | Default value when the form opens |
| `options` | string[] | For `select` fields: the selectable options |
| `help` | string | Optional helper text shown under the input |

Malformed JSON, non-array JSON, or unknown `type` values are tolerated:
the schema is dropped and the **Hire Agent** button stays hidden.

### Prompt template

The `ai-agent.io/prompt-template` annotation is a string with
`{field_name}` placeholders matching the `hire-schema` fields. As the user
fills the form, the preview substitutes the placeholders with the field
values and builds:

1. **Prompt** — the filled template (or, when no `prompt-template` is set,
   a JSON object of all field values).
2. **Payload** — the `{"prompt": "..."}` JSON body for the AgentCore
   `/invocations` endpoint.
3. **AWS CLI command** — `aws bedrock-agentcore invoke-agent-runtime`,
   using `ai-agent.io/region` and
   `ai-agent.io/runtime-handle`. If either is missing, a warning
   chip is shown and the values are left as placeholders.

```yaml
ai-agent.io/prompt-template: "Review merge request !{target} in project '{project}'. Action: {action}."
ai-agent.io/region: us-east-1
ai-agent.io/runtime-handle: support-triage-runtime
```

---

## Adding an agent

### 1. Create the `catalog-info.yaml`

Place this file at the **root of the agent's GitLab repository**, on the
default branch. This is the only file Backstage needs to ingest the agent.

```yaml
# catalog-info.yaml — repo root
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: support-triage-agent
  title: Support Triage Agent          # shown as the card title
  description: Classifies and routes incoming support tickets by severity and product area.
  tags: [ai-agent, llm, support]       # 'ai-agent' tag is conventional but optional
  annotations:
    # --- recommended ---
    ai-agent.io/runtime: bedrock-agentcore      # bedrock-agentcore | litellm | lambda | custom
    ai-agent.io/billing-model: per-invocation   # per-invocation | per-token | subscription | free

    # --- optional but useful on the card ---
    ai-agent.io/capabilities: "tool-use:tools,rag:retrieval,reasoning:reasoning"
    ai-agent.io/cost-per-1k: "0.012"             # USD per 1k invocations (or per 1M tokens)
    ai-agent.io/version: "1.4.2"
    ai-agent.io/avatar: https://api.dicebear.com/7.x/bottts/svg?seed=triage

    # --- runtime handles (used by the backend status prober) ---
    ai-agent.io/runtime-handle: arn:aws:bedrock:us-east-1:123:agent/TXXX
    ai-agent.io/endpoint: https://abc.execute-api.us-east-1.amazonaws.com/prod
    ai-agent.io/health: https://abc.execute-api.us-east-1.amazonaws.com/prod/health
    # the backend probes `health` first, falls back to `endpoint`; omit both → status "unknown"

    # --- standard Backstage annotations (optional, work everywhere) ---
    backstage.io/techdocs-ref: dir:.
    gitlab.com/project-slug: my-org/agents/support-triage-agent

  links:
    - url: https://grafana.example.com/d/agents/support-triage
      title: Metrics
      icon: dashboard
    - url: https://docs.example.com/agents/support-triage
      title: Playbook
      icon: docs
spec:
  type: ai-agent                         # ← the plugin filters on this exact value
  lifecycle: production                  # production | experimental | deprecated
  owner: cs-ops                          # must match a Group/User entity ref in the catalog
  system: customer-support               # optional, must match a System entity
  dependsOn:
    - component:default/ticketing-api
    - resource:default/bedrock-agent
```

### 2. Commit and push

Commit `catalog-info.yaml` to the default branch of a project inside one of
the GitLab groups configured for catalog discovery (see below). Push.

### 3. Wait for the next discovery scan (or force a refresh)

The agent appears at `/ai-agents` within one discovery cycle. To see it
immediately, open **Catalog → Register existing component** in Backstage and
paste the GitLab raw URL of the `catalog-info.yaml`; the provider will also
pick it up on its next run regardless.

---

## How Backstage discovers agents (GitLab)

Discovery is **automatic** — you do not register each agent manually. The
Backstage backend runs the `@backstage/plugin-catalog-backend-module-gitlab`
module, which periodically scans configured GitLab groups for
`catalog-info.yaml` files.

### The flow

1. **You commit `catalog-info.yaml`** to the repo root on the default branch
   of a project in a configured GitLab group.

2. **Every 30 minutes** the GitLab catalog provider lists all projects in
   the configured groups (using the `GITLAB_TOKEN` from
   `integrations.gitlab`), and for each project fetches
   `catalog-info.yaml` from the default branch.

3. The provider parses the YAML. Because `catalog.rules` allows `Component`
   and the entity is `kind: Component` with `spec.type: ai-agent`, it is
   ingested into the catalog. The `gitlab.com/project-slug` annotation (or
   the provider's auto-detection) links the entity to its GitLab repo.

4. **The AI Agents frontend** calls
   `catalogApi.getEntities({ filter: { kind: 'Component', 'spec.type': 'ai-agent' } })`
   — a standard catalog query, no custom discovery. It returns every
   ingested agent entity, mapped by `entityToAgent()` into the card data.

5. **The backend status prober** resolves each agent's entity ref via the
   catalog service token, reads its `ai-agent.io/health` (or
   `endpoint`) annotation, and probes it for live status.

### Configuring discovery

Discovery is configured in `app-config.production.yaml` under
`catalog.providers.gitlab`. One provider per GitLab group:

```yaml
catalog:
  providers:
    gitlab:
      agents:                             # ← provider name (arbitrary)
        host: ${GITLAB_HOST}              # e.g. gitlab.example.com
        group: ${GITLAB_GROUP}            # e.g. "my-org-agents"
        entityFilename: catalog-info.yaml # ← the file it looks for in every repo
        projectPattern: '[\s\S]*'         # matches every project in the group
        schedule:
          frequency: { minutes: 30 }      # re-scan interval
          timeout: { minutes: 3 }
          initialDelay: { seconds: 60 }   # staggered across providers at boot
```

To cover a new group, add another block under `catalog.providers.gitlab`
with the group name and redeploy. The `projectPattern: '[\s\S]*'` already
matches every project, so no per-repo allowlist is needed.

### Checking discovery is working

- **Backstage UI**: Catalog → search for the agent name. If it appears in
  the catalog, the plugin will show it on `/ai-agents`.
- **Backend API** (auth required):
  `GET /api/catalog/entities?filter=kind=component,spec.type=ai-agent`
  returns all ingested agents.
- **Logs**: the catalog provider logs each scanned location and any parse
  errors at `info`/`warn` level under the `catalog` logger.

### Troubleshooting discovery

| Symptom | Cause / Fix |
|---|---|
| Agent doesn't appear in the catalog | The repo is not in a configured GitLab group, or `catalog-info.yaml` is not at the repo root on the default branch. Add the group to `catalog.providers.gitlab` and redeploy, or move the file. |
| Agent appears in Catalog but not on `/ai-agents` | `spec.type` is not exactly `ai-agent`. The filter is case-sensitive. |
| Status badge stays `unknown` | No `ai-agent.io/health` or `endpoint` annotation, or the URL is not in `ai-agents.probeAllowlist`, or the backend is disabled (`ai-agents.enabled: false`). |
| Status badge shows `down` with `fetch failed` | The health/endpoint URL is unreachable from the Backstage backend (network policy, DNS, or the agent is offline). Check the URL from inside the cluster. |
| Card shows no capabilities / billing | The corresponding annotations are missing or malformed. Capabilities use `label:category` pairs separated by commas or newlines. |

---

## Installation

### 1. Add the packages

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

### 2. Register the backend

`packages/backend/src/index.ts`:

```typescript
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
```

### 3. Register the frontend

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

### 4. Configuration

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

### 5. Entity-page card (optional, included automatically)

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

## API endpoints

All under `/api/ai-agents`, all Backstage-auth-authenticated:

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | `{ status: 'ok', enabled }` |
| `/statuses?refs=ref1,ref2` | GET | Live status for the given agent entity refs |
| `/status/:entityRef` | GET | Single agent status (used by the drawer's Refresh button) |
| `/invocations/:entityRef` | POST | Run the agent (Hire Agent). Body: `{ values: { field: value, ... } }`. Requires an invoker module; responds 501 otherwise |
| `/invocations/:entityRef` | GET | Invocation history for the agent (latest first, `?limit=` up to 100). Requires a database |
| `/reviews/:entityRef` | POST | Submit a review. Body: `{ rating: 0-5, comment? }`. Requires a database |
| `/reviews/:entityRef` | GET | Reviews + count + average rating (`?limit=` up to 100). Requires a database |

## Agent reviews

Users can rate an agent from 0 to 5 stars and leave an optional comment.
Reviews appear in the agent detail drawer and on the entity-page overview
card. The backend persists them in the plugin database (`agent_reviews`
table) and attributes them to the authenticated user.

Two star widgets ship in `StarRating`:

- `simple` — compact read-mostly stars (review list, average display).
- `fancy` — large interactive stars with hover animation and
  Poor→Excellent labels (the "Rate this agent" form).

The section hides itself when no database is configured (the endpoints
respond 501).

## Agent invocations

The backend core is transport-agnostic: it resolves the entity, fills the
prompt template with the submitted form values, persists the invocation
(`status`, `prompt`, `response`, `user`, `latency`) into the plugin database,
and delegates the actual call to a pluggable **invoker** registered through
the `ai-agents.invoker` extension point. Multiple provider modules can be
installed side by side — the entity's `ai-agent.io/runtime` annotation picks
which one handles a given agent (e.g. `bedrock-agentcore` vs `kagent`). If
an entity has no `runtime` annotation and exactly one provider module is
installed, that single invoker is used, so single-runtime setups don't need
the annotation.

The shipped AgentCore module invokes AWS Bedrock AgentCore runtimes using a
Keycloak client-credentials JWT:

```yaml
ai-agents:
  invocations:
    # enabled: true   # default
    agentCore:
      tokenUrl: https://auth.example.com/realms/my-realm/protocol/openid-connect/token
      clientId: backstage
      clientSecret: ${AI_AGENTS_AGENTCORE_CLIENT_SECRET}
      region: eu-west-1        # default; the /region annotation overrides it
      accountId: "123456789012" # only needed if runtime-handle has no full ARN
```

The shipped kagent module invokes agents hosted on a [kagent](https://kagent.dev)
runtime via its A2A endpoint (`/api/a2a/{namespace}/{agent-name}/`, JSON-RPC
`message/send`):

```yaml
ai-agents:
  invocations:
    kagent:
      baseUrl: http://kagent-controller.kagent.svc.cluster.local:8083
      namespace: kagent            # default; the /namespace annotation overrides it
      # authHeader: "Bearer ..."   # only if the controller sits behind auth
```

```yaml
# catalog-info.yaml for a kagent-hosted agent
metadata:
  annotations:
    ai-agent.io/runtime: kagent
    ai-agent.io/runtime-handle: helm-agent   # the kagent Agent's name
    ai-agent.io/namespace: kagent            # optional override of the module default
```

Then register whichever module(s) you need next to the plugin in your backend:

```ts
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend-module-agentcore'));
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend-module-kagent'));
```

Without a matching module the endpoint answers 501 and the frontend falls
back to the CLI-copy flow — other organisations can plug their own invoker
(Lambda, Azure ML, HTTP…) by implementing `AgentInvoker` from the backend
package and registering it under a runtime key of their choosing.

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

## Releasing

Both packages are published to npm via GitHub Actions on tag push. The
workflow lives in `.github/workflows/publish.yaml`.

### Cut a release

```bash
# 1. Bump the version in the package you're releasing
$EDITOR packages/plugin-ai-agents/package.json          # or plugin-ai-agents-backend
# e.g. "version": "0.2.0"

# 2. Commit and push to main
git commit -am "release: ai-agents vX.Y.Z"
git push origin main

# 3. Tag and push — the tag name determines which package is published
git tag ai-agents@X.Y.Z          # frontend → @acarmisc/backstage-plugin-ai-agents
git push origin ai-agents@X.Y.Z
# or, for the backend:
git tag ai-agents-backend@X.Y.Z
git push origin ai-agents-backend@X.Y.Z
```

### What the workflow does

1. Verifies the tag version matches the package's `package.json` version
   (prevents publishing the wrong version).
2. Installs with `--legacy-peer-deps`, builds, runs `npm publish --access
   public` using the `NPM_TOKEN` repo secret.
3. Auto-creates a GitHub Release with generated release notes.

### Tag conventions

| Tag pattern | Package published |
|---|---|
| `ai-agents@<version>` | `@acarmisc/backstage-plugin-ai-agents` |
| `ai-agents-backend@<version>` | `@acarmisc/backstage-plugin-ai-agents-backend` |

The version in the tag **must** match the `version` field in the
corresponding `package.json`, or the workflow fails fast.

## License

Apache-2.0