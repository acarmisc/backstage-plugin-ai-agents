import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { Hint, Meter, StatusDot, TONE_FG } from '.';

afterEach(cleanup);

test('StatusDot is decorative and colored by BUI tokens only', () => {
  const { container } = render(<StatusDot tone="success" />);
  const dot = container.firstElementChild as HTMLElement;
  assert.equal(dot.getAttribute('aria-hidden'), 'true');
  assert.equal(dot.style.background, 'var(--bui-fg-success)');
});

test('StatusDot hollow draws a dashed outline instead of a fill', () => {
  const { container } = render(<StatusDot tone="neutral" hollow />);
  const dot = container.firstElementChild as HTMLElement;
  assert.equal(dot.style.background, 'transparent');
  assert.match(dot.style.border, /dashed/);
});

test('StatusDot pulses with the BUI animation when asked to', () => {
  const { container } = render(<StatusDot tone="info" pulse />);
  assert.equal(
    (container.firstElementChild as HTMLElement).style.animation,
    'var(--bui-animate-pulse)',
  );
});

test('tones never use hard-coded colors', () => {
  for (const value of Object.values(TONE_FG)) {
    assert.match(value, /^var\(--bui-/);
  }
});

test('Meter exposes progressbar semantics and clamps its value', () => {
  render(<Meter label="Budget used" value={150} max={100} tone="danger" />);
  const bar = screen.getByRole('progressbar', { name: 'Budget used' });
  assert.equal(bar.getAttribute('aria-valuenow'), '100');
  assert.equal(bar.getAttribute('aria-valuemax'), '100');
  assert.equal((bar.firstElementChild as HTMLElement).style.width, '100%');
});

test('Meter fill is proportional', () => {
  render(<Meter label="Used" value={25} max={50} />);
  const bar = screen.getByRole('progressbar', { name: 'Used' });
  assert.equal((bar.firstElementChild as HTMLElement).style.width, '50%');
});

test('Hint keeps its child and makes it a tooltip trigger', () => {
  render(
    <Hint label="More info">
      <span tabIndex={0}>trigger</span>
    </Hint>,
  );
  assert.ok(screen.getByText('trigger'));
});
