# Operations

## How Backstage discovers agents (GitLab)

Discovery is **automatic** — you do not register each agent manually. The
Backstage backend runs the `@backstage/plugin-catalog-backend-module-gitlab`
module, which periodically scans configured GitLab groups for
`catalog-info.yaml` files.

### The flow

1. **You commit `catalog-info.yaml`** to the repo root on the default branch
   of a project in a configured GitLab group.

2. **Every 30 minutes** the GitLab catalog provider lists all projects in
   the configured groups (using the `GITLAB_TOKEN` from
   `integrations.gitlab`), and for each project fetches
   `catalog-info.yaml` from the default branch.

3. The provider parses the YAML. Because `catalog.rules` allows `Component`
   and the entity is `kind: Component` with `spec.type: ai-agent`, it is
   ingested into the catalog. The `gitlab.com/project-slug` annotation (or
   the provider's auto-detection) links the entity to its GitLab repo.

4. **The AI Agents frontend** calls
   `catalogApi.getEntities({ filter: { kind: 'Component', 'spec.type': 'ai-agent' } })`
   — a standard catalog query, no custom discovery. It returns every
   ingested agent entity, mapped by `entityToAgent()` into the card data.

5. **The backend status prober** resolves each agent's entity ref via the
   catalog service token, reads its `ai-agent.io/health` (or
   `endpoint`) annotation, and probes it for live status.

### Configuring discovery

Discovery is configured in `app-config.production.yaml` under
`catalog.providers.gitlab`. One provider per GitLab group:

```yaml
catalog:
  providers:
    gitlab:
      agents:                             # ← provider name (arbitrary)
        host: ${GITLAB_HOST}              # e.g. gitlab.example.com
        group: ${GITLAB_GROUP}            # e.g. "my-org-agents"
        entityFilename: catalog-info.yaml # ← the file it looks for in every repo
        projectPattern: '[\s\S]*'         # matches every project in the group
        schedule:
          frequency: { minutes: 30 }      # re-scan interval
          timeout: { minutes: 3 }
          initialDelay: { seconds: 60 }   # staggered across providers at boot
```

To cover a new group, add another block under `catalog.providers.gitlab`
with the group name and redeploy. The `projectPattern: '[\s\S]*'` already
matches every project, so no per-repo allowlist is needed.

### Checking discovery is working

- **Backstage UI**: Catalog → search for the agent name. If it appears in
  the catalog, the plugin will show it on `/ai-agents`.
- **Backend API** (auth required):
  `GET /api/catalog/entities?filter=kind=component,spec.type=ai-agent`
  returns all ingested agents.
- **Logs**: the catalog provider logs each scanned location and any parse
  errors at `info`/`warn` level under the `catalog` logger.

### Troubleshooting discovery

| Symptom | Cause / Fix |
|---|---|
| Agent doesn't appear in the catalog | The repo is not in a configured GitLab group, or `catalog-info.yaml` is not at the repo root on the default branch. Add the group to `catalog.providers.gitlab` and redeploy, or move the file. |
| Agent appears in Catalog but not on `/ai-agents` | `spec.type` is not exactly `ai-agent`. The filter is case-sensitive. |
| Status badge stays `unknown` | No `ai-agent.io/health` or `endpoint` annotation, or the URL is not in `ai-agents.probeAllowlist`, or the backend is disabled (`ai-agents.enabled: false`). |
| Status badge shows `down` with `fetch failed` | The health/endpoint URL is unreachable from the Backstage backend (network policy, DNS, or the agent is offline). Check the URL from inside the cluster. |
| Card shows no capabilities / billing | The corresponding annotations are missing or malformed. Capabilities use `label:category` pairs separated by commas or newlines. |

## API endpoints

All under `/api/ai-agents`, all Backstage-auth-authenticated:

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | `{ status: 'ok', enabled }` |
| `/statuses?refs=ref1,ref2` | GET | Live status for the given agent entity refs |
| `/status/:entityRef` | GET | Single agent status (used by the drawer's Refresh button) |
| `/invocations/:entityRef` | POST | Run the agent (Hire Agent). Body: `{ values: { field: value, ... } }`. Requires an invoker module; responds 501 otherwise |
| `/invocations/:entityRef` | GET | Invocation history for the agent (latest first, `?limit=` up to 100). Requires a database |
| `/reviews/:entityRef` | POST | Submit a review. Body: `{ rating: 0-5, comment? }`. Requires a database |
| `/reviews/:entityRef` | GET | Reviews + count + average rating (`?limit=` up to 100). Requires a database |

## Permissions

The backend plugin gates write operations on AI agents with Backstage's permission system. When a permissions service is configured, all authenticated users must be granted the relevant permission to perform these actions; when no permissions service is configured, all operations are allowed.

| Permission | Action | Description |
|---|---|---|
| `ai-agent.invoke` | `update` | Required to invoke (run) an agent |
| `ai-agent.history.read` | `read` | Required to view an agent's invocation history |
| `ai-agent.review.write` | `create` | Required to submit a review (rating + comment) on an agent |

## Agent reviews

Users can rate an agent from 0 to 5 stars and leave an optional comment.
Reviews appear in the agent detail drawer and on the entity-page overview
card. The backend persists them in the plugin database (`agent_reviews`
table) and attributes them to the authenticated user.

Two star widgets ship in `StarRating`:

- `simple` — compact read-mostly stars (review list, average display).
- `fancy` — large interactive stars with hover animation and
  Poor→Excellent labels (the "Rate this agent" form).

The section hides itself when no database is configured (the endpoints
respond 501).

## Releasing

Both packages are published to npm via GitHub Actions on tag push. The
workflow lives in `.github/workflows/publish.yaml`.

### Cut a release

```bash
# 1. Bump the version in the package you're releasing
$EDITOR packages/plugin-ai-agents/package.json          # or plugin-ai-agents-backend
# e.g. "version": "0.2.0"

# 2. Commit and push to main
git commit -am "release: ai-agents vX.Y.Z"
git push origin main

# 3. Tag and push — the tag name determines which package is published
git tag ai-agents@X.Y.Z          # frontend → @acarmisc/backstage-plugin-ai-agents
git push origin ai-agents@X.Y.Z
# or, for the backend:
git tag ai-agents-backend@X.Y.Z
git push origin ai-agents-backend@X.Y.Z
```

### What the workflow does

1. Verifies the tag version matches the package's `package.json` version
   (prevents publishing the wrong version).
2. Installs with `--legacy-peer-deps`, builds, runs `npm publish --access
   public` using the `NPM_TOKEN` repo secret.
3. Auto-creates a GitHub Release with generated release notes.

### Tag conventions

| Tag pattern | Package published |
|---|---|
| `ai-agents@<version>` | `@acarmisc/backstage-plugin-ai-agents` |
| `ai-agents-backend@<version>` | `@acarmisc/backstage-plugin-ai-agents-backend` |

The version in the tag **must** match the `version` field in the
corresponding `package.json`, or the workflow fails fast.
