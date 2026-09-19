# AGENTS.md

Operational notes for OpenCode sessions working in this repo. Read the
top-level `README.md` first for user-facing setup; this file records the
non-obvious things an agent would otherwise miss or get wrong. When docs and
config disagree, trust the scripts/config.

## Mission

A Backstage plugin monorepo that manages AI Agents stored as catalog
`Component` entities (`spec.type: ai-agent`), surfaced through a dedicated
card view at `/ai-agents`, entity-page cards, and a pluggable backend that
probes live status and can invoke agents through runtime-specific modules.

## Stack & layout

Four npm workspaces (`packages/*`):

- `plugin-ai-agents` — frontend (`@acarmisc/backstage-plugin-ai-agents`).
- `plugin-ai-agents-backend` — backend core, status probing + persistence
  (`...-backend`).
- `plugin-ai-agents-backend-module-agentcore` — AWS Bedrock AgentCore
  invoker module.
- `plugin-ai-agents-backend-module-kagent` — kagent invoker module.

Backstage 1.53+ (New Frontend System + New Backend System). Node 22/24, npm
workspaces. esbuild dual ESM/CJS (frontend) / CJS (backend) + `tsc` for
`.d.ts`. Tests via `node --test` (no Jest). Each package has its own
`CHANGELOG.md`.

## Commands

```bash
npm install --legacy-peer-deps   # required: MUI v4 theme peer-dep conflicts on npm@7+
npm run lint                     # root: runs every workspace
npm run build                    # root: build every workspace (needed before typecheck)
npm run typecheck                # root
npm test                         # root
```

Per-workspace (all accept `--workspace <name>`):

```bash
npm run build --workspace @acarmisc/backstage-plugin-ai-agents
npm test  --workspace @acarmisc/backstage-plugin-ai-agents-backend
cd packages/plugin-ai-agents && npm start   # standalone dev server, 6 sample agents, no catalog/backend
```

- **Order matters: build before typecheck/test.** The backend modules and
  tests resolve `@acarmisc/backstage-plugin-ai-agents-backend` through its
  built `dist/*.d.ts`. CI runs `lint → build → typecheck → test`; a typecheck
  or test run without a prior build fails on unresolved workspace deps.
- Test scripts compile first (`tsc -p tsconfig.test.json`), then run
  `node --test --experimental-test-coverage`. Coverage is printed by the same
  `npm test` — there is no separate coverage command.
- `.husky/pre-push` runs `lint`, then `typecheck`, then `test` (and a
  non-blocking `snyk test` if the CLI is installed). Pushes fail unless all
  three pass.
- The root `npm run build` is `npm run build --workspaces` — it works, but
  needs a root `node_modules` (run `npm install --legacy-peer-deps` first).
  Do **not** reach for yarn: only `package-lock.json` is tracked and
  `yarn.lock` is gitignored.

## Non-obvious wiring

- **`@backstage/plugin-catalog-react` must stay `^3.0.0`.** v1.x's
  `EntityCardBlueprint` (`plugin-catalog-react/alpha`) bundles a nested
  `frontend-plugin-api@0.13.4` that conflicts with the plugin's `^0.17.0`,
  producing a TS2742 "inferred type cannot be named" error. Don't downgrade.
  `plugin.tsx` annotates the plugin explicitly (`: FrontendPlugin`) to guard
  the same class of error.
- **`catalogApiRef` comes from `@backstage/plugin-catalog-react`** (main);
  `EntityCardBlueprint` from `@backstage/plugin-catalog-react/alpha`. Both are
  used in `plugin.tsx`.
- **The backend is transport-agnostic.** `plugin-ai-agents-backend` exposes
  the `ai-agents.invoker` extension point (`registerInvoker(runtime, invoker)`).
  Modules register invokers keyed by runtime (`bedrock-agentcore`, `kagent`).
  `POST /invocations/:entityRef` picks the invoker matching the entity's
  `ai-agent.io/runtime` annotation; if the entity has no `runtime` and exactly
  one module is installed, that one is used. No match → 501. Add a new runtime
  by implementing `AgentInvoker` and adding a `-backend-module-*` package, not
  by editing the router.
- **`post` is always explicit and defaults to false (dry-run).** The CES
  agents' entrypoint (`deploy/app.py`) reads `post` and defaults an *omitted*
  value to true, so never drop the field — `buildInvocationArgs` in
  `invocation.ts` is the single place that derives it (`action: post` → true).
  The UI's "Confirm and publish" is the only caller that passes `post: true`.
- **Threads, not per-call sessions.** `makeThreadId` mints a conversation id;
  `normalizeSessionId` derives the ≥33-char AgentCore session deterministically
  from it. The agentcore invoker sends it as
  `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id`, kagent as the A2A `contextId`.
  Never generate a random session id per call — that breaks multi-turn memory.
- **Spend is read from LiteLLM via a govai dependency.**
  `plugin-ai-agents-backend` imports `LiteLLMClient`/`normalizeRequestTags`
  from `@acarmisc/backstage-plugin-litellm-backend` (^0.14.0) and reads the
  `litellm.baseUrl`/`masterKey` config. No LiteLLM config → `/spend` answers
  501 and `AgentSpend` hides. Tags are the join key: `session:<threadId>`,
  `backstage-entity:<ref>`, `invoked-by:<user>`, `channel:backstage`.
- **Persistence is optional.** With no `database` service the plugin degrades
  to status-only mode; `/invocations` and `/reviews` GET/POST return 501.
  Migrations auto-run from `packages/plugin-ai-agents-backend/migrations`
  (tables `invocations`, `agent_reviews`) on `InvocationStore`/`ReviewStore`
  creation. `files` in package.json ships `migrations`.
