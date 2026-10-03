# @acarmisc/backstage-plugin-ai-agents-backend-module-agentcore

Runtime module for the [AI Agents backend](https://github.com/acarmisc/backstage-plugin-ai-agents/tree/main/packages/plugin-ai-agents-backend): runs
agents hosted on [AWS Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)
from the Hire dialog.

It handles agents with `ai-agent.io/runtime: bedrock-agentcore`, or every agent
when it is the only runtime module installed.

## Installation

```bash
yarn --cwd packages/backend add @acarmisc/backstage-plugin-ai-agents-backend-module-agentcore
```

```ts
// packages/backend/src/index.ts
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
backend.add(
  import('@acarmisc/backstage-plugin-ai-agents-backend-module-agentcore'),
);
```

## Configuration

The module authenticates with an OAuth2 client-credentials token. The runtimes
must be configured with a JWT authorizer that accepts tokens from that issuer.

```yaml
ai-agents:
  invocations:
    agentCore:
      tokenUrl: https://auth.example.com/realms/agents/protocol/openid-connect/token
      clientId: backstage
      clientSecret: ${AGENTCORE_CLIENT_SECRET}
      region: eu-west-1
      # accountId: '123456789012'   # only for bare runtime ids
      # timeoutMs: 120000
```

| Key            | Description                                                           |
| -------------- | --------------------------------------------------------------------- |
| `tokenUrl`     | Token endpoint of the identity provider.                              |
| `clientId`     | OAuth2 client id.                                                     |
| `clientSecret` | OAuth2 client secret. Secret.                                         |
| `region`       | Default AWS region. The `ai-agent.io/region` annotation overrides it. |
| `accountId`    | Builds the runtime ARN when `runtime-handle` is a bare runtime id.    |
| `timeoutMs`    | Timeout of one invocation. Default `120000`.                          |

Without this block the module is installed but every invocation fails with a
configuration error.

## Agent annotations

```yaml
metadata:
  annotations:
    ai-agent.io/runtime: bedrock-agentcore
    ai-agent.io/runtime-handle: arn:aws:bedrock-agentcore:eu-west-1:123456789012:runtime/support_triage-AbCd123
    ai-agent.io/region: eu-west-1 # optional
```

The region must be a valid AWS region id; anything else is rejected before a
request is made, because it becomes part of the host the token is sent to.

## Request

`POST https://bedrock-agentcore.<region>.amazonaws.com/runtimes/<arn>/invocations?qualifier=DEFAULT`
with a JSON body:

| Field                                | Value                                                     |
| ------------------------------------ | --------------------------------------------------------- |
| `prompt`                             | The filled prompt template, or the follow-up message      |
| `post`                               | Always present; `false` unless the user confirmed a write |
| `target`, `project`, `model`, `mode` | Form values with these names, when present                |
| `litellm_tags`                       | `agent:<name>` plus the plugin's spend tags               |
| `trace_user_id`                      | The Backstage user entity ref                             |

The thread's session id is sent as
`X-Amzn-Bedrock-AgentCore-Runtime-Session-Id`, so follow-up turns reach the
same session. The response text is read from `result`, `response`, `output`,
`text` or `completion`, in that order, or the raw body.
