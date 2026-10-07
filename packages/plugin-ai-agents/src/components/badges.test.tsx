import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentCapabilities } from './AgentCapabilities';
import { BillingBadge } from './BillingBadge';
import { RuntimeBadge, getRuntimeMeta } from './RuntimeBadge';
import { getLinkIcon } from './linkIcon';

afterEach(cleanup);

// --- AgentStatusBadge ------------------------------------------------------

test('status badge names its state and latency for assistive tech', () => {
  render(
    <AgentStatusBadge
      status={{ state: 'degraded', latencyMs: 480, message: 'slow upstream' }}
    />,
  );
  const badge = screen.getByRole('img', { name: /Status: degraded/ });
  assert.match(badge.getAttribute('aria-label') ?? '', /Latency: 480ms/);
  assert.match(badge.getAttribute('aria-label') ?? '', /slow upstream/);
  assert.ok(screen.getByText('480ms'));
});

test('status badge falls back to "unknown" without a status', () => {
  render(<AgentStatusBadge />);
  assert.ok(screen.getByRole('img', { name: 'Status: unknown' }));
});

test('status dot tone follows the state', () => {
  const tones: Record<string, string> = {
    healthy: 'success',
    degraded: 'warning',
    down: 'danger',
    unknown: 'neutral',
  };
  for (const [state, tone] of Object.entries(tones)) {
    const { container, unmount } = render(
      <AgentStatusBadge status={{ state: state as any }} />,
    );
    assert.ok(container.querySelector(`[data-tone="${tone}"]`), state);
    unmount();
  }
});

// --- RuntimeBadge ----------------------------------------------------------

test('runtime chip shows the runtime label', () => {
  render(<RuntimeBadge runtime="kagent" />);
  assert.ok(screen.getByText('kagent'));
});

test('runtime chip becomes a button when clickable', () => {
  const clicks: string[] = [];
  render(<RuntimeBadge runtime="litellm" onClick={r => clicks.push(r)} />);
  fireEvent.click(screen.getByRole('button', { name: 'LiteLLM' }));
  assert.deepEqual(clicks, ['litellm']);
});

test('runtime icon variant is a labelled button only when clickable', () => {
  const clicks: string[] = [];
  const { unmount } = render(
    <RuntimeBadge
      runtime="lambda"
      variant="icon"
      onClick={r => clicks.push(r)}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'AWS Lambda' }));
  assert.deepEqual(clicks, ['lambda']);
  unmount();

  render(<RuntimeBadge runtime="lambda" variant="icon" />);
  assert.equal(screen.queryByRole('button'), null);
  assert.ok(screen.getByRole('img', { name: 'AWS Lambda' }));
});

test('unknown runtimes get their own name and a generic icon', () => {
  const meta = getRuntimeMeta('my-runtime' as any);
  assert.equal(meta.label, 'my-runtime');
  assert.ok(meta.icon);
});

// --- BillingBadge ----------------------------------------------------------

test('billing badge shows the model and cost lines', () => {
  render(
    <BillingBadge
      billing={{ model: 'per-invocation', unitCost: 0.012, budget: 50 }}
    />,
  );
  assert.ok(screen.getByText('per-invocation'));
  assert.ok(screen.getByText('~$0.012 per 1k calls'));
  assert.ok(screen.getByText('budget: $50'));
});

test('compact billing badge keeps the cost out of the layout', () => {
  render(
    <BillingBadge compact billing={{ model: 'per-token', unitCost: 2 }} />,
  );
  assert.ok(screen.getByText('per-token'));
  assert.equal(screen.queryByText('~$2 per 1M tokens'), null);
});

test('free billing has no cost lines', () => {
  render(<BillingBadge billing={{ model: 'free' }} />);
  assert.ok(screen.getByText('free'));
  assert.equal(screen.queryByText(/budget/), null);
});

// --- AgentCapabilities -----------------------------------------------------

const caps = [
  { label: 'tool-use', category: 'tools' as const },
  { label: 'rag', category: 'retrieval' as const },
  { label: 'reasoning', category: 'reasoning' as const },
  { label: 'ocr' },
];

test('capabilities render one neutral badge each, no category colors', () => {
  const { container } = render(<AgentCapabilities capabilities={caps} />);
  for (const c of caps) assert.ok(screen.getByText(c.label));
  // Categories are told apart by icon, never by inline color.
  assert.equal(container.querySelectorAll('[style*="background"]').length, 0);
  assert.equal(container.querySelectorAll('svg').length, 3);
});

test('capabilities collapse into a +N popover over the limit', async () => {
  render(<AgentCapabilities capabilities={caps} max={2} />);
  assert.equal(screen.queryByText('reasoning'), null);
  const more = screen.getByRole('button', { name: 'Show all 4 capabilities' });
  assert.equal(more.textContent, '+2');
  fireEvent.click(more);
  assert.ok(await screen.findByText('ocr'));
  assert.ok(screen.getAllByText('tool-use').length >= 1);
});

test('no capabilities renders nothing', () => {
  const { container } = render(<AgentCapabilities capabilities={[]} />);
  assert.equal(container.firstChild, null);
});

// --- linkIcon --------------------------------------------------------------

test('link icons map known keys and fall back to a generic link', () => {
  for (const key of [
    'dashboard',
    'docs',
    'playbook',
    'issues',
    'code',
    'web',
  ]) {
    assert.ok(getLinkIcon(key));
  }
  assert.ok(getLinkIcon('nope'));
  assert.ok(getLinkIcon(undefined));
});
