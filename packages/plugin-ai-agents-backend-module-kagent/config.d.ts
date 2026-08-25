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
         * Static Authorization header injected into every A2A request, if
         * the controller sits behind something that requires one.
         * @visibility secret
         */
        authHeader?: string;
        /** Per-invocation timeout in milliseconds. @default 120000 */
        timeoutMs?: number;
      };
    };
  };
}
