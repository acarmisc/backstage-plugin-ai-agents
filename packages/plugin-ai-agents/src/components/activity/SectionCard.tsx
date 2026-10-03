import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export interface SectionCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Remove the body padding (tables that go edge to edge). */
  flush?: boolean;
  children: React.ReactNode;
  'data-testid'?: string;
}

/** Shared surface for every block of the workspace: header + 1px border + 8px radius. */
export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  action,
  flush,
  children,
  ...rest
}) => (
  <Box
    component="section"
    data-testid={rest['data-testid']}
    sx={{
      border: 1,
      borderColor: 'divider',
      borderRadius: 2,
      backgroundColor: 'background.paper',
      minWidth: 0,
      overflow: 'hidden',
    }}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 2,
        py: 1.25,
        borderBottom: 1,
        borderColor: 'divider',
        minHeight: 48,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, lineHeight: 1.3 }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
    <Box sx={flush ? undefined : { p: 2 }}>{children}</Box>
  </Box>
);
