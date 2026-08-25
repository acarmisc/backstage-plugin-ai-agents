export interface Config {
  'ai-agents'?: {
    /** Enable live status probing. Default true when the backend is registered. */
    enabled?: boolean;
    /** Per-probe timeout in milliseconds. @default 3000 */
    probeTimeoutMs?: number;
    /** In-memory status cache TTL in milliseconds. @default 15000 */
    statusCacheTtlMs?: number;
    /**
     * Optional static Authorization header injected into every probe request
     * (for agents behind an API gateway). Never logged.
     * @visibility secret
     */
    probeAuthHeader?: string;
    /**
     * Allowlist of allowed probe URL origin globs. Empty means no probing
     * occurs (deny by default). Probing requires explicit allowlist entries.
     * Use to restrict what the backend will fetch on behalf of users.
     */
    probeAllowlist?: string[];
    invocations?: {
      /** Enable the POST /invocations endpoint. Default true. */
      enabled?: boolean;
      agentCore?: {
        /**
         * OAuth2 token endpoint issuing JWTs accepted by the AgentCore
         * runtimes (e.g. a Keycloak client_credentials endpoint).
         * @visibility secret
         */
        tokenUrl: string;
        clientId: string;
        /**
         * Client secret for the token endpoint.
         * @visibility secret
         */
        clientSecret: string;
        /** Default AWS region; the entity's region annotation overrides it. */
        region: string;
        /**
         * AWS account id, used to build the runtime ARN when the
         * runtime-handle annotation carries a bare runtime id instead of a
         * full ARN.
         */
        accountId?: string;
        /** Per-invocation timeout in milliseconds. @default 120000 */
        timeoutMs?: number;
      };
      kagent?: {
        /**
         * Base URL of the kagent controller's A2A HTTP server, e.g.
         * `http://kagent-controller.kagent.svc.cluster.local:8083`. The
         * entity's `endpoint` annotation overrides it per agent.
         */
        baseUrl: string;
        /**
         * Default Kubernetes namespace agents live in; the entity's
         * `namespace` annotation overrides it.
         * @default "kagent"
         */
        namespace?: string;
        /**
         * Static Authorization header injected into every A2A request.
         * @visibility secret
         */
        authHeader?: string;
        /** Per-invocation timeout in milliseconds. @default 120000 */
        timeoutMs?: number;
      };
    };
  };
}