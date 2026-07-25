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
     * Allowlist of allowed probe URL origin globs. Empty means allow all
     * http(s) URLs. Use to restrict what the backend will fetch on behalf
     * of users.
     */
    probeAllowlist?: string[];
  };
}