- **Permission checks:** `ai-agent.invoke` (update) on POST
  `/invocations/:ref`; `ai-agent.history.read` (read) on GET
  `/invocations/:ref`. Both defined in `permissions.ts`.
- **Status probing is deny-by-default.** `probeAllowlist` empty means no
  probing happens; the backend only fetches origins on the allowlist. Probe
  URL is the `health` annotation, falling back to `endpoint`. Results cached
  in-memory for `statusCacheTtlMs`.
- **The `AgentCore` CLI preview is runtime-gated.** `HireAgentDialog` only
  renders the `aws bedrock-agentcore invoke-agent-runtime` command when
  `agent.runtime.runtime === 'bedrock-agentcore'`; other runtimes would be
  misleading. With `onInvoke` wired it also shows a **Run agent** button
  (real backend call); without it, only Copy CLI / preview.
- **Legacy annotation namespace is still read.** Both frontend and backend
  fall back from `ai-agent.io/*` to `ai-agent.acarmisc.org/*`. New/updated
  entities use `ai-agent.io`. Keep the fallback when touching
  `entityToAgent` or `invocation.ts`.
- **Frontend status fetch uses a relative path** (`/api/ai-agents/...`). In
  the dev setup (app :3000, backend :7007) there's no dev proxy, so the fetch
  hits the SPA and returns HTML — cards show `unknown` status. Same behavior
  as the sibling litellm/litellm-chat plugins and correct in production
  (same origin behind ingress). Not a bug; don't "fix" it with
  `discoveryApi` unless you also fix the siblings.
- **The `AgentDetailDrawer` uses `@mui/material` v5 `Drawer`** while the host
  app pins `@material-ui/core` v4; both coexist. The v5 Drawer renders
  `.MuiDrawer-paper` but may not expose `role="dialog"` — assert via DOM text
  search, not class selector alone.
- **The `@material-ui/icons/SmartToy` icon does not exist in v4.** Host
  sidebars use v4 `@material-ui/icons`; use `Extension` there. Inside the
  plugin source `@mui/icons-material` (v5) is fine (and `SmartToy` is used
  for the page icon).

## Catalog model (don't change without coordination)

Agents are `Component` entities with `spec.type: ai-agent` (exact,
case-sensitive — the filter key). Agent fields live in
`metadata.annotations['ai-agent.io/*']`, plus `metadata.tags` and
`metadata.links`; no custom `spec` schema. Only `spec.type` is required to
appear on `/ai-agents`; `runtime` defaults to `custom`, everything else is
optional.

`packages/plugin-ai-agents/src/types.ts` → `entityToAgent()` is the canonical
mapping, mirrored in the backend's `annotation()` helper. Any annotation-key
change must update both plus the README annotation-reference table.

## Entrypoints (fresh-agent map)

- `packages/plugin-ai-agents/src/plugin.tsx` — plugin + `PageBlueprint` +
  `ApiBlueprint` + two `EntityCardBlueprint`s (overview, invocations).
- `packages/plugin-ai-agents/src/types.ts` — `entityToAgent` mapping.
- `packages/plugin-ai-agents/src/api.ts` — `AiAgentsApi` (catalog + status +
  invocations + reviews).
- `packages/plugin-ai-agents/src/components/AgentsPage.tsx` — `/ai-agents`.
- `packages/plugin-ai-agents/src/components/HireAgentDialog.tsx` — hire form,
  invocation preview, run action.
- `packages/plugin-ai-agents-backend/src/router.ts` — all `/api/ai-agents`
  routes; `extensionPoint.ts` — the invoker registration point.
- `packages/plugin-ai-agents-backend/src/invocation.ts` — prompt/args/tags/
  session derivation (the dry-run `post` default lives here).
- `packages/plugin-ai-agents-backend/src/spend.ts` — LiteLLM spend reader and
  per-tag aggregation.
- `packages/plugin-ai-agents-backend/src/store.ts` — `InvocationStore` /
  `ReviewStore` + migrations.
- `packages/plugin-ai-agents-backend-module-*/src/invoker.ts` — the two
  shipped transports.
- `README.md` — user-facing docs; `CONTRIBUTING.md` — contributor setup.

## Live host iteration

The plugin is wired into a separate host Backstage app (Backstage 1.53,
deployed to GKE). The host consumes the npm packages; local dev uses `file:`
deps. After changing plugin source: rebuild, `cp` the `dist/*` into the host's
`node_modules/@acarmisc/.../dist/`, and restart the host webpack dev server
(it caches `node_modules` dist and may need a full restart). The host's own
`AGENTS.md` documents its wiring — read it before touching host files. Revert
any temporary host changes before committing the host.

## Releasing

Tag-driven via `.github/workflows/publish.yaml`. Tag prefix selects the
package; tag version must equal that package's `package.json` version.

```bash
# bump the package.json version
git commit -am "release: ai-agents vX.Y.Z"
git push origin main
git tag ai-agents@X.Y.Z            # or ai-agents-backend@..., -module-agentcore@..., -module-kagent@...
git push origin ai-agents@X.Y.Z
```

CI verifies the version match, builds all workspaces in dependency order,
publishes with provenance, and creates a GitHub Release. `NPM_TOKEN` repo
secret is required. Do not run `npm publish` locally — CI is the source of
truth.

## Common traps

- **Don't commit `dist/` or `node_modules/`** — both gitignored; `prepack`
  rebuilds `dist` before publish.
- **`file:` deps in the host are copies, not symlinks** — re-sync `dist` after
  every rebuild (or reinstall) or the host runs stale code.
- **`--legacy-peer-deps` is mandatory** on every install (local and CI).
- **Tests use Node's runner, not Jest** — co-located `*.test.ts(x)`, `node --test`.
  DOM tests import `../setupTests` first (jsdom globals for MUI Portals).
