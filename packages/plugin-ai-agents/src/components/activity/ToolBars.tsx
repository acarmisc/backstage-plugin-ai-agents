import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { ToolStat } from '../../types';
import { formatMs, formatPct } from '../../utils/stats';

export interface ToolBarsProps {
  tools: ToolStat[];
  onSelect?: (toolName: string) => void;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * Tool usage list: name, a bar proportional to the call count (the error
 * share painted in the error colour), call count, an error pill when
 * relevant, and avg / p95 latency. Rows are buttons (keyboard operable).
 */
export const ToolBars: React.FC<ToolBarsProps> = ({ tools, onSelect }) => {
  const theme = useTheme();

  if (tools.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.disabled">
          No tool calls in this window
        </Typography>
      </Box>
    );
  }

  const maxCalls = Math.max(...tools.map(t => t.calls), 1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {tools.map(tool => {
        const widthPct = (tool.calls / maxCalls) * 100;
        const errorShare = tool.calls > 0 ? tool.errors / tool.calls : 0;
        return (
          <Box
            key={tool.name}
            component="button"
            type="button"
            onClick={() => onSelect?.(tool.name)}
            sx={{
              all: 'unset',
              boxSizing: 'border-box',
              display: 'grid',
              gridTemplateColumns:
                'minmax(150px, 1.3fr) minmax(60px, 0.8fr) 40px 60px auto',
              alignItems: 'center',
              columnGap: 1.5,
              minHeight: 36,
              px: 1,
              borderRadius: 1,
              cursor: onSelect ? 'pointer' : 'default',
              '&:hover': { backgroundColor: theme.palette.action.hover },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: -2,
              },
            }}
          >
            <Typography
              title={tool.name}
              sx={{
                fontFamily: MONO,
                fontSize: 12.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tool.name}
            </Typography>
            <Box
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.palette.action.hover,
                overflow: 'hidden',
              }}
            >
              <Box
                data-testid="tool-bar"
                data-calls-pct={Math.round(widthPct)}
                data-error-pct={Math.round(errorShare * 100)}
                sx={{
                  height: '100%',
                  width: `${widthPct}%`,
                  display: 'flex',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                {tool.errors > 0 && (
                  <Box
                    sx={{
                      flex: tool.errors,
                      backgroundColor: theme.palette.error.main,
                    }}
                  />
                )}
                <Box
                  sx={{
                    flex: Math.max(tool.calls - tool.errors, 0),
                    backgroundColor: alpha(theme.palette.primary.main, 0.75),
                  }}
                />
              </Box>
            </Box>
            <Typography
              variant="body2"
              sx={{
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 600,
              }}
            >
              {tool.calls}
            </Typography>
            <Box sx={{ minHeight: 20, display: 'flex', alignItems: 'center' }}>
              {tool.errors > 0 && (
                <Box
                  data-testid="error-pill"
                  title={`${tool.errors} errors · ${formatPct(errorShare)} of calls`}
                  sx={{
                    px: 0.75,
                    py: '1px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    whiteSpace: 'nowrap',
                    color: theme.palette.error.main,
                    backgroundColor: alpha(theme.palette.error.main, 0.12),
                  }}
                >
                  {tool.errors} err
                </Box>
              )}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
              }}
            >
              {formatMs(tool.avgMs)} avg · {formatMs(tool.p95Ms)} p95
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};
