# Agent Activity Timeline: status

## Decision (resolved 2026-10-03)

The activity-read boundary is the **Langfuse public API**, not a custom
service. The earlier blocker came from reading the wrong Langfuse project:
the agents trace into `CES-ai-agents` (not `ces-llm-gateway`), where each run
is an `<agent>-invoke` AGENT observation and each tool call a TOOL
observation. Those are returned by `/api/public/v2/observations`, so span
*events* (`ces.agent.*`) are not needed for the timeline.

Implemented by `packages/plugin-ai-agents-backend-module-langfuse`
(see the "Run timeline" section of the README).

## Still open

- **Running state is inferred** (tool observations exist but the invoke span,
  exported at run end, does not yet). Not yet confirmed against a live run.
- **Target/project** come from `ces.agent.target` / `ces.agent.project` on the
  invoke span (ces-ai-agents commit "Record run target and project on the
  agent-invoke span"); runs from before that deploy show no target.
- Release: bump `ai-agents-backend` (new `registerTelemetryProvider` API) and
  `ai-agents`, then tag the new module.
- Needs a dedicated read-only Langfuse project key for the plugin.
