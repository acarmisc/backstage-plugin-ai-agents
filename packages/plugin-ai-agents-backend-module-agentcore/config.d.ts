export interface Config {
  'ai-agents'?: {
    invocations?: {
      agentCore?: {
        /**
         * OAuth2 token endpoint issuing JWTs accepted by the AgentCore
         * runtimes (e.g. a Keycloak client_credentials endpoint).
         */
        tokenUrl: string;
        clientId: string;
        /** Client secret for the token endpoint. @visibility secret */
        clientSecret: string;
        /** Default AWS region; the entity's region annotation overrides it. */
        region: string;
        /**
         * AWS account id, used to build the runtime ARN when the
         * runtime-handle annotation carries a bare runtime id.
         */
        accountId?: string;
        /** Per-invocation timeout in milliseconds. @default 120000 */
        timeoutMs?: number;
      };
    };
  };
}
