import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StarRating } from './StarRating';

test('StarRating simple variant renders read-only stars', () => {
  const html = renderToString(<StarRating value={4} />);
  assert.match(html, /aria-label="4 Stars"/);
  assert.ok(!html.includes('Excellent'));
});

test('StarRating fancy variant renders label and interactive input', () => {
  const html = renderToString(<StarRating value={3} variant="fancy" onChange={() => {}} />);
  assert.match(html, /Good/);
  assert.match(html, /type="radio"/);
});
