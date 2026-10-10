# @acarmisc/backstage-plugin-ai-agents-backend-module-kagent

Runtime module for the [AI Agents backend](https://github.com/acarmisc/backstage-plugin-ai-agents/tree/main/packages/plugin-ai-agents-backend): runs
agents hosted on [kagent](https://kagent.dev) from the Hire dialog, through the
controller's [A2A](https://a2a-protocol.org) endpoint.

It handles agents with `ai-agent.io/runtime: kagent`, or every agent when it is
the only runtime module installed.

## Installation

```bash
yarn --cwd packages/backend add @acarmisc/backstage-plugin-ai-agents-backend-module-kagent
```

```ts
// packages/backend/src/index.ts
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
backend.add(
  import('@acarmisc/backstage-plugin-ai-agents-backend-module-kagent'),
);
```

## Configuration

```yaml
ai-agents:
  invocations:
    kagent:
      baseUrl: http://kagent-controller.kagent.svc.cluster.local:8083
      # namespace: kagent
      # authHeader: Bearer ${KAGENT_TOKEN}
      # timeoutMs: 120000
```

| Key          | Description                                                                         |
| ------------ | ----------------------------------------------------------------------------------- |
| `baseUrl`    | URL of the kagent controller's HTTP server.                                         |
| `namespace`  | Default namespace of the agents. Default `kagent`.                                  |
| `authHeader` | `Authorization` header for the controller. Only sent to `baseUrl`'s origin. Secret. |
| `timeoutMs`  | Timeout of one invocation. Default `120000`.                                        |

## Agent annotations

```yaml
metadata:
  annotations:
    ai-agent.io/runtime: kagent
    ai-agent.io/runtime-handle: support-triage # name of the kagent Agent
    ai-agent.io/namespace: agents # optional
    # ai-agent.io/endpoint: https://kagent.other-cluster.example.com  # optional, other controller
```

An `endpoint` annotation sends the request to another controller. It must share
the controller origin with `baseUrl`. `authHeader` is not sent there unless it
has the same origin as `baseUrl`.

## Request

`POST <baseUrl>/api/a2a/<namespace>/<runtime-handle>/` with a JSON-RPC
`message/send` call. The message carries the prompt as one text part and the
conversation's thread id as `contextId`, so follow-up turns keep the agent's
context. The answer is the text of the task's artifacts, or of the returned
message.
