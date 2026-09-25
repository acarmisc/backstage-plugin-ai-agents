import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AgentAvatar } from './AgentAvatar';

afterEach(cleanup);

test('renders initials on a tinted circle when no avatarUrl is given', () => {
  const { container } = render(<AgentAvatar name="support-triage-agent" />);
  assert.equal(container.querySelectorAll('img').length, 0);
  assert.match(container.textContent ?? '', /SA/);
  const box = container.firstElementChild as HTMLElement;
  assert.equal(box.getAttribute('role'), 'img');
  assert.equal(box.getAttribute('aria-label'), 'support-triage-agent');
});

test('splits camelCase names when deriving initials', () => {
  const { container } = render(<AgentAvatar name="kbSearchAgent" />);
  assert.match(container.textContent ?? '', /KA/);
});

test('renders the image when avatarUrl is a safe URL', () => {
  const { container } = render(
    <AgentAvatar name="triage" avatarUrl="https://example.com/a.png" />,
  );
  const img = container.querySelector('img');
  assert.ok(img, 'image should render');
  assert.equal(img?.getAttribute('src'), 'https://example.com/a.png');
  assert.equal(img?.getAttribute('loading'), 'lazy');
  assert.equal(img?.getAttribute('decoding'), 'async');
  assert.equal(img?.getAttribute('referrerpolicy'), 'no-referrer');
  // The img is decorative: the wrapper carries the accessible name.
  assert.equal(img?.getAttribute('alt'), '');
});

test('supports relative paths and image data: URIs', () => {
  const { container: withPath } = render(
    <AgentAvatar name="triage" avatarUrl="/img/agents/triage.png" />,
  );
  assert.ok(withPath.querySelector('img'), 'relative path should render');

  const { container: withData } = render(
    <AgentAvatar name="triage" avatarUrl="data:image/png;base64,iVBORw0KGgo=" />,
  );
  assert.ok(withData.querySelector('img'), 'data: URI should render');
});

test('a URL that errored once is never requested again', () => {
  const url = 'https://example.com/dead-avatar.png';
  const first = render(<AgentAvatar name="triage" avatarUrl={url} />);
  const img = first.container.querySelector('img');
  assert.ok(img, 'image should render initially');

  fireEvent.error(img!);
  assert.equal(
    first.container.querySelector('img'),
    null,
    'image should disappear after the error',
  );

  // A fresh mount with the same URL (e.g. opening the detail drawer) must
  // not re-request the dead URL: the initials fallback shows instead.
  const second = render(<AgentAvatar name="triage" avatarUrl={url} />);
  assert.equal(
    second.container.querySelector('img'),
    null,
    'broken URL must be remembered across mounts',
  );
  assert.match(second.container.textContent ?? '', /TR/);
});

test('renders proxied avatars served as blob: object URLs', () => {
  const { container } = render(
    <AgentAvatar name="triage" avatarUrl="blob:http://localhost/1234-abcd" />,
  );
  const img = container.querySelector('img');
  assert.ok(img, 'blob: URL from the avatar proxy should render');
  assert.equal(img?.getAttribute('src'), 'blob:http://localhost/1234-abcd');
});

test('rejects unsafe avatar URLs and falls back to initials', () => {
  const { container } = render(
    <AgentAvatar
      name="invoice-reader"
      // eslint-disable-next-line no-script-url
      avatarUrl="javascript:alert(1)"
    />,
  );
  assert.equal(container.querySelectorAll('img').length, 0);
  assert.match(container.textContent ?? '', /IR/);
});
