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
         * OTel service-name prefix of the agents, followed by the catalog
         * `telemetry-id`. @default "abs_ces_agents_"
         */
        servicePrefix?: string;
        /** Server-side cache for Langfuse queries, in ms. @default 4000 */
        cacheTtlMs?: number;
      };
    };
  };
}
