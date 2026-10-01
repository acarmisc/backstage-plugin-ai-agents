# Agent Activity Timeline: Pending Integration

## Current State

CES AI Agents release `0d804d0` emits safe OTel activity events on each
`agent-invoke` span. The released container image is `0d804d01`.

The plugin worktree contains the provider-neutral timeline integration:

- `TelemetryProvider`, `AgentRun`, `RunEvent`, and run-state contracts.
- The `registerTelemetryProvider` backend extension point.
- `GET /runs/:entityRef` and `GET /runs/:entityRef/:runId` backend routes.
- Frontend API methods and the `RunTimeline` component.
- Timeline rendering only for agents with `ai-agent.io/telemetry-id`.

This work has local build, typecheck, lint, and test coverage. It is not
committed or published yet.

## Runtime Contract

The agent runtime emits these event names:

```text
{agent}:start
{agent}:{tool_name}
{agent}:completed
```

Required event attributes:

- `ces.agent.name`
- `ces.agent.event`
- `ces.agent.seq`

Optional context attributes:

- `ces.agent.target`
- `ces.agent.project`
- `ces.agent.mode`
- `ces.agent.session_id`

Tool events additionally contain `ces.agent.tool` and `ces.agent.outcome`.
Completed events may contain `ces.agent.incomplete`, including
`invocation_failed`.

Tool arguments, prompts, tool result bodies, tokens, and secrets are never
emitted and must never be surfaced by this feature.

## Verified Langfuse Constraints

The deployed Langfuse instance is self-hosted v4 in `events_only` mode:

- Host: `https://langfuse.ces.abstractstaging.it`
- Project: `ces-llm-gateway`
- Read API: `/api/public/v2/observations` with project-key Basic auth.
- Old trace APIs must not be used: the v1 traces table is stale in this mode.

The public observations list API was tested. It returns observation summaries
but not OTel span attributes or span events. Detail endpoints needed to fetch
those payloads are not publicly available. Do not couple Backstage directly to
Langfuse ClickHouse tables as a workaround.

## Decision Pending

Choose an activity-read boundary before publishing the plugin changes:

1. Add a narrow authenticated Langfuse endpoint that reads `events_core` and
   returns normalized activity runs. Lowest operational cost, but changes the
   Langfuse server or a maintained fork.
2. Create a CES-owned `agent-activity-api` microservice. It owns the stable
   run/timeline contract and adapts Langfuse internally. More portable and
   suitable if other clients will consume activity data.
3. Introduce a second queryable OTel backend. Highest infrastructure cost; not
   recommended for this use case.

Option 2 is the recommended direction if agent activity is a platform
capability rather than a Backstage-only feature.

## Next Implementation Step

Implement the chosen service as the only concrete `TelemetryProvider` source.
It should expose a read-only API equivalent to:

```text
GET /v1/runs?agent=dinesh&limit=5
GET /v1/runs/:runId?agent=dinesh
```

The adapter must use the catalog entity's `ai-agent.io/telemetry-id` as the
agent filter and must treat `runId` as an opaque trace/root-span identity.
Once available, add a plugin backend module that authenticates to that service
and registers it with `registerTelemetryProvider`.
