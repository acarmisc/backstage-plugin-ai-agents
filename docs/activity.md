# Activity view

The agents page has an **Activity** tab and every `ai-agent` catalog entity has an
**Activity** tab of its own. Both read from a pluggable telemetry source;
nothing is stored in Backstage and prompts or tool arguments are never read.

- **Workspace** (agents page → Activity): agents in a left rail (stable
  alphabetical order, a status dot or an "N running" chip each), the selected
  agent in the body. "All agents" shows the fleet: totals, every run in progress
  across agents, and the latest runs.
- **Agent panel**: KPIs (runs, success rate, p50 / p95 duration, running now),
  **Running now** (one card per concurrent run with live elapsed time and the
  current step), recent runs (filter by state or text), runs-per-hour chart and
  tool usage (calls, errors, avg / p95 latency).
- **Run detail**: facts, tool calls / errors / peak parallelism and a
  **waterfall** of the tool calls — parallel calls overlap on the time axis.
- **Deep links**: `?tab=activity&agent=<telemetry-id>&run=<run-id>&hours=6|24|72`.
- **Catalog entity tab**: the same panel scoped to one agent; without a
  `telemetry-id` it explains how to enable it.
- The detail drawer is compact: header + actions, everything else collapsed and
  fetched on first expansion, with an "Open activity" shortcut.

## Data flow

```
agents ──OTel──► telemetry store (e.g. Langfuse)
                        ▲
        TelemetryProvider (backend module, read-only)
                        ▲
   ai-agents backend:  GET /activity · GET /runs/:ref · GET /runs/:ref/:runId
                        ▲
   frontend: polls every 5 s, paused while the tab is hidden
```

An agent opts in with the catalog annotation `ai-agent.io/telemetry-id`
(the agent's name in the telemetry store).

## Backend contract

From `@acarmisc/backstage-plugin-ai-agents-backend`:

```ts
interface TelemetryProvider {
  getRuns(telemetryId: string, limit?: number): Promise<AgentRun[]>;
  /** null when the run does not exist for that agent. */
  getRunTimeline(
    telemetryId: string,
    runId: string,
  ): Promise<RunEvent[] | null>;
  /** Optional: per-agent statistics for the panel. */
  getInsights?(telemetryId: string, hours: number): Promise<AgentInsights>;
}

interface AgentInsights {
  windowHours: number;
  totals: {
    runs: number;
    running: number;
    completed: number;
    failed: number;
    unknown: number;
  };
  durationMs: { p50: number; p95: number }; // over finished runs
  histogram: { start: string; runs: number; failed: number }[]; // windowHours UTC hours, oldest first
  tools: {
    name: string;
    calls: number;
    errors: number;
    avgMs: number;
    p95Ms: number;
  }[]; // top 10
}

type RunState = 'running' | 'completed' | 'failed' | 'unknown';

interface AgentRun {
  runId: string;
  agent: string;
  state: RunState;
  target?: string;
  project?: string;
  mode?: string;
  startedAt?: string;
  updatedAt?: string;
  currentActivity?: string;
  verdict?: string;
  events?: RunEvent[];
}

interface RunEvent {
  seq: number;
  name: string;
  event: string; // 'start' | 'tool' | 'completed' | ...
  tool?: string;
  label?: string;
  durationMs?: number;
  outcome?: string;
  incomplete?: string;
  ts?: string;
}
```

Register one provider from a backend module:

```ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import { aiAgentsExtensionPoint } from '@acarmisc/backstage-plugin-ai-agents-backend';

export const myTelemetryModule = createBackendModule({
  pluginId: 'ai-agents',
  moduleId: 'my-telemetry',
  register(reg) {
    reg.registerInit({
      deps: { ai: aiAgentsExtensionPoint },
      async init({ ai }) {
        ai.registerTelemetryProvider(myProvider);
      },
    });
  },
});
// packages/backend/src/index.ts: backend.add(myTelemetryModule);
```

The router resolves the entity's `telemetry-id` before calling the provider, so
provider credentials never reach the browser.

## Routes

| Route                                                              | Response                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /activity?limit=N` (N clamped to 1-30, default 10)            | `AgentActivity[]`: `{ entityRef, telemetryId, title?, runs, error? }`, newest run first, runs **without** `events`. Agents with a running run first. One failing agent gets `runs: []` and `error`; the others are still returned. `501` when no provider is registered. |
| `GET /runs/:entityRef?limit=N`                                     | `AgentRun[]` (`[]` when the entity has no `telemetry-id`). `501` without provider, `502` when the store query fails.                                                                                                                                                     |
| `GET /insights/:entityRef?hours=N` (N clamped to 1-72, default 24) | `AgentInsights`. `501` without provider or when it has no `getInsights`, `404` without telemetry id, `502` on store errors.                                                                                                                                              |
| `GET /runs/:entityRef/:runId`                                      | `RunEvent[]`. `404` when the agent has no telemetry id or the run is not found, `501` without provider, `502` on store errors.                                                                                                                                           |

The catalog is read on behalf of the calling user, so an agent the user cannot
see returns `404` (or `[]` for `/runs`).

## UI behaviour

- Polls the fleet every 5 s, an agent's runs every 3 s while something is running
  (10 s otherwise) and its statistics every 30 s; requests never overlap.
- No polling while the browser tab is hidden; becoming visible refetches at once.
- After a failed refresh the interval is 4x longer and the last data stays on
  screen with a warning. A first-load failure shows an error instead of an
  empty board. `501` (no provider) shows the empty state.

## Langfuse module

`@acarmisc/backstage-plugin-ai-agents-backend-module-langfuse` implements the
contract on top of Langfuse's public observations API. Setup, configuration,
what it reads and troubleshooting are in its
[README](../packages/plugin-ai-agents-backend-module-langfuse/README.md).

Limits worth knowing:

- Langfuse's API does not return OTel span events, so only observations
  (AGENT / TOOL) are used.
- `running` is inferred: the `<agent>-invoke` span is exported when the run
  ends, so a trace with tool calls but no invoke span yet is shown as running
  while its last tool is recent; later it becomes `unknown`. Not yet confirmed
  against a live run.
- No token or cost data.

## Writing another provider (e.g. Tempo)

Implement `getRuns` and `getRunTimeline`, map your store's spans to `AgentRun` /
`RunEvent`, keep requests cached and bounded, and never forward span input or
output. See `packages/plugin-ai-agents-backend-module-langfuse/src/provider.ts`
and its tests for a complete example.
