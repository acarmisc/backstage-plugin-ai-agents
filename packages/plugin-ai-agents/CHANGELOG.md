# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.17.0] - 2026-10-07

### Changed

- The whole UI now uses Backstage's own design system, `@backstage/ui` (BUI),
  instead of Material UI v5, so it looks native in the New Frontend System
  shell: cards, filters, dialogs, accordions, tables, tags, badges, tooltips
  and form fields are BUI components styled only with `--bui-*` tokens (no
  hard-coded colors; light/dark and custom themes follow the host). Where BUI
  has no widget the plugin ships a small primitive (`StatusDot`, `Meter`,
  `Hint`, `CodeBlock`, `EmptyState`). Icons come from `@remixicon/react`.
- The agent detail panel is a BUI dialog with accordion sections (it was an
  MUI drawer).
- The `/ai-agents` page is split into `Agents` and `Activity` sub-pages shown
  as tabs in the app header. **URL change:** `/ai-agents?tab=activity` is now
  `/ai-agents/activity`; `/ai-agents` redirects to `/ai-agents/agents`.
- Capability badges are neutral (one color) with a category icon, instead of
  a rainbow of chips.
- The standalone dev app (`npm start`) runs on the New Frontend System; the
  previous one is `npm run start:legacy`.

### Added

- `AgentsGallery` (exported): the agent grid with filters, detail dialog and
  Hire flow, for apps that compose their own page. Takes an optional
  `activityHref`.

### Removed

- `@mui/material`, `@mui/icons-material` and `@emotion/*` dependencies. Apps
  need `@backstage/ui` styles loaded, which the New Frontend System app
  shell already does.

## [0.16.5] - 2026-10-04

### Fixed

- The published package no longer contains compiled tests, test typings or
  test fixtures.

## [0.16.4] - 2026-10-04

### Fixed

- The Activity page shows agent avatars in the rail and in the selected
  agent's header (it always showed initials). Needs
  `@acarmisc/backstage-plugin-ai-agents-backend` 0.9.7+ (`avatarUrl` in
  `GET /activity`); older backends keep the initials.
- `useAvatarSrc` shares one in-flight proxy request per agent, so avatars
  mounted at the same time (rail and header, cards) no longer fetch twice.
- The test script now runs the tests in nested folders
  (`components/activity`), which the shell's `**` glob silently skipped.

## [0.16.3] - 2026-10-04

### Fixed

- Proxied avatars render in apps served with Backstage's default CSP
  (`img-src 'self' data:`). `useAvatarSrc` now turns the proxied image into a
  `data:` URL instead of a `blob:` object URL, which that CSP blocks, so
  private-repo avatars no longer fall back to initials in production.
- `data:image/bmp` avatars are accepted, matching what the backend proxy
  serves.

## [0.16.2] - 2026-10-03

### Changed

- Components are plain functions instead of `React.FC` (Backstage ADR006).
- `AgentCardProps`, `HireAgentDialogProps`, `StarRatingProps`,
  `AgentWorkspacePanelProps`, `RunState`, `InvocationResult`, `SpendSummary`
  and `InvocationRecord` are exported, so every public signature can be typed.
- `@types/react` is an optional peer dependency.
- New README for the npm page, with screenshots.

### Fixed

- `npm start` (the standalone dev app) failed with
  `plugin.getId is not a function`.

## [0.16.1] - 2026-10-03

### Removed

- Unused `RunTimeline` component (superseded by the Activity workspace),
  unused formatting helpers and the unused `@backstage/theme` dependency.

## [0.16.0] - 2026-10-03

### Changed

- **Activity tab redesigned as a master-detail workspace**: agents in a stable
  left rail (nothing moves when you click), the selected agent in the body.
  Selection lives in the URL (`?tab=activity&agent=<id>&run=<id>&hours=24`), so
  views are shareable.
- Concurrent executions are first class: a "Running now" strip with one card per
  run in progress (live elapsed time, current step), a per-agent "N running"
  chip in the rail, and a fleet overview of every run in progress.
- Per-agent KPIs (runs, success rate, p50/p95 duration), runs-per-hour chart,
  tool usage with error rates and latency, recent runs with filters, and a run
  detail with a **waterfall** of tool calls (parallel calls visible) and the
  peak parallelism.

### Added

- **"Activity" tab on `ai-agent` catalog entity pages** (same workspace panel,
  scoped to the agent; shows how to enable it when `telemetry-id` is missing).
- The agent detail drawer is compact by default: only the header and primary
  actions are visible, every other section is a collapsed accordion whose data
  is fetched on first expansion. It links to the agent's activity.

### Fixed

- `usePolling` never refetches in a loop and keeps polling after a manual refresh.

## [0.15.0] - 2026-10-03

### Added

- **Activity** tab on the agents page: a live fleet board with one card per
  agent (status, what it is doing now, last verdict, run-duration sparkline,
  expandable run timeline). Polls every 5 s, pauses while the tab is hidden
  and backs off after errors. Requires the backend `GET /activity` route and a
  telemetry module (e.g. `-backend-module-langfuse`); agents need the
  `ai-agent.io/telemetry-id` annotation.
- Run timeline in the agent detail drawer for agents with `telemetry-id`.

## [0.14.1] - 2026-10-01

### Fixed

- `useAvatarSrc` no longer returns the upstream `http(s)` avatar URL while the
  backend proxy request is in flight, so the browser stops requesting private
  GitLab images directly (which always failed). The direct URL is used only
  after the proxy has failed.

