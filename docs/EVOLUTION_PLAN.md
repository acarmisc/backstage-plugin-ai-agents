# Evolution Plan — from a Bedrock-shaped plugin to a portable agent control plane

**Status:** proposal, September 2026
**Scope:** `@acarmisc/backstage-plugin-ai-agents` and its backend modules
**Goal:** make the plugin adoptable by organisations that share none of our
infrastructure, starting from AWS Bedrock AgentCore as the reference runtime
rather than as the only one that really works.

Written in English deliberately: the point of this plan is adoption outside
our organisation, and the repository's docs and code comments are English.

---

## 1. Where we actually are

The plugin already made the two decisions that matter most, and made them
right:

- **Agents are catalog `Component` entities** (`spec.type: ai-agent`). They
  inherit ownership, relations, RBAC, search, and discovery for free. No
  parallel database of agents to keep in sync.
- **Invocation is behind an extension point** (`ai-agents.invoker`), with two
  provider modules shipping today (`agentcore`, `kagent`) and a documented
  path for a third party to write their own.

That is a good foundation. What follows is not a rewrite — it is closing the
gap between that foundation and what an outside organisation needs on day
one. The gaps below are specific and were read out of the code, not guessed.

### 1.1 Bedrock is the flagship runtime and the worst-supported one

| Symptom | Where | Consequence for an adopter |
|---|---|---|
| AgentCore config **requires** `tokenUrl` / `clientId` / `clientSecret` (`readAgentCoreConfig` calls `cfg.getString(...)` for all three) | `module-agentcore/src/invoker.ts` | An organisation using plain IAM — the AWS default, and what IRSA/instance roles give you — cannot use the module at all. They must first stand up an OAuth inbound authorizer on every runtime. This is the single biggest adoption blocker. |
| Health is a generic `GET` on the `health`/`endpoint` annotation, gated by `probeAllowlist` (empty by default) | `backend/src/router.ts`, `client.ts` | AgentCore runtimes expose no public health URL. The flagship runtime's status badge is **permanently `unknown`**. |
| Invocation is a single `fetch` + `res.text()` with a 120s timeout | `module-agentcore/src/invoker.ts` | `InvokeAgentRuntime` returns NDJSON / `text/event-stream` and AgentCore supports 8-hour sessions. Request/response is structurally the wrong shape, and long runs simply time out. |
| `makeSessionId` pads to 33 characters "because AgentCore requires it" | `backend/src/invocation.ts` | A vendor constraint living in the vendor-neutral core. |
| The AWS CLI preview is built in the frontend behind `isAgentCoreRuntime` | `plugin-ai-agents/src/components/HireAgentDialog.tsx` | Every new runtime needs a patch to core frontend code to get its own "how do I run this by hand" hint. |

### 1.2 The data model does not scale past a handful of agents

- `ai-agent.io/hire-schema` is a **JSON array stringified into a YAML
  annotation**. It is unreadable in a `catalog-info.yaml`, unvalidated, and
  when malformed `parseHireSchema` swallows the error and returns `undefined`
  — the Hire button silently disappears with no explanation anywhere. This is
  the worst developer experience in the plugin.
- Nothing validates annotations at ingestion time. A typo surfaces as an empty
  card, never as a catalog entity error.
- No bridge to the formats agents already publish. An A2A agent exposes name,
  description, skills, capabilities and security schemes at
  `/.well-known/agent-card.json`; we make the author retype all of it.

### 1.3 Organisation-specific coupling

- The legacy `ai-agent.acarmisc.org/*` annotation prefix is still read in both
  frontend and backend.
- The README presents GitLab group discovery and Keycloak client-credentials
  as *the* setup, rather than as one example among several.
- Runtime labels and icons are a hardcoded map (`RuntimeBadge.tsx`) — a fifth
  runtime cannot be branded without a core patch.
- Zero i18n: `createTranslationRef` appears 0 times; every string is inline
  English.
- The frontend API client hardcodes `/api/ai-agents` instead of resolving via
  `discoveryApi`, which assumes app and backend share an origin.

### 1.4 Maintainability

- Custom esbuild build + `node --test` instead of `backstage-cli` + Jest. It
  works, but it locks us out of `backstage-cli repo fix`, the official
  codemods and version bumps, and it makes the repo unfamiliar to exactly the
  contributors we want.
- `router.ts` is 405 lines of hand-written Express with no OpenAPI schema.
- Permission coverage is partial: `POST /reviews/:ref` and `/statuses` never
  call `checkPermission`. Any authenticated user can write a review on any
  agent.
- The status cache is a per-process `Map`, so a multi-replica backend gives
  different answers depending on which pod you hit.

---

## 2. State of the art, September 2026

