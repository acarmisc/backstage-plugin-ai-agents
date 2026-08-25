# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents-backend-module-agentcore`
are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-08-25

### Changed

- **BREAKING:** updated for the backend's new multi-runtime invoker
  extension point — registers itself via
  `invokers.registerInvoker('bedrock-agentcore', ...)` instead of the
  removed `setInvoker(...)`. Requires
  `@acarmisc/backstage-plugin-ai-agents-backend` `^0.6.0`. No change needed
  for existing entities that already set
  `ai-agent.io/runtime: bedrock-agentcore` (the documented setup); entities
  with no `runtime` annotation still resolve to this invoker as long as
  it's the only provider module installed.

## [0.2.0] - 2026-08-24

### Fixed

- The dependency on `@acarmisc/backstage-plugin-ai-agents-backend` was
  pinned to `^0.3.0`, which excludes the currently-published `0.4.0`
  (caret ranges pin the minor on `0.x` versions). This was causing npm to
  install a duplicate published `0.3.0` copy of the backend package inside
  this module's own `node_modules` instead of resolving to the
  workspace-local `0.4.0`. Bumped to `^0.4.0`.
- Removed `encodeRuntimeArnPath` — unused, and its implementation was a
  literal no-op (`encodeURIComponent(arn).replace(/%2F/g, '%2F')`).

### Added

- `engines.node: ">=20"`.

## [0.1.1] - 2026-08-23

- Fixed the invoker silently building a broken ARN containing the literal
  string `"undefined"` when a bare `runtime-handle` annotation was used
  without a configured AWS account id. Now throws a clear, actionable error
  upfront instead.

## [0.1.0] - 2026-08-23

- Initial release: AWS Bedrock AgentCore invocation module, implementing
  the backend's `AgentInvoker` extension point via an OAuth2
  client-credentials JWT.

[0.3.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend-module-agentcore@0.2.0...ai-agents-backend-module-agentcore@0.3.0
[0.2.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend-module-agentcore@0.1.1...ai-agents-backend-module-agentcore@0.2.0
[0.1.1]: https://github.com/acarmisc/backstage-plugin-ai-agents/compare/ai-agents-backend-module-agentcore@0.1.0...ai-agents-backend-module-agentcore@0.1.1
[0.1.0]: https://github.com/acarmisc/backstage-plugin-ai-agents/releases/tag/ai-agents-backend-module-agentcore@0.1.0
