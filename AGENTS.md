# AGENTS.md

Operational notes for OpenCode sessions working in this repo. Read the
top-level `README.md` first for user-facing setup; this file records the
non-obvious things an agent would otherwise miss or get wrong.

## Mission

Build and maintain a Backstage plugin that manages AI Agents stored as
catalog `Component` entities (`spec.type: ai-agent`), surfaced through a
dedicated card-based view at `/ai-agents` and an entity-page card.

## Stack at a glance

- Backstage 1.53+ (New Frontend System + New Backend System).
- Node.js 22/24, npm workspaces (not yarn — the host Backstage monorepo owns
  the lockfile; both `yarn.lock` and `package-lock.json` are gitignored).
- esbuild dual ESM/CJS build + `tsc` for `.d.ts` (standard Backstage plugin pattern).
- Tests via `node --test` (no Jest).
- npm publish via GitHub Actions on tag push
  (`.github/workflows/publish.yaml`).

## Commands

```bash
npm install --legacy-peer-deps          # --legacy-peer-deps is required (MUI v4 peer dep)
npm run build --workspace @acarmisc/backstage-plugin-ai-agents
npm run build --workspace @acarmisc/backstage-plugin-ai-agents-backend
npm test --workspace @acarmisc/backstage-plugin-ai-agents
npm test --workspace @acarmisc/backstage-plugin-ai-agents-backend
cd packages/plugin-ai-agents && npm start   # standalone dev server with sample agents
```

`npm run build` from the repo root uses `yarn workspaces` which may fail
with a "node_modules state file" error under Yarn 4 — always build
individual workspaces with `npm run build --workspace <name>`.

## Non-obvious wiring

- **`@backstage/plugin-catalog-react` must be `^3.0.0`** (not `^1.15.0`).
  The `EntityCardBlueprint` from `plugin-catalog-react/alpha` bundles a
  nested `@backstage/frontend-plugin-api@0.13.4` in v1.x, which conflicts
  with the plugin's `^0.17.0` and produces a TS2742 "inferred type cannot be
  named" portability error. v3.x shares the host's `frontend-plugin-api`
  and avoids the nested copy. Don't downgrade this dep.

- **The `AgentOverviewCard` is registered via `EntityCardBlueprint`** in
  `plugin.tsx`, filtered to `spec.type: ai-agent` so it only renders on
  agent entity pages. It's part of the plugin's `extensions` array — no
  host wiring needed beyond registering the plugin. The host can override
  its placement via `app.extensions['entity-card:ai-agents/overview']` in
  `app-config.yaml`.

- **The "Hire Agent" CTA is gated on `hireSchema`.** The
  `ai-agent.io/hire-schema` annotation (a JSON array of
  `HireField`) is parsed in `entityToAgent()` into `AiAgent.hireSchema`.
  The CTA button is rendered on `AgentCard`, `AgentDetailDrawer`, and
  `AgentOverviewCard` only when the schema is present and non-empty.
  Submitting the form (`HireAgentDialog`) shows a fake "Request sent to
  staff" message — there is no persistence or backend call. If a real
  persistence path is needed later, note that Backstage's catalog REST
  has no browser-side "create entity"; it needs a server-side helper
  that writes YAML to a fetchable location and registers that URL.
  The `HireAgentDialog` builds a **live AgentCore invocation preview**:
  the `ai-agent.io/prompt-template` annotation (with `{field}`
  placeholders matching the hire-schema) is substituted with the form
  values to produce the prompt, the `{"prompt": "..."}` HTTP payload,
  and the `aws bedrock-agentcore invoke-agent-runtime` CLI command (using
  `ai-agent.io/region` + `runtime-handle`). A **Copy CLI
  command** button is the primary action. No persistence or backend call.

- **The `AgentDetailDrawer` uses `@mui/material` v5 `Drawer`** (the plugin's
  own dep). The host Backstage app pins `@material-ui/core` v4. Both coexist
  as separate packages. The v5 `Drawer` renders `.MuiDrawer-paper` but the
  a11y snapshot may not label it as `role="dialog"` — verify via DOM text
  search, not by class selector alone.

