# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents-backend-module-kagent`
are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- The published package no longer contains compiled tests, nor the
  unbundled per-file JavaScript `tsc` emitted next to the bundle (the entry
  point is the self-contained `dist/index.cjs.js`).

## [0.3.2] - 2026-10-03

### Fixed

- The module's config schema was never loaded because `package.json` had no
  `configSchema`.

### Changed

- `KagentConfig` is exported.
- New README for the npm page.

## [0.3.1] - 2026-10-03

### Security

- `authHeader` is only sent to the configured `baseUrl` origin, never to a
  per-agent `endpoint` annotation pointing elsewhere.

## [0.3.0] - 2026-10-01

### Changed

- Depend on `@acarmisc/backstage-plugin-ai-agents-backend@^0.9.0` (was
  `^0.7.0`, which under 0.x semver excluded 0.8/0.9 and made hosts on the
  current backend install a second, nested copy of it).

## [0.2.0] - 2026-09-19

### Changed

- The A2A `contextId` now carries the conversation thread id, so multi-turn
  context is preserved across invocations of the same thread.
- Requires `@acarmisc/backstage-plugin-ai-agents-backend` `^0.7.0` for the
  extended `AgentInvocationRequest` (`threadId`, `args`, `tags`).

## [0.1.0] - 2026-08-25

- Initial release: [kagent](https://kagent.dev) invocation module, calling
  the kagent controller's A2A endpoint
  (`/api/a2a/{namespace}/{agent-name}/`, JSON-RPC `message/send`) using the
  entity's `ai-agent.io/namespace` and `/runtime-handle` annotations.
  Requires `@acarmisc/backstage-plugin-ai-agents-backend` `^0.6.0` for the
  multi-runtime invoker extension point.
- Verified end-to-end against a live kagent controller (v0.9.12) on GKE: the
  A2A endpoint URL shape, JSON-RPC `message/send` request, and the Task
  `artifacts[].parts[].text` response shape all matched what this module
  sends/parses, including a real multi-turn tool-call exchange with a
  `helm-agent`.

[0.1.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/releases/tag/ai-agents-backend-module-kagent@0.1.0
