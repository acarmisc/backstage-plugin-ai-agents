import React from 'react';
import { Card, CardBody, Flex, Skeleton, Text } from '@backstage/ui';

type Tone = 'default' | 'success' | 'error' | 'info' | 'warning';

/** Inline sparkline: a trend as a small SVG polyline. */
function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;

  const width = 80;
  const height = 24;
  const padding = 2;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  const points = data
    .map((value, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--bui-fg-secondary)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  trend?: number[];
  loading?: boolean;
}

const TEXT_COLOR = {
  success: 'success',
  error: 'danger',
  info: 'info',
  warning: 'warning',
} as const;

/**
 * A KPI tile: a metric with an optional hint and trend sparkline. The value
 * is colored by tone when it carries a judgement (success rate, failures).
 */
export function KpiTile({
  label,
  value,
  hint,
  tone = 'default',
  trend,
  loading = false,
}: KpiTileProps) {
  return (
    <Card>
      <CardBody>
        <Flex direction="column" gap="1">
          <Text variant="body-small" color="secondary">
            {label}
          </Text>
          <Flex align="baseline" gap="2">
            {loading ? (
              <Skeleton width={80} height={32} />
            ) : (
              <Text
                variant="title-x-small"
                weight="bold"
                color={tone === 'default' ? 'primary' : TEXT_COLOR[tone]}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {value}
              </Text>
            )}
            {trend && trend.length > 0 && !loading && (
              <Sparkline data={trend} />
            )}
          </Flex>
          {hint && (
            <Text variant="body-small" color="secondary">
              {hint}
            </Text>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
}
