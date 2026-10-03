import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { HourBucket } from '../../types';

export interface HourlyBarsProps {
  buckets: HourBucket[];
  height?: number;
}

/**
 * A stacked vertical bar chart showing hourly run counts and failures.
 * Displays local HH:00 labels every 6th bucket.
 * Each bar is clickable with a tooltip showing run details.
 */
export const HourlyBars: React.FC<HourlyBarsProps> = ({
  buckets,
  height = 96,
}) => {
  const theme = useTheme();

  if (buckets.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.palette.text.disabled,
          fontSize: '14px',
        }}
      >
        No activity in this window
      </Box>
    );
  }

  const maxRuns = Math.max(...buckets.map(b => b.runs), 1);
  const barGap = buckets.length > 1 ? 2 : 0;
  const barWidth = buckets.length > 0 ? `${(100 / buckets.length) - (barGap * 100) / 200}%` : '100%';

  // Compute total runs and failures for aria-label
  const totalRuns = buckets.reduce((sum, b) => sum + b.runs, 0);
  const totalFailed = buckets.reduce((sum, b) => sum + b.failed, 0);

  return (
    <Box
      role="img"
      aria-label={`Hourly runs: ${totalRuns} total, ${totalFailed} failed`}
      sx={{
        height,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        gap: `${barGap}px`,
        position: 'relative',
      }}
    >
      {buckets.map((bucket, index) => {
        const successRuns = bucket.runs - bucket.failed;
        const successPct = bucket.runs > 0 ? (successRuns / bucket.runs) * 100 : 100;
        const failedPct = bucket.runs > 0 ? (bucket.failed / bucket.runs) * 100 : 0;

        const barHeight = bucket.runs > 0 ? (bucket.runs / maxRuns) * (height - 4) : 1;
        const successHeight = (successPct / 100) * barHeight;
        const failedHeight = (failedPct / 100) * barHeight;

        // Format time from ISO string
        const timeStr = formatHourLabel(bucket.start);

        return (
          <Box key={`${bucket.start}-${index}`}>
            {/* Bar */}
            <Box
              title={`${timeStr} · ${bucket.runs} runs · ${bucket.failed} failed`}
              sx={{
                width: barWidth,
                height: barHeight || 1,
                display: 'flex',
                flexDirection: 'column-reverse',
                borderRadius: '2px',
                overflow: 'hidden',
                backgroundColor: theme.palette.action.disabled,
                cursor: 'pointer',
                transition: 'opacity 0.2s ease',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              {/* Success part */}
              {successHeight > 0 && (
                <Box
                  sx={{
                    height: `${(successHeight / barHeight) * 100}%`,
                    backgroundColor: theme.palette.success.main,
                  }}
                />
              )}
              {/* Failed part */}
              {failedHeight > 0 && (
                <Box
                  sx={{
                    height: `${(failedHeight / barHeight) * 100}%`,
                    backgroundColor: theme.palette.error.main,
                  }}
                />
              )}
            </Box>

            {/* X-axis label (every 6th bucket) */}
            {index % 6 === 0 && (
              <Typography
                variant="caption"
                sx={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color: theme.palette.text.secondary,
                  textAlign: 'center',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {timeStr}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Format the hour label from an ISO date string, showing "HH:00" in local time.
 * Shows label only every 6th bucket to avoid clutter.
 */
function formatHourLabel(isoString: string): string {
  try {
    const date = new Date(isoString);
    const hour = date.getHours().toString().padStart(2, '0');
    return `${hour}:00`;
  } catch {
    return '';
  }
}
