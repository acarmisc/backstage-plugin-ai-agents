# Contributing

Thanks for helping. This repository follows the conventions of the
[Backstage](https://github.com/backstage/backstage/blob/master/CONTRIBUTING.md)
and [community plugins](https://github.com/backstage/community-plugins/blob/main/CONTRIBUTING.md)
projects where they apply to a standalone plugin repository. The differences
are listed below.

By contributing you agree to the [Code of Conduct](CODE_OF_CONDUCT.md) and
license your work under [Apache-2.0](LICENSE). Report security issues as
described in [SECURITY.md](SECURITY.md), not in public issues.

## Layout

```
packages/
  plugin-ai-agents/                          frontend
  plugin-ai-agents-backend/                  backend plugin and extension point
  plugin-ai-agents-backend-module-agentcore/ AWS Bedrock AgentCore invoker
  plugin-ai-agents-backend-module-kagent/    kagent invoker
  plugin-ai-agents-backend-module-langfuse/  Langfuse telemetry provider
docs/                                        architecture and activity docs
```

## Setup

Node.js 22 or 24 and npm. The repository uses npm workspaces, not yarn.

```bash
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required: Backstage's MUI v4 theme (used by the host
app and `@backstage/core-components`) declares a React 17 peer dependency.

## Checks

Run these before opening a pull request. CI and the pre-push hook run the same.

```bash
npm run build           # first: modules type-check against the backend's dist
npm run lint
npm run typecheck
npm test
npm run prettier:check  # npm run prettier:fix to format
```

Tests use Node's test runner (`node --test`), not Jest. They sit next to the
code as `*.test.ts(x)`; DOM tests import `../setupTests` first.

To work on the frontend without a Backstage app:

```bash
cd packages/plugin-ai-agents && npm start
```

To try a change in a real app, build, then point the app's `package.json` at
the package with a `file:` dependency and reinstall. The app copies the
package, so reinstall after every rebuild.

## Code conventions

- [New frontend system](https://backstage.io/docs/frontend-system/) and
  [new backend system](https://backstage.io/docs/backend-system/) only.
- No `React.FC`; write components as functions with typed props
  ([ADR006](https://github.com/backstage/backstage/blob/master/docs/architecture-decisions/adr006-avoid-react-fc.md)).
- Formatting is Prettier with `@backstage/cli/config/prettier`.
- Every symbol exported from a package's `src/index.ts` needs a TSDoc release
  tag (`@public`), so API reports can be generated.
- Comments explain why, not what. Don't add comments that repeat the code.
- Catalog annotations are written by catalog authors: treat their values as
  untrusted input in the backend.
- Annotation keys live in `packages/plugin-ai-agents/src/types.ts`
  (`entityToAgent`) and are mirrored by the backend's `annotation()` helper.
  Change both, and the annotation table in the README, together.
- New runtimes and telemetry stores are new `-backend-module-*` packages using
  the extension point, not changes to the router.

## Commits and pull requests

- Sign off every commit
  ([DCO](https://github.com/backstage/backstage/blob/master/CONTRIBUTING.md#developer-certificate-of-origin)):
  `git commit -s`.
- Keep commits coherent and the diff limited to the change.
- Add an entry under a new version heading in the `CHANGELOG.md` of each
  package you change, written for the people who install the package: what
  changed for them, not which functions moved. Mark breaking changes with
  **BREAKING** and say what to do. Packages below 1.0 use a minor bump for
  breaking changes and a patch bump otherwise.
- Update the README of the package when its installation, configuration or
  behaviour changes.
- Include screenshots for UI changes.

### Using AI tools

The
[Backstage AI use policy](https://github.com/backstage/backstage/blob/master/CONTRIBUTING.md#ai-use-policy-and-guidelines)
applies: you must understand and have tested every change you submit, and be
able to explain it. Say in the pull request when a change is largely
AI-generated. Keep descriptions short and about why the change is needed.

## Releasing

Maintainers release from `main`; the publish workflow is the only way packages
reach npm.

1. Bump `version` in the package's `package.json` and date its changelog entry.
2. Merge to `main`.
3. Push a tag `<prefix>@<version>`, or run the **Publish to npm** workflow on
   `main` with the tag as input:

| Tag prefix                           | Package                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| `ai-agents`                          | `@acarmisc/backstage-plugin-ai-agents`                          |
| `ai-agents-backend`                  | `@acarmisc/backstage-plugin-ai-agents-backend`                  |
| `ai-agents-backend-module-agentcore` | `@acarmisc/backstage-plugin-ai-agents-backend-module-agentcore` |
| `ai-agents-backend-module-kagent`    | `@acarmisc/backstage-plugin-ai-agents-backend-module-kagent`    |
| `ai-agents-backend-module-langfuse`  | `@acarmisc/backstage-plugin-ai-agents-backend-module-langfuse`  |

The workflow fails if the tag version differs from `package.json`, builds every
workspace, publishes with npm provenance and creates the GitHub release.
Release the backend before modules that need its new version.
