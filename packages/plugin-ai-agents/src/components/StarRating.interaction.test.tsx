import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { StarRating } from './StarRating';

afterEach(cleanup);

test('StarRating fancy variant calls onChange when clicking a star', async () => {
  const changes: number[] = [];
  const handleChange = (value: number) => {
    changes.push(value);
  };

  const { container } = render(
    <StarRating value={0} variant="fancy" onChange={handleChange} />
  );

  // Find the radio input for the 3-star rating
  const radioInputs = container.querySelectorAll('input[type="radio"]');
  assert.ok(radioInputs.length > 0, 'Should render radio inputs for stars');

  // Click the 3-star rating using fireEvent
  fireEvent.click(radioInputs[2]);

  assert.deepEqual(changes, [3], 'Should call onChange with value 3 after clicking 3-star');

  // Click the 5-star rating
  fireEvent.click(radioInputs[4]);

  assert.deepEqual(changes, [3, 5], 'Should call onChange with value 5 after clicking 5-star');
});

test('StarRating fancy variant displays label on value change', () => {
  const changes: number[] = [];
  const handleChange = (value: number) => {
    changes.push(value);
  };

  const { container, rerender } = render(
    <StarRating value={0} variant="fancy" onChange={handleChange} />
  );

  const radioInputs = container.querySelectorAll('input[type="radio"]');

  // Click the 4-star rating (index 3)
  fireEvent.click(radioInputs[3]);

  assert.deepEqual(changes, [4], 'Should call onChange with value 4');

  // Rerender with the new value to show the label
  rerender(<StarRating value={4} variant="fancy" onChange={handleChange} />);

  // After clicking, the component should display the label for "Great" (4 stars)
  const typography = container.querySelector('p'); // Typography renders as <p>
  assert.ok(
    typography?.textContent?.includes('Great'),
    'Should display "Great" label for 4-star rating'
  );
});
