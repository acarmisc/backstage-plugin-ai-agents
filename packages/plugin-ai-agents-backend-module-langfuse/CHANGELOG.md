# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents-backend-module-langfuse`
are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-10-03

### Added

- `getInsights`: totals, nearest-rank p50/p95 run duration, hourly histogram and
  per-tool calls / errors / avg / p95 computed from the invoke and TOOL
  observations (same privacy rules: core, basic and metadata fields only).
- Requires `@acarmisc/backstage-plugin-ai-agents-backend` `^0.9.3`.

## [0.1.0] - 2026-10-03

- Initial version: Langfuse `TelemetryProvider` for the run timeline. Reads
  `<agent>-invoke` AGENT and TOOL observations from the public observations
  API (core/basic/metadata fields only), reports finished, failed and running
  runs, and exposes risk/posting verdicts from `review_quality`.
  Requires `@acarmisc/backstage-plugin-ai-agents-backend` with
  `registerTelemetryProvider`.