The landscape moved a long way in the twelve months this plugin has existed.

**AWS.** Bedrock AgentCore went GA in October 2025; Runtime, Memory, Gateway,
Identity and Observability are all generally available, with 8-hour execution
windows, session isolation and native A2A support. More importantly, **AWS
Agent Registry** is now GA under its own `agent-registry` namespace (the
preview `bedrock-agentcore` namespace is discontinued from 17 September 2026).
It offers organisation-wide auto-detection of AgentCore Runtimes and Gateways
across member accounts, hybrid semantic + keyword search, an approval and
curation workflow with EventBridge hooks, records validated against the **MCP
and A2A schemas**, and its own MCP endpoint for discovery.

**Standards.** A2A agent cards at `/.well-known/agent-card.json` are the de
facto description format, with curated registries as the explicitly
recommended enterprise discovery pattern. AGNTCY's Agent Directory Service and
OASF provide an open, federated, content-addressed alternative. OpenTelemetry
GenAI semantic conventions (`gen_ai.*` attributes, agent spans) are the
emerging tracing baseline — still in Development status, so worth *emitting*
and not yet worth *depending on*.

**Backstage.** The Actions Registry landed in 1.40 and `mcp-actions-backend`
exposes registered actions as MCP tools with namespaced ids and
`readOnly`/`destructive`/`idempotent` attributes. BackstageCon Europe 2026 was
largely about the catalog becoming something agents query and act on, not just
something humans browse.

**Competitors.** Every hyperscaler now ships an agent registry — Google's
Gemini Enterprise Agent Registry, Microsoft Agent 365, MuleSoft Agent Fabric,
AWS Agent Registry. All four are excellent, and all four are single-vendor.

### What this means for positioning

We should stop thinking of this plugin as a competitor to AWS Agent Registry
and start treating it as the layer above it.

> A vendor registry knows **what** exists inside its own cloud.
> Backstage knows **who owns it**, **why it exists**, **what breaks if it
> disappears**, and **which runbook to open at 3am**.

Concretely, the plugin's defensible position is:

1. **Multi-runtime by construction.** One page for Bedrock, kagent, Azure,
   Vertex, and the Lambda someone wrote last year. No vendor registry will
   ever do this.
2. **Ownership and lifecycle, not just inventory.** `spec.owner`,
   `spec.system`, `dependsOn` relations, TechDocs, on-call links — the things
   Backstage already does and registries do not.
3. **Federating, not duplicating.** AWS Agent Registry is a *source*, ingested
   through a catalog entity provider, not something to reimplement.
4. **Human and agent surface.** The same catalog is browsable by developers
   and queryable by agents over MCP.

---

## 3. Design principles for the evolution

1. **The core is vendor-neutral; providers carry the vendor knowledge.** If a
   feature needs an `if (runtime === 'x')` in core, the abstraction is wrong.
2. **Nothing is mandatory.** No database, no provider module, no AWS account —
   each missing piece degrades a feature, never breaks the page. This already
   holds and must keep holding.
3. **Progressive disclosure.** `spec.type: ai-agent` alone must produce a
   useful card. Every additional field earns its own increment of value.
4. **Never fail silently.** Every malformed input surfaces as a catalog entity
   error or a visible warning, never as a missing button.
5. **Standards in, standards out.** Ingest A2A agent cards; emit OTEL GenAI
   attributes; expose MCP tools. Do not invent a format where one exists.
6. **No organisation names in code, config keys, or defaults.**

---

## 4. The plan

Six phases. Each ships on its own and is independently useful — no phase
requires the next one to deliver value.

### Phase 0 — Neutralisation and toolchain (target v0.11)

Cheap, unblocking, and best done before the code grows.

- Migrate all packages to `backstage-cli package build` + Jest. Do it now,
  while there are four packages, not later when there are eight. Unlocks
  official codemods, version bumps, and contributor familiarity.
- Move the AWS CLI preview out of `HireAgentDialog` (see `reproduce()` in
  Phase 1). Until Phase 1 lands, gate it behind a provider-supplied hint
  rather than a runtime string comparison.
- Move the 33-character session-id padding out of core into the AgentCore
  module.
- Make the runtime badge registry data-driven: providers declare label, icon
  and docs URL; unknown runtimes render a neutral chip rather than nothing.
- Resolve the backend base path through `discoveryApi`.
- Deprecate `ai-agent.acarmisc.org/*`: keep reading it for one more minor,
  log a warning naming the entity, and remove it in v0.13.
- Split the 573-line README into `docs/` (`install`, `catalog-model`,
  `providers`, `operations`, `writing-a-provider`), leaving the README a
  landing page with screenshots. The sibling litellm plugin's README shows
  how much screenshots matter for adoption.
