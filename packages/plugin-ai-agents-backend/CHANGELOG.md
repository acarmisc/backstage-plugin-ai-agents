# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents-backend` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Avatar proxy (`GET /api/ai-agents/avatar/:entityRef`, opt-in via
  `ai-agents.avatarProxy`): fetches agent avatars through the integrations'
  credentials (e.g. the GitLab token) so private-repo images render, with
  allowlist gating, content sniffing, size limits, ETag revalidation, and
  positive + negative caching.

## [0.7.1] - 2026-09-19

### Fixed

- Register `aiAgentsPermissions` with `coreServices.permissionsRegistry`.
  Without it the `ai-agent.invoke` / `ai-agent.history.read` permissions were
  invisible to the RBAC backend, so they could not be granted in the `/rbac`
  UI and every invocation was denied with "not authorized to invoke this
  agent". Mirrors what the LiteLLM backend plugin already does.

## [0.7.0] - 2026-09-19

### Added

- Invocations now carry a **conversation thread**. `POST /invocations/:ref`
  accepts an optional `threadId` (a new one is minted when omitted) and
  returns it; the request's `sessionId` is derived from it deterministically,
  so every turn of a conversation maps to the same AgentCore session. The
  thread also becomes a `session:<threadId>` cost tag, and both `threadId`
  and `post` are persisted on the invocation record (migration
  `20260919120000_add_invocation_thread`).
- `GET /invocations/:ref/spend` returns LiteLLM spend attributed to a thread
  (`?thread=`) or to the whole agent, read from the LiteLLM instance the
  `litellm.*` config points at. Answers 501 when LiteLLM is not configured.

### Changed

- **BREAKING:** `AgentInvocationRequest` gained `threadId`, `args`, `tags`
  and `traceUserId`. `args` carries the structured agent inputs (`target`,
  `project`, `post`, `model`, `knowledgeBaseIds`, `mode`) that the agent
  entrypoint reads directly, instead of only the rendered prompt.
- `post` is now always sent explicitly and **defaults to false** (dry-run).
  Previously it was never sent, and agent entrypoints default an omitted
  `post` to true — a "dry-run" selection could post real feedback.
- `POST /invocations/:ref` also accepts a free-text `prompt` for follow-up
  turns and a boolean `post` override.
- `makeSessionId` was replaced by `normalizeSessionId` / `makeThreadId`.

## [0.6.0] - 2026-08-25

### Changed

- **BREAKING:** the invoker extension point now supports multiple runtimes
  side by side. `AiAgentsExtensionPoint.setInvoker(invoker)` was replaced
  with `registerInvoker(runtime, invoker)`, keyed by the same string used
  in the entity's `ai-agent.io/runtime` annotation (e.g.
  `bedrock-agentcore`, `kagent`). `POST /invocations/:ref` now dispatches
  to the invoker matching the entity's `runtime` annotation; when an
  entity omits it and exactly one provider module is installed, that
  single invoker is still used, so existing single-runtime setups are
  unaffected. `RouterOptions.invoker` was replaced with
  `invokers: Map<string, AgentInvoker>` accordingly.

### Added

- `AgentTarget.namespace`, resolved from a new `ai-agent.io/namespace`
  annotation, for runtimes that address agents by namespace + name (e.g.
  kagent) rather than region + ARN.

## [0.5.0] - 2026-08-24

### Security

- The probe allowlist (`ai-agents.probeAllowlist`) now defaults to **deny**
  when empty, instead of allowing any http(s) URL. Catalog-controlled probe
  URLs reaching the backend server-side is an inherent SSRF-shaped surface;
  an empty allowlist previously meant "probe anything."
- Fixed the allowlist's glob matcher testing patterns against the full URL
  string in addition to the origin, which let a pattern like
  `https://example.com*` also match `https://example.com.evil.com`.
  Matching is now origin-only with dot-bounded wildcard expansion.
- Added permission checks (`ai-agent.invoke`, `ai-agent.history.read`) on
  `POST /invocations/:entityRef` and `GET /invocations/:entityRef` — both had
  no authorization at all. When no permission policy is configured, checks
  default to allow (standard Backstage behavior), so this is backward
  compatible.
- `userRef()` silently swallowed credential-resolution errors, turning a
  failed lookup into an untraceable anonymous invocation. Now logged at
  `warn`.

### Changed

- **BREAKING:** the annotation namespace moved from `ai-agent.acarmisc.org/*`
  to `ai-agent.io/*`. Existing entities keep working unchanged via a
  per-key legacy fallback.
- `InvocationStore` and `ReviewStore` no longer do ad-hoc
  `hasTable`/`createTable` checks at router construction — both tables are
  now managed via real knex migrations (`migrations/`), which track applied
  migrations and use a DB-level lock, making concurrent replica boots safe.

### Fixed

- `config.d.ts` declared the `invocations` config block at the `Config`
  root; the code has always read it nested under `ai-agents`. The schema
  now matches what's actually read.
- `GET /statuses` accepted an unbounded `refs` list and probed every one
  concurrently — now rejects with 400 past 200 refs.
- The in-memory status cache grew forever with no eviction. Added a bounded
  FIFO eviction (2000 entries).

### Added

- `engines.node: ">=20"`.

## [0.4.0] - 2026-08-23

- Added 0-5 star reviews with comments for AI agents (persisted alongside
  invocation history).

## [0.3.0] - 2026-08-23

- Added real agent invocations via a pluggable `AgentInvoker` extension
  point, with the AgentCore module as the first provider.

## [0.2.1] - 2026-07-30

- Added `repository` and `homepage` fields to `package.json`.

## [0.2.0] - 2026-07-25

- Added the entity-page Agent Overview card, plus docs.

## [0.1.1] - 2026-07-25

- Initial release: AI Agents Backstage plugin (frontend + backend).

[0.6.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend@0.5.0...ai-agents-backend@0.6.0
[0.5.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend@0.4.0...ai-agents-backend@0.5.0
[0.4.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend@0.3.0...ai-agents-backend@0.4.0
[0.3.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend@0.2.1...ai-agents-backend@0.3.0
[0.2.1]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend@0.2.0...ai-agents-backend@0.2.1
[0.2.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend@0.1.1...ai-agents-backend@0.2.0
[0.1.1]: https://github.com/acarmisc/backstage-plugin-ai-agents/releases/tag/ai-agents-backend@0.1.1
