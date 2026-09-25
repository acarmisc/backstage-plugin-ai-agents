import '../setupTests';
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { createVersionedContextForTesting } from '@backstage/version-bridge';
import { aiAgentsApiRef } from '../api';
import { useAvatarSrc } from './useAvatarBlob';

const apiContext = createVersionedContextForTesting('api-context');
const CONTEXT_KEY = '__@backstage/api-context__';

function installHolder(holder: unknown) {
  apiContext.set({ 1: holder } as any);
  // version-bridge resolves its global through the jsdom window when one
  // exists, while the testing helper writes to Node's globalThis — mirror
  // the context onto both so useApi finds it either way.
  const ctx = (globalThis as any)[CONTEXT_KEY];
  if (typeof window !== 'undefined') {
    (window as any)[CONTEXT_KEY] = ctx;
  }
}

function resetHolder() {
  apiContext.reset();
  if (typeof window !== 'undefined') {
    delete (window as any)[CONTEXT_KEY];
  }
}

afterEach(() => {
  cleanup();
  resetHolder();
});

let blobCounter = 0;
let createObjectURLCalls = 0;

beforeEach(() => {
  blobCounter = 0;
  createObjectURLCalls = 0;
  (globalThis.URL as any).createObjectURL = (_blob: Blob) => {
    createObjectURLCalls++;
    blobCounter++;
    return `blob:http://localhost/mock-${blobCounter}`;
  };
});

function stubApi(blobs: Record<string, Blob | undefined>) {
  const calls: string[] = [];
  // One stable impl object, like Backstage's real ApiHolder which caches
  // instances: useApi returns a new identity per render otherwise, and the
  // hook would refetch on every render.
  const apiImpl = {
    getAvatar: async (entityRef: string) => {
      calls.push(entityRef);
      return blobs[entityRef];
    },
  };
  installHolder({
    get: (ref: unknown) => (ref === aiAgentsApiRef ? apiImpl : undefined),
  });
  return calls;
}

function Probe({
  entityRef,
  avatarUrl,
}: {
  entityRef: string | undefined;
  avatarUrl: string | undefined;
}) {
  const src = useAvatarSrc(entityRef, avatarUrl);
  return <span data-testid="src">{src ?? '(none)'}</span>;
}

function renderProbe(
  entityRef: string | undefined,
  avatarUrl: string | undefined,
) {
  return render(<Probe entityRef={entityRef} avatarUrl={avatarUrl} />);
}

const srcOf = (container: HTMLElement) =>
  container.querySelector('[data-testid="src"]')?.textContent;

test('returns data: and relative URLs directly without touching the proxy', async () => {
  const calls = stubApi({});
  const { container } = renderProbe(
    'component:default/hook-direct',
    'data:image/png;base64,iVBORw0KGgo=',
  );
  assert.equal(srcOf(container), 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(calls.length, 0, 'proxy must not be consulted');

  cleanup();
  const rel = renderProbe('component:default/hook-rel', '/img/a.png');
  assert.equal(srcOf(rel.container), '/img/a.png');
  assert.equal(calls.length, 0, 'proxy must not be consulted');
});

test('fetches http(s) avatars through the proxy and shares the blob', async () => {
  const blob = new Blob(['fake-png'], { type: 'image/png' });
  const calls = stubApi({ 'component:default/hook-share': blob });
  const first = renderProbe(
    'component:default/hook-share',
    'https://git.example.com/a.png',
  );
  // While the proxy fetch is in flight the direct URL is shown.
  assert.equal(srcOf(first.container), 'https://git.example.com/a.png');
  await waitFor(() =>
    assert.match(srcOf(first.container) ?? '', /^blob:http:\/\/localhost\/mock-/),
  );
  assert.equal(calls.length, 1);

  // A second mount for the same agent reuses the cached blob, no refetch.
  cleanup();
  const second = renderProbe(
    'component:default/hook-share',
    'https://git.example.com/a.png',
  );
  assert.match(srcOf(second.container) ?? '', /^blob:http:\/\/localhost\/mock-/);
  assert.equal(calls.length, 1, 'cached blob must be reused');
  assert.equal(createObjectURLCalls, 1, 'object URL minted once');
});

test('switching agents clears the stale blob instead of flashing it', async () => {
  const blobA = new Blob(['a'], { type: 'image/png' });
  const blobB = new Blob(['b'], { type: 'image/png' });
  const calls = stubApi({
    'component:default/hook-old': blobA,
    'component:default/hook-new': blobB,
  });
  const rendered = renderProbe(
    'component:default/hook-old',
    'https://git.example.com/old.png',
  );
  await waitFor(() =>
    assert.match(srcOf(rendered.container) ?? '', /^blob:http:\/\/localhost\/mock-/),
  );
  const oldSrc = srcOf(rendered.container);

  // Reuse the same hook instance for a different agent (e.g. list
  // re-render): the old agent's blob must disappear immediately, not linger
  // until the new fetch resolves.
  rendered.rerender(
    <Probe
      entityRef="component:default/hook-new"
      avatarUrl="https://git.example.com/new.png"
    />,
  );
  assert.notEqual(
    srcOf(rendered.container),
    oldSrc,
    'stale blob of the previous agent must be cleared',
  );
  await waitFor(() =>
    assert.match(srcOf(rendered.container) ?? '', /^blob:http:\/\/localhost\/mock-/),
  );
  assert.notEqual(srcOf(rendered.container), oldSrc);
  assert.deepEqual(calls, [
    'component:default/hook-old',
    'component:default/hook-new',
  ]);
});

test('proxy failure falls back to the direct URL', async () => {
  const calls = stubApi({ 'component:default/hook-fail': undefined });
  const { container } = renderProbe(
    'component:default/hook-fail',
    'https://git.example.com/missing.png',
  );
  await waitFor(() =>
    assert.equal(calls.length, 1, 'proxy attempted once'),
  );
  assert.equal(
    srcOf(container),
    'https://git.example.com/missing.png',
    'direct URL returned so public URLs keep working',
  );
});
