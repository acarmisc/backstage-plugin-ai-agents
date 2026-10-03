# Architecture

![The "Run an agent" scenario, step 4: the AgentCore module calls the runtime](images/architecture.png)

[`architecture.html`](architecture.html) is an interactive version of this
page: open it in a browser, pick a scenario and step through it. The toggle
switches between the AgentCore and kagent invoker modules. It was built with
the [architecture-diagram skill](https://github.com/konraddzbik/architecture-diagram-skill).

## Components

| Component         | Package / system                                   | Role                                                                           |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Backstage app     | `@acarmisc/backstage-plugin-ai-agents`             | Agents page, entity cards, Hire dialog, Activity view. Calls `/api/ai-agents`. |
| ai-agents backend | `@acarmisc/backstage-plugin-ai-agents-backend`     | Routes, permission checks, status probing, invocation records, reviews, spend. |
| Software Catalog  | Backstage core                                     | Source of truth for agents. Read on behalf of the calling user.                |
| Plugin database   | Backstage `database` service                       | `invocations` and `agent_reviews` tables. Optional.                            |
| Invoker module    | `-module-agentcore`, `-module-kagent`, or your own | Implements `AgentInvoker` for one runtime, registered under the runtime name.  |
| Agent runtime     | AWS Bedrock AgentCore, kagent                      | Runs the agent. Also serves the health URL the backend probes.                 |
| Telemetry module  | `-module-langfuse`, or your own                    | Implements `TelemetryProvider`. Read-only.                                     |
| Langfuse          | external                                           | OTel traces of the agents.                                                     |
| LiteLLM proxy     | external                                           | Spend logs, joined to invocations by request tags.                             |

The backend never talks to a runtime or a telemetry store directly. Both go
through the `ai-agents.invoker` extension point, so supporting another runtime
or store means adding a backend module, not changing the backend.

## Scenarios

### 1. Live status (`GET /statuses`)

1. The agents page sends the refs of the agents it shows (at most 200).
2. The backend reads those entities from the catalog with a token issued on
   behalf of the user. Agents the user cannot read are skipped.
3. The probe URL is `ai-agent.io/health`, or `ai-agent.io/endpoint` when there
   is no health URL.
4. If the URL's origin is in `ai-agents.probeAllowlist`, the backend sends a
   `GET` (3 s timeout). 2xx is healthy, 4xx degraded, 5xx or a network error
   down. Otherwise the status is `unknown`.
5. Results are cached in memory for `statusCacheTtlMs` (15 s).

### 2. Run an agent (`POST /invocations/:ref`)

1. The Hire dialog sends the form values, `post: false` and, on follow-up
   turns, the thread id and the message.
2. The backend checks `ai-agent.invoke`, reads the entity on behalf of the user
   and picks the invoker registered for `ai-agent.io/runtime`.
3. It fills the prompt template, derives a session id from the thread and adds
   the spend tags (`channel:backstage`, `session:<thread>`,
   `invoked-by:<user>`, `backstage-entity:<ref>`).
4. The invoker calls the runtime:
   - **AgentCore**: `POST /runtimes/<arn>/invocations` with an OAuth2
     client-credentials token; the session id goes in
     `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id`.
   - **kagent**: A2A `message/send` to `/api/a2a/<namespace>/<name>/`; the
     thread id is the `contextId`.
5. The invoker extracts the answer text from the runtime's response.
6. The backend records the invocation when a database is configured.
7. The dialog shows the answer. If the form has an `action` or `post` field it
   offers **Confirm and publish**, which repeats the call with `post: true`.

### 3. Activity (`GET /activity`, `/runs/:ref`, `/insights/:ref`)

1. The Activity view polls every 3 s while a run is in progress and every
   10 s otherwise, and stops while the browser tab is hidden.
2. The backend reads the entity's `ai-agent.io/telemetry-id`.
3. It calls the registered `TelemetryProvider`.
4. The Langfuse module queries `/api/public/v2/observations` for metadata
   only, never prompts, model output or tool arguments.
5. A run is one `<telemetry-id>-invoke` span; its tool calls are TOOL spans. A
   trace with tool calls and no invoke span yet is still running.
6. The backend returns `AgentRun[]`; `GET /runs/:ref/:runId` returns the tool
   calls of one run.

See [activity.md](activity.md) for the provider contract.

### 4. Spend (`GET /invocations/:ref/spend`)

1. The drawer asks for the agent's cost, or one conversation's with
   `?thread=`. Requires `ai-agent.history.read`.
2. The backend reads LiteLLM spend logs for the last 30 days (1–90).
3. Rows are matched on `session:<thread>` or `backstage-entity:<ref>`.
4. The response sums spend, tokens and requests, also per model.

Without `litellm.baseUrl` and `litellm.masterKey` the route answers `501` and
the UI hides the cost.
