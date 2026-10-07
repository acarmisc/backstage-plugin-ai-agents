import React from 'react';
import { Text } from '@backstage/ui';
import type { HourBucket } from '../../types';

export interface HourlyBarsProps {
  buckets: HourBucket[];
  /** Height of the plot area in px. */
  height?: number;
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getHours().toString().padStart(2, '0')}:00`;
}

/** Spacing between x-axis labels so they never collide (≈ 8 labels max). */
function labelStep(count: number): number {
  if (count <= 8) return 1;
  if (count <= 16) return 2;
  if (count <= 30) return 6;
  return 12;
}

/**
 * Stacked bars (completed / failed) per hour. Pure CSS grid: one column per
 * bucket, so it scales to any width and window size without layout maths.
 */
export function HourlyBars({ buckets, height = 96 }: HourlyBarsProps) {
  if (buckets.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="body-medium" color="secondary">
          No activity in this window
        </Text>
      </div>
    );
  }

  const max = Math.max(...buckets.map(b => b.runs), 1);
  const totalRuns = buckets.reduce((s, b) => s + b.runs, 0);
  const totalFailed = buckets.reduce((s, b) => s + b.failed, 0);
  const step = labelStep(buckets.length);
  const columns = `repeat(${buckets.length}, minmax(0, 1fr))`;

  return (
    <div
      role="img"
      aria-label={`Hourly runs: ${totalRuns} total, ${totalFailed} failed`}
      style={{ width: '100%' }}
    >
      <div
        style={{
          position: 'relative',
          height,
          borderBottom: '1px solid var(--bui-border-2)',
        }}
      >
        <Text
          variant="body-x-small"
          color="secondary"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {max}
        </Text>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: columns,
            gap: buckets.length > 36 ? '1px' : '3px',
          }}
        >
          {buckets.map(bucket => {
            const ok = Math.max(bucket.runs - bucket.failed, 0);
            const pct =
              bucket.runs > 0 ? Math.max((bucket.runs / max) * 100, 2) : 0;
            return (
              <div
                key={bucket.start}
                data-testid="hour-bar"
                data-runs={bucket.runs}
                data-failed={bucket.failed}
                data-height-pct={Math.round(pct)}
                title={`${hourLabel(bucket.start)} · ${bucket.runs} run${bucket.runs === 1 ? '' : 's'} · ${bucket.failed} failed`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  borderRadius: '3px 3px 0 0',
                }}
              >
                {bucket.runs > 0 && (
                  <div
                    style={{
                      width: '100%',
                      height: `${pct}%`,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: '3px 3px 0 0',
                      overflow: 'hidden',
                    }}
                  >
                    {bucket.failed > 0 && (
                      <div
                        data-segment="failed"
                        style={{
                          flex: bucket.failed,
                          background: 'var(--bui-fg-danger)',
                        }}
                      />
                    )}
                    {ok > 0 && (
                      <div
                        data-segment="success"
                        style={{
                          flex: ok,
                          background: 'var(--bui-fg-success)',
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          marginTop: 'var(--bui-space-1)',
        }}
      >
        {buckets.map((bucket, i) => (
          <Text
            key={bucket.start}
            variant="body-x-small"
            color="secondary"
            style={{
              whiteSpace: 'nowrap',
              overflow: 'visible',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {i % step === 0 ? hourLabel(bucket.start) : ''}
          </Text>
        ))}
      </div>
    </div>
  );
}
