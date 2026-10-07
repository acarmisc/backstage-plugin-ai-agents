import React, { useId, useState } from 'react';
import { Text, VisuallyHidden } from '@backstage/ui';
import { RiStarFill, RiStarHalfFill, RiStarLine } from '@remixicon/react';

/** @public */
export type StarVariant = 'simple' | 'fancy';

const LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];
const STARS = [1, 2, 3, 4, 5];

/** @public */
export interface StarRatingProps {
  value: number;
  /** Controlled change handler; omit for read-only display. */
  onChange?: (value: number) => void;
  variant?: StarVariant;
}

type Fill = 'full' | 'half' | 'empty';

function fillOf(star: number, value: number): Fill {
  if (value >= star) return 'full';
  if (value >= star - 0.5) return 'half';
  return 'empty';
}

function Star({ fill, size }: { fill: Fill; size: number }) {
  const Icon =
    fill === 'full'
      ? RiStarFill
      : fill === 'half'
        ? RiStarHalfFill
        : RiStarLine;
  return (
    <Icon
      size={size}
      aria-hidden="true"
      style={{
        display: 'block',
        color:
          fill === 'empty' ? 'var(--bui-fg-disabled)' : 'var(--bui-fg-warning)',
      }}
    />
  );
}

/**
 * 0-5 star rating widget, built on BUI tokens and Remix icons (BUI has no
 * rating component).
 * - `simple`: compact stars (cards, rows); read-only unless `onChange` is set.
 * - `fancy`: interactive large stars with hover preview and a text label
 *   (review forms).
 *
 * Interactive stars are native radio inputs, so keyboard and screen-reader
 * behavior come from the platform.
 *
 * @public
 */
export function StarRating({
  value,
  onChange,
  variant = 'simple',
}: StarRatingProps) {
  const groupName = useId();
  const [hover, setHover] = useState(0);
  const [focused, setFocused] = useState(0);
  const fancy = variant === 'fancy';
  const size = fancy ? 28 : 16;
  // Half stars only make sense for averages shown read-only.
  const precision = fancy || onChange ? 1 : 0.5;
  const rounded = Math.round(value / precision) * precision;

  if (!onChange) {
    return (
      <span
        role="img"
        aria-label={`Rated ${value} out of 5`}
        style={{ display: 'inline-flex', gap: 2 }}
      >
        {STARS.map(n => (
          <Star key={n} fill={fillOf(n, rounded)} size={size} />
        ))}
      </span>
    );
  }

  const shown = hover || rounded;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <span
        role="radiogroup"
        aria-label="Rating"
        style={{ display: 'inline-flex', gap: 2 }}
        onMouseLeave={() => setHover(0)}
      >
        {STARS.map(n => (
          <label
            key={n}
            onMouseEnter={() => setHover(n)}
            style={{
              position: 'relative',
              cursor: 'pointer',
              lineHeight: 0,
              borderRadius: 'var(--bui-radius-2)',
              outline: focused === n ? '2px solid var(--bui-ring)' : 'none',
              outlineOffset: 2,
              transition: 'transform 120ms ease-in-out',
              transform: hover === n ? 'scale(1.15)' : undefined,
            }}
          >
            <VisuallyHidden>
              <input
                type="radio"
                name={groupName}
                value={n}
                checked={Math.round(value) === n}
                aria-label={`${n} ${n === 1 ? 'Star' : 'Stars'}`}
                onChange={() => onChange(n)}
                onFocus={() => setFocused(n)}
                onBlur={() => setFocused(0)}
              />
            </VisuallyHidden>
            <Star fill={fillOf(n, shown)} size={size} />
          </label>
        ))}
      </span>
      {fancy && (
        <Text
          as="p"
          variant="body-medium"
          weight="bold"
          style={{ minWidth: 64, margin: 0 }}
        >
          {value > 0 ? LABELS[Math.round(value) - 1] : ''}
        </Text>
      )}
    </span>
  );
}
