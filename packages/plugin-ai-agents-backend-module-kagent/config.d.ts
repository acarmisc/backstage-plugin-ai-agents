export interface Config {
  'ai-agents'?: {
    invocations?: {
      kagent?: {
        /**
         * Base URL of the kagent controller's A2A HTTP server (the same
         * port the kagent UI/CLI talk to), e.g.
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
         * Authorization header sent with A2A requests to `baseUrl`'s origin.
         * Never sent to an agent's `endpoint` annotation on another origin.
         * @visibility secret
         */
        authHeader?: string;
        /** Per-invocation timeout in milliseconds. @default 120000 */
        timeoutMs?: number;
      };
    };
  };
}