## [0.13.0] - 2026-09-25

### Added

- `useAvatarSrc` hook: resolves `http(s)` avatars through the backend proxy
  (shared per-agent blob-URL cache for the page session, direct-URL
  fallback), now used by `AgentCard`, `AgentOverviewCard` and
  `AgentDetailDrawer`.

### Fixed

- `isSafeUrl` accepts `blob:` URLs. Without this, avatars fetched through
  the backend proxy (`useAvatarSrc` mints a `blob:` object URL) were rejected
  by `AgentAvatar`'s guard and never rendered — the proxy path was dead.
- `useAvatarSrc` syncs its state with the blob cache when the entity ref
  changes, so a reused card no longer flashes the previous agent's avatar
  while the new one loads.
- `AgentOverviewCard` and `AgentDetailDrawer` now resolve avatars through
  `useAvatarSrc` like `AgentCard` does, so private-repo avatars render via
  the proxy everywhere instead of only on cards.

## [0.12.0] - 2026-09-25

### Added

- `ai-agent.io/avatar` now accepts `data:image/*` URIs (e.g. a base64 avatar
  embedded directly in the annotation) and app-relative paths
  (`/img/agents/x.png`), so agents on private repositories can ship avatars
  without exposing them or opening the app's CSP.

### Changed

- `AgentAvatar` no longer re-requests an avatar URL that failed to load: dead
  URLs (e.g. images behind private-repo auth) are remembered for the page
  session and the initials fallback shows immediately on later renders.
- Initials render underneath the image at all times, covering the loading
  state and giving transparent-background SVG avatars a visible backdrop in
  dark themes. Images load lazily with `referrer-policy: no-referrer`.
- Initials now split camelCase names (`kbSearchAgent` → "KA" instead of
  "KB") and no longer crash on empty names.

## [0.11.0] - 2026-09-19

### Added

- The Hire dialog is now a **conversation**: the first run shows in the chat
  as a dry-run, subsequent messages continue the same thread, and a
  "Confirm and publish" step re-runs with writes enabled once the user
  approves the result. A follow-up composer keeps the agent's session.
- `AgentSpend` shows LiteLLM cost (USD, tokens, per-model breakdown) for the
  agent and, when scoped, for one conversation. Hidden when LiteLLM is not
  configured.
- `InvocationHistory` labels each run `dry-run` or `published`.

### Changed

- `AiAgentsApi.invokeAgent` accepts `{ threadId, post }`, returns the
  `threadId`/`post` from the backend, and `HireAgentDialog.onInvoke`
  forwards them. Invocations are dry-run by default.
- The invocation preview is collapsed behind a toggle.

## [0.10.0] - 2026-08-26

### Added

- Real brand logos for the `bedrock-agentcore` and `kagent` runtimes (traced
  from AWS's and kagent's official marks) in place of generic Material
  icons. `kagent` previously had no icon entry at all and silently fell
  back to a generic puzzle-piece icon.
- A "More filters" popover for Lifecycle/Owner, and a removable
  active-filter chip row (runtime chips carry their brand icon) below the
  filter bar.

### Changed

- The runtime badge moved from a secondary text row into the agent card
  header, next to the title, so the runtime is visible at a glance.
- The runtime filter dropdown now shows each runtime's icon and friendly
  label instead of the raw annotation value (e.g. `bedrock-agentcore`).
- Capability chips on agent cards are slightly larger for legibility.

### Fixed

- The agents grid's empty state no longer conflates "no agents registered"
  with "no agents match the active filters" — the latter now shows its own
  message with a "Clear filters" action.

## [0.9.1] - 2026-08-25

### Fixed

- The Hire Agent dialog's "AWS CLI command" preview (and its "missing
  region/runtime-handle" warning chip) rendered unconditionally,
  regardless of the entity's `ai-agent.io/runtime` — a kagent, litellm,
  or custom-runtime agent showed a fabricated `aws bedrock-agentcore
invoke-agent-runtime` command that has nothing to do with how it's
  actually invoked. Both the preview block and the "Copy CLI"/"Copy CLI
  command" buttons now only appear for `bedrock-agentcore` agents.
- `setupTests.ts` didn't expose a `DocumentFragment` global, so any
  jsdom test rendering a MUI `Dialog`/`Modal` (which checks `instanceof
DocumentFragment` when mounting its portal) crashed instead of
  rendering. Added it alongside the other manually-shimmed DOM globals.

## [0.9.0] - 2026-08-24

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
  (card links, entity-overview links/endpoint, avatar image, and — as of a
  follow-up pass — the detail drawer's endpoint link and links list, which
  the first pass missed) as `href`/`src`, so a `javascript:` URL in a
  catalog annotation can't reach the DOM.
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
  command. Added proper POSIX single-quote escaping — initially only to the
  `--payload` argument, then extended to `--region` and
  `--agent-runtime-id` too, which were still interpolated raw/under-quoted
  and vulnerable to the same class of copy-paste command injection via a
  malicious `region`/`runtime-handle` annotation.
- `HireAgentDialog`: closing the dialog mid-invocation and reopening it for
  a _different_ agent could let the first agent's still-in-flight response
  land in the second agent's dialog once it resolved (no cancellation/
  staleness guard on the async `run()` call). Added a request-token check
  so a stale response is dropped instead of applied.
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

[0.9.1]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.9.0...ai-agents@0.9.1
[0.9.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents@0.8.0...ai-agents@0.9.0
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
