# Providers

## Agent invocations

The backend core is transport-agnostic: it resolves the entity, fills the
prompt template with the submitted form values, persists the invocation
(`status`, `prompt`, `response`, `user`, `latency`) into the plugin database,
and delegates the actual call to a pluggable **invoker** registered through
the `ai-agents.invoker` extension point. Multiple provider modules can be
installed side by side — the entity's `ai-agent.io/runtime` annotation picks
which one handles a given agent (e.g. `bedrock-agentcore` vs `kagent`). If
an entity has no `runtime` annotation and exactly one provider module is
installed, that single invoker is used, so single-runtime setups don't need
the annotation.

The shipped AgentCore module invokes AWS Bedrock AgentCore runtimes using a
Keycloak client-credentials JWT:

```yaml
ai-agents:
  invocations:
    # enabled: true   # default
    agentCore:
      tokenUrl: https://auth.example.com/realms/my-realm/protocol/openid-connect/token
      clientId: backstage
      clientSecret: ${AI_AGENTS_AGENTCORE_CLIENT_SECRET}
      region: eu-west-1        # default; the /region annotation overrides it
      accountId: "123456789012" # only needed if runtime-handle has no full ARN
```

The shipped kagent module invokes agents hosted on a [kagent](https://kagent.dev)
runtime via its A2A endpoint (`/api/a2a/{namespace}/{agent-name}/`, JSON-RPC
`message/send`):

```yaml
ai-agents:
  invocations:
    kagent:
      baseUrl: http://kagent-controller.kagent.svc.cluster.local:8083
      namespace: kagent            # default; the /namespace annotation overrides it
      # authHeader: "Bearer ..."   # only if the controller sits behind auth
```

```yaml
# catalog-info.yaml for a kagent-hosted agent
metadata:
  annotations:
    ai-agent.io/runtime: kagent
    ai-agent.io/runtime-handle: helm-agent   # the kagent Agent's name
    ai-agent.io/namespace: kagent            # optional override of the module default
```

Then register whichever module(s) you need next to the plugin in your backend:

```ts
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend'));
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend-module-agentcore'));
backend.add(import('@acarmisc/backstage-plugin-ai-agents-backend-module-kagent'));
```

Without a matching module the endpoint answers 501 and the frontend falls
back to the CLI-copy flow — other organisations can plug their own invoker
(Lambda, Azure ML, HTTP…) by implementing `AgentInvoker` from the backend
package and registering it under a runtime key of their choosing.
