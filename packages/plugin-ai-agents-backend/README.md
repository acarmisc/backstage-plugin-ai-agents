# @acarmisc/backstage-plugin-ai-agents-backend

Backend of the AI Agents plugin for Backstage. It probes agents' health URLs,
runs agents through runtime modules, records invocations and reviews, reads
spend from LiteLLM and serves run activity from a telemetry module.

See the [repository README](https://github.com/acarmisc/backstage-plugin-ai-agents#readme)
for the catalog model and [docs/architecture.md](https://github.com/acarmisc/backstage-plugin-ai-agents/blob/main/docs/architecture.md)
for how the requests flow.

## Installation

```bash
yarn --cwd packages/backend add @acarmisc/backstage-plugin-ai-agents-backend
```

```ts
// packages/backend/src/index.ts
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
```

The plugin uses the backend's `database` service; its migrations create the
`invocations` and `agent_reviews` tables. To run agents or show activity, also
install a runtime module (`-module-agentcore`, `-module-kagent`) and a
telemetry module (`-module-langfuse`).

## Configuration

```yaml
ai-agents:
  probeAllowlist:
    - https://*.agents.example.com
  # enabled: true
  # probeTimeoutMs: 3000
  # statusCacheTtlMs: 15000
  # probeAuthHeader: ${AI_AGENTS_PROBE_TOKEN}
  # invocations:
  #   enabled: true
  # avatarProxy:
  #   enabled: true
  #   allowlist:
  #     - https://gitlab.example.com
```

| Key                         | Default    | Description                                                                                         |
| --------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `enabled`                   | `true`     | Status probing on or off.                                                                           |
| `probeAllowlist`            | `[]`       | Origin globs the backend may probe, e.g. `https://*.example.com`. Empty means no probing.           |
| `probeTimeoutMs`            | `3000`     | Timeout of one probe.                                                                               |
| `statusCacheTtlMs`          | `15000`    | How long a status is cached in memory.                                                              |
| `probeAuthHeader`           | none       | `Authorization` header sent with probes. Secret.                                                    |
| `invocations.enabled`       | `true`     | `false` turns `POST /invocations` off (404).                                                        |
| `avatarProxy.enabled`       | `false`    | Fetch `http(s)` avatars through the backend's URL reader, so images in private repositories render. |
| `avatarProxy.allowlist`     | `[]`       | Origin globs the proxy may fetch. Other avatars are redirected to.                                  |
| `avatarProxy.ttlMs`         | `86400000` | Cache lifetime of a fetched avatar.                                                                 |
| `avatarProxy.negativeTtlMs` | `3600000`  | How long a failed fetch is remembered.                                                              |
| `avatarProxy.maxBytes`      | `524288`   | Largest avatar accepted.                                                                            |

All keys are under `ai-agents`. Spend needs the LiteLLM connection that the
LiteLLM backend plugin also reads:

```yaml
litellm:
  baseUrl: https://litellm.example.com
  masterKey: ${LITELLM_MASTER_KEY}
```

## Permissions

| Permission              | Action   | Routes                                                 |
| ----------------------- | -------- | ------------------------------------------------------ |
| `ai-agent.invoke`       | `update` | `POST /invocations/:ref`                               |
| `ai-agent.history.read` | `read`   | `GET /invocations/:ref`, `GET /invocations/:ref/spend` |

Both are registered with the permissions registry, so they can be granted from
your permission policy. Catalog reads use the caller's credentials on every
route.

## Routes

All under `/api/ai-agents`. `:ref` is a URL-encoded entity ref.

| Route                         | Description                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `GET /health`                 | `{ status: 'ok', enabled }`                                                             |
| `GET /statuses?refs=a,b`      | Status of up to 200 agents                                                              |
| `GET /status/:ref`            | Status of one agent                                                                     |
| `GET /avatar/:ref`            | Proxied avatar image, or a redirect                                                     |
| `POST /invocations/:ref`      | Run the agent. Body `{ values, prompt?, threadId?, post? }`; `post` defaults to `false` |
| `GET /invocations/:ref`       | Invocation history, newest first (`?limit=`, max 100)                                   |
| `GET /invocations/:ref/spend` | LiteLLM spend for the agent, or for one thread with `?thread=`                          |
| `POST /reviews/:ref`          | Add a review `{ rating: 0-5, comment? }`                                                |
| `GET /reviews/:ref`           | Reviews, count and average                                                              |
| `GET /activity`               | Recent runs of every agent with a telemetry id                                          |
| `GET /runs/:ref`              | Recent runs of one agent                                                                |
| `GET /runs/:ref/:runId`       | Tool calls of one run                                                                   |
| `GET /insights/:ref?hours=`   | Run and tool statistics                                                                 |

Features whose dependency is missing answer `501`: no database for history and
reviews, no runtime module for invocations, no LiteLLM config for spend, no
telemetry module for activity.

## Extension point

Modules extend the plugin through `aiAgentsExtensionPoint`:

```ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import { aiAgentsExtensionPoint } from '@acarmisc/backstage-plugin-ai-agents-backend';

export default createBackendModule({
  pluginId: 'ai-agents',
  moduleId: 'my-runtime',
  register(reg) {
    reg.registerInit({
      deps: { aiAgents: aiAgentsExtensionPoint },
      async init({ aiAgents }) {
        aiAgents.registerInvoker('my-runtime', {
          async invoke(request) {
            // call your runtime with request.prompt, request.args, request.threadId
            return { responseText: '...', latencyMs: 0 };
          },
        });
      },
    });
  },
});
```

- `registerInvoker(runtime, invoker)` handles agents whose
  `ai-agent.io/runtime` annotation equals `runtime`. When only one invoker is
  installed it also handles agents without the annotation.
- `registerTelemetryProvider(provider)` supplies run activity; see
  [docs/activity.md](https://github.com/acarmisc/backstage-plugin-ai-agents/blob/main/docs/activity.md).

Always pass `request.args.post` to the agent: it is `false` unless the user
confirmed a write.