- **Frontend status fetch uses a relative path** (`/api/ai-agents/...`). In
  the dev setup (app on :3000, backend on :7007) there's no dev proxy, so
  the fetch hits the SPA and returns HTML — cards show `unknown` status.
  This is the same behavior as the sibling litellm/litellm-chat plugins and
  works correctly in production (same origin behind the ingress). Not a
  bug; don't try to "fix" it by adding `discoveryApi` resolution unless you
  also fix the sibling plugins.

- **`catalogApiRef` comes from `@backstage/plugin-catalog-react`** (main,
  not `/alpha`). The `EntityCardBlueprint` comes from
  `@backstage/plugin-catalog-react/alpha`. Both are used in `plugin.tsx`.

## Catalog model (don't change without coordination)

Agents are `Component` entities with:
- `spec.type: ai-agent` (exact string, case-sensitive — the filter key)
- `metadata.annotations['ai-agent.io/*']` for agent-specific fields

The annotation namespace is `ai-agent.io`. Only `spec.type` is
required for an agent to appear on `/ai-agents`; everything else is
optional with sensible defaults.

See `src/types.ts` → `entityToAgent()` for the canonical mapping. Any
change to the annotation keys must be reflected there and in the README's
annotation reference table.

## Live environment

The plugin is wired into a host Backstage app on a local checkout
(Backstage 1.53, deployed to GKE at a staging URL). The host consumes the
npm package (`^0.1.0`); local dev uses `file:` deps.

When iterating against the host:
1. Build the plugin: `npm run build --workspace @acarmisc/backstage-plugin-ai-agents`.
2. Sync the dist: `cp packages/plugin-ai-agents/dist/* <path-to-host-checkout>/node_modules/@acarmisc/backstage-plugin-ai-agents/dist/`.
3. Restart the host dev server (webpack dev server caches `node_modules`
   dist; a restart forces recompilation).
4. Revert any temporary host changes (guest provider, etc.) before
   committing the host.

The host's `AGENTS.md` documents its own non-obvious wiring (sidebar,
sign-in, config layering) — read it before changing host files.

## Releasing

Tag-driven, via `.github/workflows/publish.yaml`:

```bash
# bump package.json version
git commit -am "release: ai-agents vX.Y.Z"
git push origin main
git tag ai-agents@X.Y.Z            # or ai-agents-backend@X.Y.Z
git push origin ai-agents@X.Y.Z
```

The workflow verifies tag version == package.json version, builds,
publishes to npm, and auto-creates a GitHub Release. The `NPM_TOKEN` repo
secret is required (already set).

Do not run `npm publish` locally — CI is the source of truth.

## Common traps

- **Don't commit `yarn.lock` or `package-lock.json`** — both are gitignored.
  The host Backstage monorepo owns the lockfile; this repo is consumed as
  npm packages.
- **Don't commit `dist/` or `node_modules/`** — both gitignored. The npm
  package's `prepack` script rebuilds `dist` before publish.
- **`npm run build` from the root may fail** under Yarn 4 install-state
  quirks — always use `npm run build --workspace <name>`.
- **The `@material-ui/icons/SmartToy` icon does not exist in v4** — the host
  pins `@material-ui/icons` (v4), not `@mui/icons-material`. Inside the
  plugin source `@mui/icons-material` (v5) is fine, but the host's sidebar
  uses v4. Use `Extension` or another v4 icon for sidebar entries.
- **The frontend `file:` dep must be re-synced after every rebuild** — the
  host's `node_modules/@acarmisc/backstage-plugin-ai-agents/dist/` is a
  copy, not a symlink. After changing plugin source, rebuild and `cp` the
  dist, or `yarn install` to re-link.

## Useful entrypoints (for a fresh agent)

- `packages/plugin-ai-agents/src/plugin.tsx` — plugin + `PageBlueprint` +
  `EntityCardBlueprint` registration.
- `packages/plugin-ai-agents/src/types.ts` — `entityToAgent` mapping (the
  canonical annotation → typed shape).
- `packages/plugin-ai-agents/src/api.ts` — `AiAgentsApi` (catalog + status).
- `packages/plugin-ai-agents/src/components/AgentsPage.tsx` — the `/ai-agents` page.
- `packages/plugin-ai-agents/src/components/AgentOverviewCard.tsx` — the
  entity-page card.
- `packages/plugin-ai-agents-backend/src/router.ts` — `/statuses` + `/status/:ref`.
- `README.md` — user-facing docs (install, catalog model, discovery,
  releasing).
- `CONTRIBUTING.md` — contributor setup.