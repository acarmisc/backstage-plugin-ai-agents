# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **BREAKING:** the annotation namespace moved from `ai-agent.acarmisc.org/*`
  to `ai-agent.io/*`. Existing entities keep working unchanged — annotation
  reads try the new prefix first and fall back to the old one — but new or
  updated `catalog-info.yaml` files should use the new prefix.
- `react` is no longer declared as a runtime `dependency` (it was already a
  `peerDependency`, which is the correct place for it — having both risked a
  duplicate React instance and the "invalid hook call" crash).

### Added

- `isSafeUrl()` guard, applied before rendering any annotation-sourced URL
  (card links, entity-overview links/endpoint, avatar image) as `href`/`src`,
  so a `javascript:` URL in a catalog annotation can't reach the DOM.
- `start` script (`backstage-cli package start`) so the documented
  `npm start` standalone dev server actually runs.
- `engines.node: ">=20"`.

### Fixed

- The status-polling effect in `AgentsPage` depended on `refs.length`, so
  swapping one agent for another without changing the count never reset the
  polling interval. Now keys off `refs.join(',')`, matching the initial-fetch
  effect.
- `HireAgentDialog`'s CLI-command preview generated its own placeholder
  session id, which never matched the id the backend actually assigns on a
  real run — the preview block is now labeled as a preview instead of
  implying it's authoritative.
- `buildCliCommand()` interpolated the JSON payload into a single-quoted
  shell argument with no escaping; a prompt containing a quote broke the
  command. Added proper POSIX single-quote escaping.
- `@types/react-dom` was pinned to `^19.2.4` while every other React
  dependency targets 18 — downgraded to `^18.0.0`.

## [0.8.0] - 2026-08-24

- Stopped shipping `react-router-dom` as a direct dependency.

## [0.7.0] - 2026-08-24

- Fixed "Open in catalog" URL segment order under the new frontend system.

## [0.6.1] - 2026-08-24

- Fixed "Open in catalog" URL segment order under the new frontend system.
- Quality and security gates added ahead of plugin distribution.

## [0.6.0] - 2026-08-23

- Added 0-5 star reviews with comments for AI agents.

## [0.5.0] - 2026-08-23

- Added invocation history to the detail drawer and an entity-page
  invocations card.

## [0.4.0] - 2026-08-23

- Added real agent invocations via a pluggable invoker + the AgentCore
  module.
- Fixed a `TS2742` error on `aiAgentsPlugin`'s type under hoisted installs by
  annotating it explicitly.

## [0.3.1] - 2026-07-30

- Added `repository` and `homepage` fields to `package.json`.

## [0.3.0] - 2026-07-29

- Added the Hire Agent CTA with a live AgentCore invocation preview.
- Added an external-link icon to outbound link chips on the card.
- Fixed drawer width and chip label styles being bypassed by MUI
  class-name prefixing.
- UX polish: inline billing chip, labeled link chips, version N/A fallback.

## [0.2.0] - 2026-07-25

- Added the entity-page Agent Overview card, plus docs.

## [0.1.1] - 2026-07-25

- Initial release: AI Agents Backstage plugin (frontend + backend).

[Unreleased]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.8.0...HEAD
[0.8.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.7.0...ai-agents@0.8.0
[0.7.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.6.1...ai-agents@0.7.0
[0.6.1]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.6.0...ai-agents@0.6.1
[0.6.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.5.0...ai-agents@0.6.0
[0.5.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.4.0...ai-agents@0.5.0
[0.4.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.3.1...ai-agents@0.4.0
[0.3.1]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.3.0...ai-agents@0.3.1
[0.3.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.2.0...ai-agents@0.3.0
[0.2.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.1.1...ai-agents@0.2.0
[0.1.1]: https://github.com/acarmisc/backstage-plugin-ai-agents/releases/tag/ai-agents@0.1.1
