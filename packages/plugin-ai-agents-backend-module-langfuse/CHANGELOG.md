# Changelog

All notable changes to `@acarmisc/backstage-plugin-ai-agents-backend-module-langfuse`
are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - Unreleased

- Initial version: Langfuse `TelemetryProvider` for the run timeline. Reads
  `<agent>-invoke` AGENT and TOOL observations from the public observations
  API (core/basic/metadata fields only), reports finished, failed and running
  runs, and exposes risk/posting verdicts from `review_quality`.
  Requires `@acarmisc/backstage-plugin-ai-agents-backend` with
  `registerTelemetryProvider`.
