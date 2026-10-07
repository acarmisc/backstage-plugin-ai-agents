import React from 'react';
import { Text } from '@backstage/ui';
import type { ToolStat } from '../../types';
import { formatMs, formatPct } from '../../utils/stats';

export interface ToolBarsProps {
  tools: ToolStat[];
  onSelect?: (toolName: string) => void;
}

const MONO = 'var(--bui-font-monospace)';

/**
 * Tool usage list: name, a bar proportional to the call count (the error
 * share painted in the danger color), call count, an error pill when
 * relevant, and avg / p95 latency. Rows are buttons (keyboard operable).
 */
export function ToolBars({ tools, onSelect }: ToolBarsProps) {
  if (tools.length === 0) {
    return (
      <div style={{ padding: 'var(--bui-space-4) 0', textAlign: 'center' }}>
        <Text variant="body-medium" color="secondary">
          No tool calls in this window
        </Text>
      </div>
    );
  }

  const maxCalls = Math.max(...tools.map(t => t.calls), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {tools.map(tool => {
        const widthPct = (tool.calls / maxCalls) * 100;
        const errorShare = tool.calls > 0 ? tool.errors / tool.calls : 0;
        return (
          <button
            key={tool.name}
            type="button"
            onClick={() => onSelect?.(tool.name)}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              display: 'grid',
              gridTemplateColumns:
                'minmax(0, 1.4fr) minmax(40px, 1fr) 36px 52px',
              alignItems: 'center',
              columnGap: 'var(--bui-space-3)',
              minHeight: 44,
              padding: '0 var(--bui-space-2)',
              borderRadius: 'var(--bui-radius-2)',
              cursor: onSelect ? 'pointer' : 'default',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span
                title={tool.name}
                style={{
                  display: 'block',
                  fontFamily: MONO,
                  fontSize: 'var(--bui-font-size-3)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--bui-fg-primary)',
                }}
              >
                {tool.name}
              </span>
              <Text
                as="span"
                variant="body-x-small"
                color="secondary"
                style={{
                  display: 'block',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatMs(tool.avgMs)} avg · {formatMs(tool.p95Ms)} p95
              </Text>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: 'var(--bui-bg-neutral-2)',
                overflow: 'hidden',
              }}
            >
              <div
                data-testid="tool-bar"
                data-calls-pct={Math.round(widthPct)}
                data-error-pct={Math.round(errorShare * 100)}
                style={{
                  height: '100%',
                  width: `${widthPct}%`,
                  display: 'flex',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                {tool.errors > 0 && (
                  <div
                    style={{
                      flex: tool.errors,
                      background: 'var(--bui-fg-danger)',
                    }}
                  />
                )}
                <div
                  style={{
                    flex: Math.max(tool.calls - tool.errors, 0),
                    background: 'var(--bui-bg-solid)',
                  }}
                />
              </div>
            </div>
            <Text
              variant="body-medium"
              weight="bold"
              style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {tool.calls}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {tool.errors > 0 && (
                <span
                  data-testid="error-pill"
                  title={`${tool.errors} errors · ${formatPct(errorShare)} of calls`}
                  style={{
                    padding: '1px var(--bui-space-2)',
                    borderRadius: 10,
                    fontSize: 'var(--bui-font-size-2)',
                    fontWeight: 'var(--bui-font-weight-bold)',
                    whiteSpace: 'nowrap',
                    color: 'var(--bui-fg-danger)',
                    background: 'var(--bui-bg-danger)',
                  }}
                >
                  {tool.errors} err
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
