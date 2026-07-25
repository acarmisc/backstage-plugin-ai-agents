# Contributing

Contributions are welcome. This plugin follows the same monorepo layout and
conventions as the sibling `@acarmisc/backstage-plugin-litellm-govai` and
`@acarmisc/plugin-litellm-chat` plugins.

## Repo layout

```
packages/
  plugin-ai-agents/          # frontend (@acarmisc/backstage-plugin-ai-agents)
  plugin-ai-agents-backend/  # backend  (@acarmisc/backstage-plugin-ai-agents-backend)
```

Both packages are built with esbuild (dual ESM/CJS) + `tsc` (declaration
files only), matching the Backstage plugin build convention used by the
sibling repos.

## Prerequisites

- Node.js 22 or 24
- npm (the repo uses npm workspaces, not yarn — the host Backstage monorepo
  owns the lockfile)

## Setup

```bash
git clone git@github.com:acarmisc/backstage-plugin-ai-agents.git
cd backstage-plugin-ai-agents
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required because Backstage's MUI v4 theme declares a
`react@^17` peer dep that conflicts with React 18. This mirrors the
behavior of `yarn install` in the host Backstage monorepo.

## Build

```bash
# both packages
npm run build --workspace @acarmisc/backstage-plugin-ai-agents
npm run build --workspace @acarmisc/backstage-plugin-ai-agents-backend
```

Each package's `build` script runs `node build.js` (esbuild) then `tsc -p
tsconfig.json` (emit declaration files only).

## Test

```bash
npm test --workspace @acarmisc/backstage-plugin-ai-agents
npm test --workspace @acarmisc/backstage-plugin-ai-agents-backend
```

Tests use Node's built-in test runner (`node --test`) — no Jest. Test files
live alongside source as `*.test.ts`.

## Dev mode (frontend only)

```bash
cd packages/plugin-ai-agents
npm start   # runs the Backstage dev server with sample agents
```

The dev server (`dev/index.tsx`) bundles six sample agents covering all
runtimes, billing models, lifecycles, and capability categories, served
through an in-memory stub `CatalogApi`. No live Backstage catalog or backend
is required.

## Iterating against a live Backstage app

For end-to-end testing against a real Backstage monorepo:

1. Build both packages.
2. In the host Backstage app's `packages/app/package.json` and
   `packages/backend/package.json`, add a `file:` dependency pointing at
   the built `dist`:
   ```json
   "@acarmisc/backstage-plugin-ai-agents": "file:/abs/path/to/backstage-plugin-ai-agents/packages/plugin-ai-agents"
   "@acarmisc/backstage-plugin-ai-agents-backend": "file:/abs/path/to/backstage-plugin-ai-agents/packages/plugin-ai-agents-backend"
   ```
3. `yarn install` in the host, then `yarn start`.
4. After changing plugin source, rebuild and re-sync the `dist` to the
   host's `node_modules` (or use `yarn install` to re-link), then reload the
   page. The webpack dev server may need a full restart to pick up changes
   to `node_modules` dist files.

## Coding conventions

- **No comments** unless explaining a non-obvious decision (match the
  sibling repos' style).
- **New Frontend System** (`@backstage/frontend-plugin-api`,
  `PageBlueprint`, `ApiBlueprint`, `EntityCardBlueprint`) — not the legacy
  `createPlugin`/`createApiRef`-only APIs.
- **New Backend System** (`@backstage/backend-plugin-api`,
  `createBackendPlugin`, `coreServices`) — not the legacy
  `createBackendModule`.
- **Types** in `types.ts`, **API client** in `api.ts`, **components** in
  `components/`, **hooks** in `hooks/`.
- Tests are co-located with source (`*.test.ts`), run via `node --test`.

## Releasing

See the [Releasing section in the README](./README.md#releasing). Cuts are
tag-driven: bump `package.json`, commit, tag
`ai-agents@<version>` (or `ai-agents-backend@<version>`), push the tag. The
GitHub Actions publish workflow handles npm publish + GitHub Release.

Do not run `npm publish` locally — the CI workflow is the source of truth
for releases.

## Pull requests

- Branch from `main`, rebase before pushing.
- Keep diffs minimal; don't reformat files you didn't change.
- CI must pass (build + test) before merge.

## License

By contributing you agree your contributions are licensed under the
Apache-2.0 license, same as the rest of the repo.