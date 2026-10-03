// Test-only helper: version-bridge is a devDependency.
// eslint-disable-next-line @backstage/no-undeclared-imports
import { createVersionedContextForTesting } from '@backstage/version-bridge';
import { aiAgentsApiRef } from '../api';

const apiContext = createVersionedContextForTesting('api-context');
const CONTEXT_KEY = '__@backstage/api-context__';

/** Install a stable stub of the ai-agents API for `useApi` (jsdom-aware). */
export function installApi(apiImpl: Record<string, unknown>): void {
  apiContext.set({
    1: {
      get: (ref: unknown) => (ref === aiAgentsApiRef ? apiImpl : undefined),
    },
  } as any);
  const ctx = (globalThis as any)[CONTEXT_KEY];
  if (typeof window !== 'undefined') (window as any)[CONTEXT_KEY] = ctx;
}

export function resetApi(): void {
  apiContext.reset();
  if (typeof window !== 'undefined') delete (window as any)[CONTEXT_KEY];
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new window.Event('visibilitychange'));
}
