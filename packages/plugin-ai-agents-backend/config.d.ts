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
    /** Proxy `http(s)` avatars through the backend with integration credentials. */
    avatarProxy?: {
      /** @default false */
      enabled?: boolean;
      /** Allowed avatar URL origin globs; off-list URLs are redirected to directly. */
      allowlist?: string[];
      /** Positive cache lifetime in milliseconds. @default 86400000 */
      ttlMs?: number;
      /** Negative (failed fetch) cache lifetime in milliseconds. @default 3600000 */
      negativeTtlMs?: number;
      /** Largest avatar accepted, in bytes. @default 524288 */
      maxBytes?: number;
    };
    invocations?: {
      /** Enable the POST /invocations endpoint. Default true. */
      enabled?: boolean;
    };
  };
}
