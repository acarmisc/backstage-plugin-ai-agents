# @acarmisc/backstage-plugin-ai-agents-backend-module-langfuse

Telemetry module for the [AI Agents backend](https://github.com/acarmisc/backstage-plugin-ai-agents/tree/main/packages/plugin-ai-agents-backend):
reads agent runs and tool calls from [Langfuse](https://langfuse.com) for the
Activity view and the run timelines. The provider contract is described in
[docs/activity.md](https://github.com/acarmisc/backstage-plugin-ai-agents/blob/main/docs/activity.md).

## Installation

```bash
yarn --cwd packages/backend add @acarmisc/backstage-plugin-ai-agents-backend-module-langfuse
```

```ts
// packages/backend/src/index.ts
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
backend.add(
  import('@acarmisc/backstage-plugin-ai-agents-backend-module-langfuse'),
);
```

## Configuration

```yaml
ai-agents:
  telemetry:
    langfuse:
      baseUrl: https://langfuse.example.com
      publicKey: ${LANGFUSE_PUBLIC_KEY}
      secretKey: ${LANGFUSE_SECRET_KEY}
      # servicePrefix: ''
      # serviceAttribute: resourceAttributes.service.name
      # targetAttribute: attributes.agent.target
      # projectAttribute: attributes.agent.project
      # lookbackHours: 24
      # runningWindowSeconds: 90
      # cacheTtlMs: 4000
```

| Key                    | Default                           | Description                                                                      |
| ---------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `baseUrl`              |                                   | Langfuse URL.                                                                    |
| `publicKey`            |                                   | Project public key.                                                              |
| `secretKey`            |                                   | Project secret key. Secret.                                                      |
| `servicePrefix`        | `''`                              | Prepended to the telemetry id to match the agent's service name.                 |
| `serviceAttribute`     | `resourceAttributes.service.name` | Observation metadata key holding the OTel service name.                          |
| `targetAttribute`      | none                              | Metadata key of the invoke span shown as the run's target.                       |
| `projectAttribute`     | none                              | Metadata key of the invoke span shown as the run's project.                      |
| `lookbackHours`        | `24`                              | How far back runs are searched.                                                  |
| `runningWindowSeconds` | `90`                              | How recent the last tool call must be for an unfinished run to count as running. |
| `cacheTtlMs`           | `4000`                            | Cache of Langfuse responses.                                                     |

Without the `langfuse` block the module does nothing.

Langfuse keys are project-wide and read/write. Give Backstage its own pair so it
can be rotated on its own; the module only reads.

Opt an agent in with its name in the traces:

```yaml
metadata:
  annotations:
    ai-agent.io/telemetry-id: support-triage
```

## What the traces must look like

The module expects the OpenTelemetry GenAI conventions, as emitted by agent
SDKs such as Strands:

- One AGENT observation named `<telemetry-id>-invoke` per run. Runs with
  `level: ERROR` are failed.
- One TOOL observation per tool call, with `attributes.gen_ai.tool.name` and
  `attributes.gen_ai.tool.status`, whose service attribute contains
  `<servicePrefix><telemetry-id>`.
- Optionally a `review_quality` metadata object on the invoke span
  (`risk_tier`, `posted`, `completed`, `incomplete_reason`), shown as the run's
  verdict.

The invoke span is exported when the run ends, so a trace that has tool calls
but no invoke span yet is shown as running while its last tool call is within
`runningWindowSeconds`, and as `unknown` after that.

## What it reads

`GET /api/public/v2/observations` with `fields=core,basic,metadata`. It never
requests `io`, so prompts, model output and tool arguments are not fetched.
Token and cost data are not shown.

## Troubleshooting: no runs

- The entity has no `ai-agent.io/telemetry-id`, or the catalog has not
  refreshed it yet.
- The keys belong to another Langfuse project.
- `servicePrefix` + telemetry id does not match the value at
  `serviceAttribute`.
- The last run is older than `lookbackHours`.
- Langfuse answers 401/403: the keys are wrong or revoked (see the backend
  log).
