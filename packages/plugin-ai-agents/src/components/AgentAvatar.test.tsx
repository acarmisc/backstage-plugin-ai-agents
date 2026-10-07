import '../setupTests';
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { AgentAvatar } from './AgentAvatar';
import { installImageStub } from '../__fixtures__/imageStub';

let restoreImage: () => void;
beforeEach(() => {
  restoreImage = installImageStub(src => src.includes('dead'));
});
afterEach(() => {
  cleanup();
  restoreImage();
});

test('renders initials when no avatarUrl is given', () => {
  const { container } = render(<AgentAvatar name="support-triage-agent" />);
  assert.equal(container.querySelectorAll('img').length, 0);
  assert.match(container.textContent ?? '', /SA/);
  const wrapper = container.firstElementChild as HTMLElement;
  assert.equal(wrapper.getAttribute('role'), 'img');
  assert.equal(wrapper.getAttribute('aria-label'), 'support-triage-agent');
});

test('splits camelCase names when deriving initials', () => {
  const { container } = render(<AgentAvatar name="kbSearchAgent" />);
  assert.match(container.textContent ?? '', /KA/);
});

test('uses two letters for a single-word name', () => {
  const { container } = render(<AgentAvatar name="triage" />);
  assert.match(container.textContent ?? '', /TR/);
});

test('shows initials while loading, then the image', async () => {
  const { container } = render(
    <AgentAvatar name="triage" avatarUrl="https://example.com/a.png" />,
  );
  assert.match(container.textContent ?? '', /TR/);
  await waitFor(() => assert.ok(container.querySelector('img')));
  const img = container.querySelector('img');
  assert.equal(img?.getAttribute('src'), 'https://example.com/a.png');
  // The image is decorative: the wrapper carries the accessible name.
  assert.equal(img?.getAttribute('alt'), '');
});

test('supports relative paths, image data: URIs and blob: URLs', async () => {
  for (const url of [
    '/img/agents/triage.png',
    'data:image/png;base64,iVBORw0KGgo=',
    'blob:http://localhost/1234-abcd',
  ]) {
    const { container, unmount } = render(
      <AgentAvatar name="triage" avatarUrl={url} />,
    );
    await waitFor(() => assert.ok(container.querySelector('img'), url));
    assert.equal(container.querySelector('img')?.getAttribute('src'), url);
    unmount();
  }
});

test('falls back to initials when the image fails to load', async () => {
  const { container } = render(
    <AgentAvatar name="triage" avatarUrl="https://example.com/dead.png" />,
  );
  // Give the failing load time to settle; the initials must remain.
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(container.querySelector('img'), null);
  assert.match(container.textContent ?? '', /TR/);
});

test('rejects unsafe avatar URLs and shows initials', async () => {
  const { container } = render(
    <AgentAvatar
      name="invoice-reader"
      // eslint-disable-next-line no-script-url
      avatarUrl="javascript:alert(1)"
    />,
  );
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(container.querySelectorAll('img').length, 0);
  assert.match(container.textContent ?? '', /IR/);
});

test('maps the requested pixel size to the nearest BUI avatar size', () => {
  const sizes: Record<number, string> = {
    20: 'x-small',
    24: 'small',
    28: 'medium',
    32: 'medium',
    40: 'large',
    44: 'x-large',
    56: 'x-large',
  };
  for (const [px, expected] of Object.entries(sizes)) {
    const { container, unmount } = render(
      <AgentAvatar name="triage" size={Number(px)} />,
    );
    const avatar = container.querySelector('[data-size]');
    assert.equal(avatar?.getAttribute('data-size'), expected, `${px}px`);
    unmount();
  }
});
