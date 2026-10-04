# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents-backend-module-langfuse`
are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- The published package no longer contains compiled tests, nor the
  unbundled per-file JavaScript `tsc` emitted next to the bundle (the entry
  point is the self-contained `dist/index.cjs.js`).

## [0.3.0] - 2026-10-03

### Changed

- **BREAKING** The defaults no longer assume one particular deployment.
  `servicePrefix` defaults to `""` (was `abs_ces_agents_`), and the service
  name is read from `resourceAttributes.service.name` (was
  `resourceAttributes.aws.local.service`), configurable with
  `serviceAttribute`. Run target and project are only shown when
  `targetAttribute` / `projectAttribute` are set (they were read from
  `attributes.ces.agent.target` / `.project`), and numeric targets are no
  longer shown as `!<number>`. To keep the previous behaviour, set:

  ```yaml
  ai-agents:
    telemetry:
      langfuse:
        servicePrefix: abs_ces_agents_
        serviceAttribute: resourceAttributes.aws.local.service
        targetAttribute: attributes.ces.agent.target
        projectAttribute: attributes.ces.agent.project
  ```

- README rewritten for the npm page.

## [0.2.1] - 2026-10-03

### Changed

- Internal cleanup: `getInsights` reuses the run classification and filters
  of `getRuns`. No behavior change.

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
