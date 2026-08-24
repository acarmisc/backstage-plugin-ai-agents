# Security

## Supported versions

Only the latest published version of each package receives security updates:

- `@acarmisc/backstage-plugin-ai-agents` (frontend)
- `@acarmisc/backstage-plugin-ai-agents-backend`
- `@acarmisc/backstage-plugin-ai-agents-backend-module-agentcore`

This is a small, solo-maintained OSS plugin with no backport or LTS policy. For security fixes, update to the latest release.

## Reporting a vulnerability

Please use [GitHub's private vulnerability reporting](https://github.com/acarmisc/backstage-plugin-ai-agents/security/advisories) (GitHub Security tab → "Report a vulnerability"). This keeps discussions private until a fix is ready.

Expect best-effort acknowledgment and patching, but no SLA guarantee. As a solo-maintained project, response time depends on my availability.

## Known risk areas

When reviewing security reports, please pay special attention to these areas:

1. **Backend status probing (SSRF surface)**
   - The backend probes URLs from entity annotations: `GET /statuses`, `GET /status/:entityRef` in `packages/plugin-ai-agents-backend/src/router.ts`
   - URLs come from catalog-sourced `ai-agent.io/health` and `ai-agent.io/endpoint` annotations
   - An allowlist (`ai-agents.probeAllowlist`) can restrict destinations; empty list allows all http(s)
   - Hardening is in progress, but catalog-sourced server-side URL fetches warrant careful review

2. **Missing permission node integration**
   - The plugin does not yet integrate with `@backstage/plugin-permission-node`
   - Anyone with access to invoke `/api/ai-agents` routes can invoke agents and read invocation history for any entity
   - This is a known gap being actively worked on; not a "fixed" concern
