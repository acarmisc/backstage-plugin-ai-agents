# @acarmisc/backstage-plugin-ai-agents-backend-module-langfuse

Telemetry provider for the [ai-agents backend plugin](../plugin-ai-agents-backend):
reads agent runs and tool calls from [Langfuse](https://langfuse.com) so the
agents page can show an **Activity** board and per-agent run timelines.
Architecture and the provider contract: [`docs/activity.md`](../../docs/activity.md).

## Setup

1. Add the module next to the backend plugin:

   ```ts
   backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
   backend.add(
     import('@acarmisc/backstage-plugin-ai-agents-backend-module-langfuse'),
   );
   ```

2. Configure it (a no-op when the block is absent):

   ```yaml
   ai-agents:
     telemetry:
       langfuse:
         baseUrl: https://langfuse.example.com
         publicKey: ${LANGFUSE_AGENTS_PUBLIC_KEY}
         secretKey: ${LANGFUSE_AGENTS_SECRET_KEY}
         # lookbackHours: 24
         # runningWindowSeconds: 90
         # servicePrefix: abs_ces_agents_   # OTel service name = prefix + telemetry-id
         # cacheTtlMs: 4000
   ```

   Langfuse API keys are project-wide (read/write): use a dedicated pair for
   Backstage so it can be rotated independently. The module only reads.

3. Opt each agent in on its catalog entity:

   ```yaml
   metadata:
     annotations:
       ai-agent.io/telemetry-id: dinesh # agent name used in the traces
   ```

## What it reads

`GET /api/public/v2/observations` with `fields=core,basic,metadata` only. It
never requests `io`, so prompts, LLM output and tool arguments are never
fetched. Only derived values leave the backend.

- A run is one `<telemetry-id>-invoke` AGENT observation (one trace); its tool
  calls are TOOL observations (`attributes.gen_ai.tool.name` / `.status`).
- The verdict (risk, posted, incomplete reason) comes from the invoke span's
  `review_quality` metadata; target and project from the `ces.agent.target` /
  `ces.agent.project` span attributes.
- **Running** is inferred: the invoke span is exported when the run ends, so a
  trace that already has TOOL observations but no invoke span yet, and whose
  last tool ended within `runningWindowSeconds`, is shown as running. Once that
  window passes without an invoke span the run is shown as `unknown`.
- Langfuse's API does not return OTel span events, so those are not used.
- The traces must be in the Langfuse project the key pair belongs to. Token
  and cost data are not shown.

## Troubleshooting: no runs shown

- Does the catalog entity have `ai-agent.io/telemetry-id`? (The catalog must
  have re-read it; "Schedule entity refresh" on the entity page forces that.)
- Does the key pair belong to the Langfuse project where the agents trace?
- Does `servicePrefix` + telemetry-id match the runtime's
  `resourceAttributes.aws.local.service`?
- Is the last run inside `lookbackHours`?
- 401/403 from Langfuse: wrong or revoked keys (see the backend log).