- Full permission coverage, including reviews, plus a worked
  `permissionPolicy` example in the docs.

### Phase 1 — SPI v2 and Bedrock as a first-class citizen (target v0.12)

The heart of the plan. `AgentInvoker` becomes `AgentRuntimeProvider`, and the
old interface stays as a deprecated adapter so existing third-party modules
keep working.

```ts
export interface AgentRuntimeProvider {
  /** Runtime keys handled, e.g. ['bedrock-agentcore']. */
  readonly runtimes: string[];

  /** UI metadata: label, icon, docs link. Kills the hardcoded badge map. */
  describe?(): RuntimeDescriptor;

  /** Provider-native health. Replaces the generic HTTP probe. */
  probe?(target: AgentTarget, ctx: ProviderContext): Promise<AgentStatus>;

  /** Pull agents from the provider's own registry (Phase 3). */
  discover?(ctx: ProviderContext): AsyncIterable<DiscoveredAgent>;

  /** "How do I run this by hand?" — CLI or HTTP, owned by the provider. */
  reproduce?(req: AgentInvocationRequest): ReproduceHint | undefined;

  invoke(
    req: AgentInvocationRequest,
    ctx: InvocationContext,
  ): Promise<AgentInvocationResponse>;
}

export interface InvocationContext {
  /** Cancellation: the user closed the dialog, or the request timed out. */
  signal: AbortSignal;
  /** Incremental output. A no-op when the caller is not streaming. */
  emit(chunk: AgentChunk): void;
  logger: LoggerService;
  /** For identity-aware / on-behalf-of auth. */
  credentials?: BackstageCredentials;
}

export type AgentChunk =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; status: 'started' | 'finished' }
  | { type: 'trace'; traceId: string }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number; costUsd?: number };
```

Each optional method removes a specific coupling that exists today:
`describe()` removes the hardcoded icon map, `probe()` fixes the permanently
unknown Bedrock status, `reproduce()` removes AWS from the frontend, and the
`usage` chunk turns the billing annotations from decoration into real numbers.

Alongside it:

- **AgentCore provider on the AWS SDK.** `@aws-sdk/client-bedrock-agentcore`
  gives SigV4, the full credential chain (IRSA, instance role, named profile,
  static keys), retries including `RetryableConflictException`, and native
  NDJSON streaming. The existing JWT client-credentials path stays as an
  explicitly configured alternative for inbound-OAuth setups.
- **Streaming endpoint.** `POST /invocations/:ref/stream` returning SSE, with
  the existing non-streaming endpoint kept for providers without it.
- **Persist usage.** Add `input_tokens`, `output_tokens`, `cost_usd`,
  `trace_id` to the `invocations` table via a migration.
- **Shared status cache** through `coreServices.cache` instead of a per-pod
  `Map`.

**Acceptance test for the whole phase:** a stock AWS account with an AgentCore
runtime and an EKS pod with IRSA can invoke an agent, stream the answer, and
see a real health badge — with no OAuth authorizer and no secrets in config.

### Phase 2 — A data model people can actually write (target v0.13)

Annotations stay fully supported. A typed `spec` becomes the pleasant path.

- **`AiAgentEntityProcessor`** in a new `catalog-backend-module-ai-agents`
  package: validates the annotation namespace, emits real entity errors for
  malformed `hire-schema`, unknown capability categories, unsafe URLs.
- **Optional typed spec** — readable YAML instead of embedded JSON:

  ```yaml
  spec:
    type: ai-agent
    owner: cs-ops
    aiAgent:
      runtime: bedrock-agentcore
      hireSchema:
        - name: project
          label: GitLab project
          type: text
          required: true
      promptTemplate: "Review MR !{target} in {project}."
  ```

  Precedence: `spec.aiAgent` wins over annotations; annotations remain the
  documented path for teams that cannot change their `spec`. Zero breaking
  change.
- **`hire-schema-ref`** for teams staying on annotations: point at a JSON file
  in the agent's own repo instead of inlining it.
- **Published JSON Schema** for the agent spec, usable in editors and CI.
- **A2A agent-card import**: given `/.well-known/agent-card.json`, derive
  name, description, skills → capabilities, and security scheme. Ships both as
  a scaffolder action and as optional processor enrichment.

### Phase 3 — Agents that appear by themselves (target v0.14)

Today every agent is a hand-written `catalog-info.yaml`. This is the phase
with the highest developer-experience payoff.

- **`-backend-module-aws-agent-registry`**: a catalog `EntityProvider` reading
  AWS Agent Registry. With Organizations auto-detection enabled, every
  AgentCore Runtime and Gateway across every member account lands in Backstage
  with no per-account setup. Map registry status → `spec.lifecycle`
  (`deprecated` records become deprecated entities), and account/tag → owner
  through a configurable mapping.
