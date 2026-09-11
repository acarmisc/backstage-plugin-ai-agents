# Catalog model

Agents are `Component` entities with `spec.type: ai-agent`. Agent-specific
fields live under the `ai-agent.io/*` annotation namespace, plus
`metadata.tags` and `metadata.links`. No custom `spec` schema is needed —
catalog processors tolerate unknown annotations, which keeps the model
portable across Backstage versions.

> **Migration note:** Annotations moved from `ai-agent.acarmisc.org/*` to
> `ai-agent.io/*` in this version. The old prefix is still read as a fallback,
> so existing entities keep working, but new or updated entities should use
> the new prefix.

Only `spec.type: ai-agent` is required for an agent to appear on the
`/ai-agents` page. The `runtime` annotation defaults to `custom` if missing;
all other annotations are optional.

## Annotation reference

| Annotation | Required | Description |
|---|---|---|
| `ai-agent.io/runtime` | recommended | Runtime badge: `bedrock-agentcore`, `litellm`, `lambda`, `custom`, or any string. Defaults to `custom`. |
| `ai-agent.io/billing-model` | no | `per-invocation`, `per-token`, `subscription`, `free` (default `free`) |
| `ai-agent.io/capabilities` | no | Comma- or newline-separated chips, optionally `label:category` |
| `ai-agent.io/cost-per-1k` | no | USD per 1000 invocations (or per 1M tokens for `per-token`) |
| `ai-agent.io/budget` | no | Monthly spend cap |
| `ai-agent.io/avatar` | no | Image URL (falls back to initials on a tinted circle) |
| `ai-agent.io/version` | no | Version string in the card footer |
| `ai-agent.io/health` | no | URL the backend probes for live status (preferred) |
| `ai-agent.io/endpoint` | no | Invocation endpoint; probed if no `health` annotation |
| `ai-agent.io/runtime-handle` | no | ARN/handle shown in the detail drawer |
| `ai-agent.io/purpose` | no | Overrides `description` as the card's purpose text |
| `ai-agent.io/hire-schema` | no | JSON array declaring the "Hire Agent" form fields. See [Hiring an agent](#hiring-an-agent). |
| `ai-agent.io/prompt-template` | no | Prompt template with `{field_name}` placeholders matching `hire-schema` fields, used to build the AgentCore invocation preview. See [Hiring an agent](#hiring-an-agent). |
| `ai-agent.io/region` | no | AWS region for the AgentCore runtime, used in the Hire preview's CLI command (e.g. `eu-west-1`). |
| `ai-agent.io/namespace` | no | Kubernetes namespace for a kagent-hosted agent; defaults to the `-module-kagent` config's `namespace`. |

Capability categories (used for chip color): `reasoning`, `retrieval`,
`tools`, `vision`, `voice`, `data`, `safety`. A capability without a
category renders as a default-colored chip.

## Hiring an agent

Agents that declare a `ai-agent.io/hire-schema` annotation show a
**Hire Agent** button on their card, detail drawer, and entity-page card.
Clicking it opens a form rendered from the schema. When the backend is wired
with an invoker module, a **Run agent** button invokes the agent for real and
shows the live response; the dialog also builds an invocation preview (prompt
+ HTTP payload + AWS CLI command) with a **Copy CLI** fallback for manual runs.

The `hire-schema` annotation value is a JSON array of field objects:

```yaml
ai-agent.io/hire-schema: '[{"name":"project","label":"GitLab project","type":"text","required":true,"help":"e.g. my-org/my-project"},{"name":"target","label":"MR IID","type":"text","required":true},{"name":"action","label":"Action","type":"select","required":true,"options":["dry-run","post"],"default":"dry-run"}]'
```

| Field key | Type | Description |
|---|---|---|
| `name` | string (required) | Machine key for the field; used as the form-state key and the `{name}` placeholder in the prompt template |
| `label` | string (required) | Human-readable label shown above the input |
| `type` | `text` \| `url` \| `textarea` \| `select` \| `number` | Input to render (default `text`) |
| `required` | boolean | Whether the field must be filled before submit |
| `default` | string | Default value when the form opens |
| `options` | string[] | For `select` fields: the selectable options |
| `help` | string | Optional helper text shown under the input |

Malformed JSON, non-array JSON, or unknown `type` values are tolerated:
the schema is dropped and the **Hire Agent** button stays hidden.

### Prompt template

The `ai-agent.io/prompt-template` annotation is a string with
`{field_name}` placeholders matching the `hire-schema` fields. As the user
fills the form, the preview substitutes the placeholders with the field
values and builds:

1. **Prompt** — the filled template (or, when no `prompt-template` is set,
   a JSON object of all field values).
2. **Payload** — the `{"prompt": "..."}` JSON body for the AgentCore
   `/invocations` endpoint.
3. **AWS CLI command** — `aws bedrock-agentcore invoke-agent-runtime`,
   using `ai-agent.io/region` and
   `ai-agent.io/runtime-handle`. If either is missing, a warning
   chip is shown and the values are left as placeholders.

```yaml
ai-agent.io/prompt-template: "Review merge request !{target} in project '{project}'. Action: {action}."
ai-agent.io/region: us-east-1
ai-agent.io/runtime-handle: support-triage-runtime
```

## Adding an agent

### 1. Create the `catalog-info.yaml`

Place this file at the **root of the agent's GitLab repository**, on the
default branch. This is the only file Backstage needs to ingest the agent.

```yaml
# catalog-info.yaml — repo root
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: support-triage-agent
  title: Support Triage Agent          # shown as the card title
  description: Classifies and routes incoming support tickets by severity and product area.
  tags: [ai-agent, llm, support]       # 'ai-agent' tag is conventional but optional
  annotations:
    # --- recommended ---
    ai-agent.io/runtime: bedrock-agentcore      # bedrock-agentcore | litellm | lambda | custom
    ai-agent.io/billing-model: per-invocation   # per-invocation | per-token | subscription | free

    # --- optional but useful on the card ---
    ai-agent.io/capabilities: "tool-use:tools,rag:retrieval,reasoning:reasoning"
    ai-agent.io/cost-per-1k: "0.012"             # USD per 1k invocations (or per 1M tokens)
    ai-agent.io/version: "1.4.2"
    ai-agent.io/avatar: https://api.dicebear.com/7.x/bottts/svg?seed=triage

    # --- runtime handles (used by the backend status prober) ---
    ai-agent.io/runtime-handle: arn:aws:bedrock:us-east-1:123:agent/TXXX
    ai-agent.io/endpoint: https://abc.execute-api.us-east-1.amazonaws.com/prod
    ai-agent.io/health: https://abc.execute-api.us-east-1.amazonaws.com/prod/health
    # the backend probes `health` first, falls back to `endpoint`; omit both → status "unknown"

    # --- standard Backstage annotations (optional, work everywhere) ---
    backstage.io/techdocs-ref: dir:.
    gitlab.com/project-slug: my-org/agents/support-triage-agent

  links:
    - url: https://grafana.example.com/d/agents/support-triage
      title: Metrics
      icon: dashboard
    - url: https://docs.example.com/agents/support-triage
      title: Playbook
      icon: docs
spec:
  type: ai-agent                         # ← the plugin filters on this exact value
  lifecycle: production                  # production | experimental | deprecated
  owner: cs-ops                          # must match a Group/User entity ref in the catalog
  system: customer-support               # optional, must match a System entity
  dependsOn:
    - component:default/ticketing-api
    - resource:default/bedrock-agent
```

### 2. Commit and push

Commit `catalog-info.yaml` to the default branch of a project inside one of
the GitLab groups configured for catalog discovery (see below). Push.

### 3. Wait for the next discovery scan (or force a refresh)

The agent appears at `/ai-agents` within one discovery cycle. To see it
immediately, open **Catalog → Register existing component** in Backstage and
paste the GitLab raw URL of the `catalog-info.yaml`; the provider will also
pick it up on its next run regardless.
