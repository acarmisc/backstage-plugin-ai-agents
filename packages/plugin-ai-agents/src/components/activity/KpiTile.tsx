import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';

type Tone = 'default' | 'success' | 'error' | 'info' | 'warning';

/**
 * Inline sparkline component rendering a trend as a small SVG polyline.
 */
interface SparklineProps {
  data: number[];
}

const Sparkline: React.FC<SparklineProps> = ({ data }) => {
  const theme = useTheme();

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
        stroke={theme.palette.primary.main}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        opacity={0.7}
      />
    </svg>
  );
};

export interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  trend?: number[];
  loading?: boolean;
}

/**
 * A KPI tile displaying a metric with optional trend sparkline.
 * Features a 3px left accent in the specified tone color.
 * Value uses tabular-nums for alignment.
 */
export const KpiTile: React.FC<KpiTileProps> = ({
  label,
  value,
  hint,
  tone = 'default',
  trend,
  loading = false,
}) => {
  const theme = useTheme();

  // Map tone to theme palette colors
  const toneColor = useMemo(() => {
    switch (tone) {
      case 'success':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'info':
        return theme.palette.info.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'default':
      default:
        return theme.palette.divider;
    }
  }, [tone, theme]);

  const valueColor = useMemo(() => {
    if (tone === 'default') return 'inherit';
    return toneColor;
  }, [tone, toneColor]);

  return (
    <Box
      sx={{
        padding: '12px',
        borderRadius: '8px',
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        borderLeft: `3px solid ${toneColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.action.hover, 0.3)
              : alpha(theme.palette.action.hover, 0.5),
          boxShadow: theme.shadows[2],
        },
      }}
    >
      {/* Label */}
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: theme.palette.text.secondary,
          fontSize: '11px',
        }}
      >
        {label}
      </Typography>

      {/* Value */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        {loading ? (
          <Skeleton variant="text" width={80} height={32} />
        ) : (
          <Typography
            variant="h6"
            sx={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              fontSize: '26px',
              lineHeight: 1.2,
              color: valueColor,
            }}
          >
            {value}
          </Typography>
        )}

        {/* Trend Sparkline */}
        {trend && trend.length > 0 && !loading && <Sparkline data={trend} />}
      </Box>

      {/* Hint */}
      {hint && (
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '12px',
          }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  );
};