- **`AgentCoreEntityProvider`** as the fallback for organisations not on the
  registry yet: `ListAgentRuntimes` per configured region.
- **Generic `A2AEntityProvider`**: a list of agent-card URLs, or a discovery
  base, ingested as agents. This is what makes the feature portable rather
  than AWS-only.
- Provider-sourced entities are annotated with their origin and are
  read-only; locally authored entities always win, so an org can enrich an
  auto-detected agent without losing the enrichment on the next sync.

### Phase 4 — The portal as an agent control plane (target v0.15)

- **Expose agents as MCP tools** via the Actions Registry: each invocable
  agent becomes `ai-agents.invoke-<name>`, its input schema derived from the
  hire schema, marked non-`readOnly` and `destructive` where appropriate so
  clients prompt before running. Claude Code, Cursor and other agents can then
  discover and call the organisation's agents through Backstage's own MCP
  server, with Backstage's permissions in front.
- **Scaffolder template** "Create an AI agent" producing a valid
  `catalog-info.yaml`, plus an `ai-agents:register` action.
- **Relations**: an agent `dependsOn` the MCP servers, models and knowledge
  bases it uses, modelled as `Resource` entities. This is where the catalog
  earns its place over a flat registry — impact analysis, not a list.

### Phase 5 — Governance and FinOps (target v0.16+)

- Cost and usage rollups per owner and system, from the `usage` chunks.
- Budget enforcement: refuse invocation past the `budget` annotation, with a
  clear error rather than a surprise bill.
- Quality signals beyond the existing star rating: success rate and p95
  latency computed from the invocations table.
- Deep links from an invocation to its trace, using the `trace_id` captured in
  Phase 1 (AgentCore Observability is OTEL-compatible, so this generalises to
  any OTEL backend).
- Audit export for the invocations table.

### Cross-cutting, throughout

- **i18n** via `createTranslationRef` — a hard requirement for European
  adopters and cheap if done before the string count doubles.
- **OpenAPI schema** for the backend, with a generated client.
- **`examples/`**: a runnable Backstage app with sample agents and a
  `docker-compose` for the backend, so evaluating the plugin takes ten minutes
  and no AWS account.
- **Screenshots and a public demo** in the README.

---

## 5. An open decision: the npm scope

`@acarmisc/*` is a personal scope. Teams are measurably reluctant to take a
production dependency on one — it reads as a side project regardless of the
code quality. Options, in increasing order of effort:

1. Keep the scope, add clear governance signals (CODEOWNERS, release policy,
   security policy, support statement). Cheapest, least effective.
2. Move to a neutral GitHub org and npm scope, publishing the old names as
   deprecated aliases for two minors.
3. Propose it to the Backstage community plugins repository.

This does not block any phase, but it should be decided before Phase 3, since
that is when adopters start wiring the plugin into their catalog ingestion —
the point at which a rename becomes genuinely expensive.

---

## 6. What this plan deliberately does not do

- **Build an agent runtime.** We invoke agents; we never host them.
- **Reimplement AWS Agent Registry.** We federate it.
- **Become an observability product.** We link to traces; we do not store them.
- **Add agent CRUD.** Agents are created through the normal catalog workflow —
  YAML in the agent's own repository, or a provider. This has been a stated
  design decision since v0.1 and remains correct.
- **Chase OTEL GenAI conventions as a hard dependency.** They are still in
  Development status. Emit them, do not build load-bearing features on them.

---

## 7. How we will know it worked

| Signal | Today | Target |
|---|---|---|
| Time from "npm install" to first agent card, no AWS account | unmeasured, high | under 15 minutes with `examples/` |
| Bedrock agents showing a real health status | 0% (always `unknown`) | ~100% via provider `probe()` |
| Lines of core code that mention a specific vendor | several, in frontend and core backend | 0 |
| Runtimes supported without patching core | 0 — icons and CLI preview need core edits | unbounded |
| Agents ingested without hand-written YAML | 0 | majority, via Phase 3 providers |
| External contributors able to run the test suite unmodified | uncertain — non-standard toolchain | standard `backstage-cli` flow |

---

## 8. Suggested order of attack

Phase 0 and Phase 1 are the ones that change the plugin's character: after
them, Bedrock works for anyone with an AWS account, and adding a runtime never
touches core. Phase 3 is the biggest single DX win but depends on the
`discover()` hook from Phase 1. Phase 2 can run in parallel with either, since
it touches the catalog side rather than the invocation side.

If only one thing ships this quarter, it should be **Phase 1**.
