import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigReader } from '@backstage/config';
import {
  integrationOrigins,
  readAvatarProxyConfig,
  createLocalStore,
} from './avatar';
import { isAllowed } from './client';

const integrations = {
  gitlab: [
    {
      host: 'gitlab.example.com',
      apiBaseUrl: 'https://gitlab.example.com/api/v4',
      token: 't',
    },
  ],
  github: [{ host: 'github.com' }],
  gerrit: [{ host: 'gerrit.example.com', baseUrl: 'http://gerrit:8080/r' }],
};

test('integrationOrigins lists every integration host and baseUrl origin', () => {
  const origins = integrationOrigins(new ConfigReader({ integrations }));
  assert.deepEqual(origins.sort(), [
    'http://gerrit:8080',
    'https://gerrit.example.com',
    'https://github.com',
    'https://gitlab.example.com',
  ]);
});

test('integrationOrigins is empty without integrations', () => {
  assert.deepEqual(integrationOrigins(new ConfigReader({})), []);
});

test('avatar proxy is on by default and allows the integration hosts', () => {
  const cfg = readAvatarProxyConfig(new ConfigReader({ integrations }));
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.maxBytes, 2_097_152);
  assert.ok(
    isAllowed(
      'https://gitlab.example.com/g/p/-/raw/main/avatar.jpg',
      cfg.allowlist,
    ),
  );
  assert.ok(!isAllowed('https://evil.example.com/a.png', cfg.allowlist));
});

test('an explicit avatarProxy config overrides the defaults', () => {
  const cfg = readAvatarProxyConfig(
    new ConfigReader({
      integrations,
      'ai-agents': {
        avatarProxy: {
          enabled: false,
          allowlist: ['https://cdn.example.com'],
          maxBytes: 1000,
        },
      },
    }),
  );
  assert.equal(cfg.enabled, false);
  assert.deepEqual(cfg.allowlist, ['https://cdn.example.com']);
  assert.equal(cfg.maxBytes, 1000);
});

test('local avatar store caps entries and evicts the oldest', async () => {
  const store = createLocalStore();
  const expiresAt = Date.now() + 86_400_000;
  for (let i = 0; i < 501; i++) {
    await store.set(
      `k${i}`,
      {
        contentType: 'image/png',
        data: '',
        expiresAt,
      },
      86_400_000,
    );
  }
  assert.equal(await store.get('k0'), undefined);
  assert.ok(await store.get('k500'));
  let present = 0;
  for (let i = 0; i < 501; i++) {
    if (await store.get(`k${i}`)) present++;
  }
  assert.equal(present, 500);
});
