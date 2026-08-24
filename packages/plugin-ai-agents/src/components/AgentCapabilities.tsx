import React, { useState } from 'react';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import type { AgentCapability, AgentCapabilityCategory } from '../types';

const CATEGORY_COLOR: Record<
  AgentCapabilityCategory,
  'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' | 'default'
> = {
  reasoning: 'primary',
  retrieval: 'info',
  tools: 'secondary',
  vision: 'success',
  voice: 'warning',
  data: 'default',
  safety: 'error',
};

const MAX_VISIBLE = 5;

export interface AgentCapabilitiesProps {
  capabilities: AgentCapability[];
  max?: number;
  size?: 'small' | 'medium';
}

export const AgentCapabilities: React.FC<AgentCapabilitiesProps> = ({
  capabilities,
  max = MAX_VISIBLE,
  size = 'small',
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!capabilities.length) return null;
  const visible = capabilities.slice(0, max);
  const overflow = capabilities.length - visible.length;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {visible.map((c, i) => (
        <Chip
          key={`${c.label}-${i}`}
          label={c.label}
          size={size}
          color={c.category ? CATEGORY_COLOR[c.category] : 'default'}
          variant={c.category ? 'filled' : 'outlined'}
        />
      ))}
      {overflow > 0 && (
        <>
          <Chip
            label={`+${overflow}`}
            size={size}
            clickable
            onClick={e => {
              e.stopPropagation();
              setAnchor(e.currentTarget);
            }}
          />
          <Popover
            open={Boolean(anchor)}
            anchorEl={anchor}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Box sx={{ p: 1, maxWidth: 280, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {capabilities.map((c, i) => (
                <Chip
                  key={`${c.label}-${i}`}
                  label={c.label}
                  size="small"
                  color={c.category ? CATEGORY_COLOR[c.category] : 'default'}
                  variant={c.category ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </Popover>
        </>
      )}
    </Box>
  );
};