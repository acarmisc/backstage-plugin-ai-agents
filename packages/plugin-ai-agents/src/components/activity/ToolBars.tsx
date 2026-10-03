import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ErrorIcon from '@mui/icons-material/Error';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { ToolStat } from '../../types';
import { formatMs, formatPct, formatCount } from '../../utils/stats';

interface ToolRowProps {
  tool: ToolStat;
  maxCalls: number;
  onSelect?: (toolName: string) => void;
  theme: Theme;
}

/**
 * A single tool row with name, bar chart, and metrics.
 */
const ToolRow: React.FC<ToolRowProps> = ({ tool, maxCalls, onSelect, theme }) => {
  const handleClick = useCallback(() => {
    onSelect?.(tool.name);
  }, [tool.name, onSelect]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.(tool.name);
      }
    },
    [tool.name, onSelect],
  );

  const errorPct = tool.calls > 0 ? tool.errors / tool.calls : 0;
  const barWidth = (tool.calls / maxCalls) * 100;
  const errorBarWidth = (tool.errors / tool.calls) * 100;

  return (
    <Box
      component="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr 60px 60px 60px',
        gap: '12px',
        alignItems: 'center',
        padding: '8px 12px',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '6px',
        backgroundColor: theme.palette.background.paper,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? theme.palette.action.hover
              : theme.palette.action.hover,
          borderColor: theme.palette.primary.main,
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '2px',
        },
      }}
    >
      {/* Tool name (fixed width, ellipsis) */}
      <Typography
        sx={{
          fontFamily: 'ui-monospace, "Courier New", monospace',
          fontSize: '13px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}
        title={tool.name}
      >
        {tool.name}
      </Typography>

      {/* Call bar chart */}
      <Box sx={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: `${barWidth}%`,
            height: '100%',
            borderRadius: '4px',
            backgroundColor: theme.palette.success.main,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* Error portion overlay */}
          {tool.errors > 0 && (
            <Box
              sx={{
                height: '100%',
                width: `${errorBarWidth}%`,
                backgroundColor: theme.palette.error.main,
                borderRadius: '4px 0 0 4px',
              }}
            />
          )}
        </Box>
      </Box>

      {/* Call count */}
      <Typography
        sx={{
          fontFamily: 'ui-monospace, "Courier New", monospace',
          fontSize: '12px',
          color: theme.palette.text.secondary,
          textAlign: 'right',
        }}
      >
        {formatCount(tool.calls)}
      </Typography>

      {/* Error pill (only if errors > 0) */}
      <Box>
        {tool.errors > 0 && (
          <Chip
            icon={<ErrorIcon />}
            label={`${tool.errors} err · ${formatPct(errorPct)}`}
            size="small"
            color="error"
            variant="filled"
            sx={{
              fontFamily: 'ui-monospace, "Courier New", monospace',
              fontSize: '11px',
              height: '24px',
            }}
          />
        )}
      </Box>

      {/* Metrics (avg, p95) */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
        <Typography
          sx={{
            fontFamily: 'ui-monospace, "Courier New", monospace',
            fontSize: '11px',
            color: theme.palette.text.secondary,
          }}
        >
          avg: {formatMs(tool.avgMs)}
        </Typography>
        <Typography
          sx={{
            fontFamily: 'ui-monospace, "Courier New", monospace',
            fontSize: '11px',
            color: theme.palette.text.secondary,
          }}
        >
          p95: {formatMs(tool.p95Ms)}
        </Typography>
      </Box>
    </Box>
  );
};

export interface ToolBarsProps {
  tools: ToolStat[];
  onSelect?: (toolName: string) => void;
}

/**
 * A list of tool statistics displayed as horizontal bars.
 * Each row shows tool name, call count bar (with error portion highlighted),
 * error pill, and performance metrics (avg, p95).
 * Rows are clickable buttons (keyboard operable).
 */
export const ToolBars: React.FC<ToolBarsProps> = ({ tools, onSelect }) => {
  const theme = useTheme();

  if (tools.length === 0) {
    return (
      <Box
        sx={{
          padding: '16px',
          color: theme.palette.text.disabled,
          textAlign: 'center',
          fontSize: '14px',
        }}
      >
        No tool calls in this window
      </Box>
    );
  }

  const maxCalls = Math.max(...tools.map(t => t.calls), 1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {tools.map(tool => (
        <ToolRow
          key={tool.name}
          tool={tool}
          maxCalls={maxCalls}
          onSelect={onSelect}
          theme={theme}
        />
      ))}
    </Box>
  );
};
