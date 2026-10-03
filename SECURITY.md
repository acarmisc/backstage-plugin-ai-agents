# Security

## Supported versions

Only the latest release of each package gets security fixes:

- `@acarmisc/backstage-plugin-ai-agents`
- `@acarmisc/backstage-plugin-ai-agents-backend`
- `@acarmisc/backstage-plugin-ai-agents-backend-module-agentcore`
- `@acarmisc/backstage-plugin-ai-agents-backend-module-kagent`
- `@acarmisc/backstage-plugin-ai-agents-backend-module-langfuse`

## Reporting a vulnerability

Use GitHub's
[private vulnerability reporting](https://github.com/acarmisc/backstage-plugin-ai-agents/security/advisories/new).
Please don't open a public issue. The project has one maintainer, so fixes are
best effort, without a response-time guarantee.

## Threat model

Catalog authors control entity annotations, and Backstage users call the
backend routes. Reports in these areas are the most useful:

- **Server-side requests from annotations.** The backend fetches health URLs
  (`ai-agent.io/health`, `ai-agent.io/endpoint`), avatars and runtime endpoints
  named by annotations. Probing and the avatar proxy only fetch origins on
  `ai-agents.probeAllowlist` and `ai-agents.avatarProxy.allowlist`, both empty
  by default. The AgentCore region must be an AWS region id, and the kagent
  `authHeader` is only sent to the configured controller.
- **Authorization.** Running an agent needs `ai-agent.invoke`; history and spend
  need `ai-agent.history.read`. Catalog reads use the caller's credentials, so
  catalog permissions decide which agents a user can see.
- **Writes by agents.** Invocations send `post: false` unless the user
  confirms a write in the Hire dialog.
- **Content served from the app's origin.** Proxied avatars are sniffed for an
  image type and served with a sandboxing Content-Security-Policy.
- **Credentials.** `probeAuthHeader`, the AgentCore client secret, the kagent
  `authHeader`, the Langfuse keys and the LiteLLM master key are backend-only
  configuration and never reach the browser.
