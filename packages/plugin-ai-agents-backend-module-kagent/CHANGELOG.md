# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents-backend-module-kagent`
are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
