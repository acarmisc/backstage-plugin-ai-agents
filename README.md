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

Built with the Backstage **New Frontend System**
(`@backstage/frontend-plugin-api`, `PageBlueprint`, `ApiBlueprint`) and the
**New Backend System** (`@backstage/backend-plugin-api`).

---

## Catalog model

Agents are `Component` entities with `spec.type: ai-agent`. Agent-specific
fields live under the `ai-agent.acarmisc.org/*` annotation namespace, plus
`metadata.tags` and `metadata.links`. No custom `spec` schema is needed —
catalog processors tolerate unknown annotations, which keeps the model
portable across Backstage versions.

Only `spec.type: ai-agent` is required for an agent to appear on the
`/ai-agents` page. The `runtime` annotation defaults to `custom` if missing;
all other annotations are optional.

### Annotation reference

| Annotation | Required | Description |
|---|---|---|
| `ai-agent.acarmisc.org/runtime` | recommended | Runtime badge: `bedrock-agentcore`, `litellm`, `lambda`, `custom`, or any string. Defaults to `custom`. |
| `ai-agent.acarmisc.org/billing-model` | no | `per-invocation`, `per-token`, `subscription`, `free` (default `free`) |
| `ai-agent.acarmisc.org/capabilities` | no | Comma- or newline-separated chips, optionally `label:category` |
| `ai-agent.acarmisc.org/cost-per-1k` | no | USD per 1000 invocations (or per 1M tokens for `per-token`) |
| `ai-agent.acarmisc.org/budget` | no | Monthly spend cap |
| `ai-agent.acarmisc.org/avatar` | no | Image URL (falls back to initials on a tinted circle) |
| `ai-agent.acarmisc.org/version` | no | Version string in the card footer |
| `ai-agent.acarmisc.org/health` | no | URL the backend probes for live status (preferred) |
| `ai-agent.acarmisc.org/endpoint` | no | Invocation endpoint; probed if no `health` annotation |
| `ai-agent.acarmisc.org/runtime-handle` | no | ARN/handle shown in the detail drawer |
| `ai-agent.acarmisc.org/purpose` | no | Overrides `description` as the card's purpose text |
| `ai-agent.acarmisc.org/hire-schema` | no | JSON array declaring the "Hire Agent" form fields. See [Hiring an agent](#hiring-an-agent). |
| `ai-agent.acarmisc.org/prompt-template` | no | Prompt template with `{field_name}` placeholders matching `hire-schema` fields, used to build the AgentCore invocation preview. See [Hiring an agent](#hiring-an-agent). |
| `ai-agent.acarmisc.org/region` | no | AWS region for the AgentCore runtime, used in the Hire preview's CLI command (e.g. `eu-west-1`). |

Capability categories (used for chip color): `reasoning`, `retrieval`,
`tools`, `vision`, `voice`, `data`, `safety`. A capability without a
category renders as a default-colored chip.

---

## Hiring an agent

Agents that declare a `ai-agent.acarmisc.org/hire-schema` annotation show a
**Hire Agent** button on their card, detail drawer, and entity-page card.
Clicking it opens a form rendered from the schema; the form builds a **live
AgentCore invocation preview** (prompt + HTTP payload + AWS CLI command) that
updates as the user fills in the fields, and a **Copy CLI command** button to
run the invocation.

The `hire-schema` annotation value is a JSON array of field objects:

```yaml
ai-agent.acarmisc.org/hire-schema: '[{"name":"project","label":"GitLab project","type":"text","required":true,"help":"e.g. my-org/my-project"},{"name":"target","label":"MR IID","type":"text","required":true},{"name":"action","label":"Action","type":"select","required":true,"options":["dry-run","post"],"default":"dry-run"}]'
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

The `ai-agent.acarmisc.org/prompt-template` annotation is a string with
`{field_name}` placeholders matching the `hire-schema` fields. As the user
fills the form, the preview substitutes the placeholders with the field
values and builds:

1. **Prompt** — the filled template (or, when no `prompt-template` is set,
   a JSON object of all field values).
2. **Payload** — the `{"prompt": "..."}` JSON body for the AgentCore
   `/invocations` endpoint.
3. **AWS CLI command** — `aws bedrock-agentcore invoke-agent-runtime`,
   using `ai-agent.acarmisc.org/region` and
   `ai-agent.acarmisc.org/runtime-handle`. If either is missing, a warning
   chip is shown and the values are left as placeholders.

```yaml
ai-agent.acarmisc.org/prompt-template: "Revisiona la MR !{target} nel progetto '{project}'. Comportamento posting: {action}."
ai-agent.acarmisc.org/region: eu-west-1
ai-agent.acarmisc.org/runtime-handle: support-triage-runtime
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
    ai-agent.acarmisc.org/runtime: bedrock-agentcore      # bedrock-agentcore | litellm | lambda | custom
    ai-agent.acarmisc.org/billing-model: per-invocation   # per-invocation | per-token | subscription | free

    # --- optional but useful on the card ---
    ai-agent.acarmisc.org/capabilities: "tool-use:tools,rag:retrieval,reasoning:reasoning"
    ai-agent.acarmisc.org/cost-per-1k: "0.012"             # USD per 1k invocations (or per 1M tokens)
    ai-agent.acarmisc.org/version: "1.4.2"
    ai-agent.acarmisc.org/avatar: https://api.dicebear.com/7.x/bottts/svg?seed=triage

    # --- runtime handles (used by the backend status prober) ---
    ai-agent.acarmisc.org/runtime-handle: arn:aws:bedrock:us-east-1:123:agent/TXXX
    ai-agent.acarmisc.org/endpoint: https://abc.execute-api.us-east-1.amazonaws.com/prod
    ai-agent.acarmisc.org/health: https://abc.execute-api.us-east-1.amazonaws.com/prod/health
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
    - resource:default/bedrock-claude-sonnet
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
   catalog service token, reads its `ai-agent.acarmisc.org/health` (or
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
| Status badge stays `unknown` | No `ai-agent.acarmisc.org/health` or `endpoint` annotation, or the URL is not in `ai-agents.probeAllowlist`, or the backend is disabled (`ai-agents.enabled: false`). |
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
| `ai-agents.probeAllowlist` | string[] | `[]` | Allowed probe URL origin globs (empty = allow all http(s)) |

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

## Development

```bash
# Build both packages
yarn build

# Run tests (node --test)
yarn workspace @acarmisc/backstage-plugin-ai-agents test
yarn workspace @acarmisc/backstage-plugin-ai-agents-backend test

# Standalone frontend dev mode (renders sample agents, no catalog/backend)
cd packages/plugin-ai-agents && yarn start
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
- **Backend** is tiny and stateless: it resolves entity refs via the catalog
  service token, reads each agent's `health`/`endpoint` annotation, probes it
  with a short timeout, and maps the HTTP result to a status state. Results
  are cached in-memory for `statusCacheTtlMs` to survive bursts. The catalog
  remains the single source of truth for agent data — no new persistence.

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
3. Auto-creates a GitHub Release with generated release notes (tag pushes
   only; manual `workflow_dispatch` runs publish without creating a
   release).

### Tag conventions

| Tag pattern | Package published |
|---|---|
| `ai-agents@<version>` | `@acarmisc/backstage-plugin-ai-agents` |
| `ai-agents-backend@<version>` | `@acarmisc/backstage-plugin-ai-agents-backend` |

The version in the tag **must** match the `version` field in the
corresponding `package.json`, or the workflow fails fast.

### Manual dispatch

To republish the current `package.json` version without cutting a tag (e.g.
after a failed publish), use the GitHub Actions "Run workflow" button on the
Publish workflow page, or:

```bash
gh workflow run publish.yaml \
  -f package=ai-agents \
  -f ref=<branch-or-sha>
```

## License

Apache-2.0