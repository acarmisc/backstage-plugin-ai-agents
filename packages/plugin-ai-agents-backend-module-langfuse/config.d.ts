export interface Config {
  'ai-agents'?: {
    telemetry?: {
      langfuse?: {
        /** Langfuse base URL, e.g. `https://langfuse.example.com`. */
        baseUrl: string;
        /** Project public key. Use a dedicated read-only key. */
        publicKey: string;
        /** @visibility secret */
        secretKey: string;
        /** How far back runs are searched, in hours. @default 24 */
        lookbackHours?: number;
        /**
         * A trace with tool calls but no `<agent>-invoke` span yet is reported
         * as `running` while its last tool ended less than this many seconds ago.
         * @default 90
         */
        runningWindowSeconds?: number;
        /**
         * Prepended to the entity's `telemetry-id` to match the agent's OTel
         * service name, e.g. `agents_` matches `agents_<id>...`.
         * @default ""
         */
        servicePrefix?: string;
        /**
         * Observation metadata key that holds the OTel service name.
         * @default "resourceAttributes.service.name"
         */
        serviceAttribute?: string;
        /** Metadata key of the invoke span shown as the run's target. Unset: not shown. */
        targetAttribute?: string;
        /** Metadata key of the invoke span shown as the run's project. Unset: not shown. */
        projectAttribute?: string;
        /** Server-side cache for Langfuse queries, in ms. @default 4000 */
        cacheTtlMs?: number;
      };
    };
  };
}
