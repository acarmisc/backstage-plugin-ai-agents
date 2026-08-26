import React, { useState } from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import type { AiAgent } from '../types';
import type { AgentFilters } from '../hooks/useAgents';
import { getRuntimeMeta } from './RuntimeBadge';

export interface AgentFiltersBarProps {
  agents: AiAgent[];
  filters: AgentFilters;
  onChange: (patch: Partial<AgentFilters>) => void;
  onReset: () => void;
}

const SELECT_PROPS = {
  SelectProps: { multiple: true, renderValue: (v: unknown) => (v as string[]).join(', ') || 'All' },
} as const;

function without<T>(arr: T[], value: T): T[] {
  return arr.filter(v => v !== value);
}

export const AgentFiltersBar: React.FC<AgentFiltersBarProps> = ({
  agents,
  filters,
  onChange,
  onReset,
}) => {
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const runtimes = Array.from(new Set(agents.map(a => a.runtime.runtime))).sort();
  const capabilities = Array.from(
    new Set(agents.flatMap(a => a.capabilities.map(c => c.label))),
  ).sort();
  const lifecycles = Array.from(new Set(agents.map(a => a.lifecycle).filter(Boolean))) as string[];
  const owners = Array.from(new Set(agents.map(a => a.owner).filter(Boolean))) as string[];

  const moreCount = filters.lifecycle.length + filters.owner.length;
  const hasFilters = Boolean(
    filters.search ||
      filters.runtime.length ||
      filters.capability.length ||
      moreCount,
  );

  return (
    <Paper sx={{ p: 1.5, mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search agents…"
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
          sx={{ minWidth: 220, flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: filters.search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onChange({ search: '' })}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />

        <TextField select size="small" label="Runtime" value={filters.runtime}
          onChange={e => onChange({ runtime: e.target.value as unknown as string[] })}
          sx={{ minWidth: 160 }}
          SelectProps={{
            multiple: true,
            renderValue: v =>
              (v as string[]).map(r => getRuntimeMeta(r).label).join(', ') || 'All',
          }}
        >
          {runtimes.map(r => (
            <MenuItem key={r} value={r}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                {getRuntimeMeta(r).icon}
                {getRuntimeMeta(r).label}
              </Box>
            </MenuItem>
          ))}
        </TextField>

        <TextField select size="small" label="Capability" value={filters.capability}
          onChange={e => onChange({ capability: e.target.value as unknown as string[] })}
          sx={{ minWidth: 150 }} {...SELECT_PROPS}>
          {capabilities.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>

        <Badge badgeContent={moreCount} color="primary" overlap="rectangular">
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<FilterListIcon fontSize="small" />}
            onClick={e => setMoreAnchor(e.currentTarget)}
          >
            More filters
          </Button>
        </Badge>

        <Popover
          open={Boolean(moreAnchor)}
          anchorEl={moreAnchor}
          onClose={() => setMoreAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 220 }}>
            <TextField select size="small" label="Lifecycle" value={filters.lifecycle}
              onChange={e => onChange({ lifecycle: e.target.value as unknown as string[] })}
              {...SELECT_PROPS}>
              {lifecycles.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>

            <TextField select size="small" label="Owner" value={filters.owner}
              onChange={e => onChange({ owner: e.target.value as unknown as string[] })}
              {...SELECT_PROPS}>
              {owners.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
          </Box>
        </Popover>

        {hasFilters && (
          <Tooltip title="Clear filters">
            <IconButton size="small" onClick={onReset}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ ml: 'auto', alignSelf: 'center' }}>
          <strong>{agents.length}</strong> agent{agents.length !== 1 ? 's' : ''}
        </Box>
      </Box>

      {hasFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}>
          {filters.search && (
            <Chip
              size="small"
              label={`"${filters.search}"`}
              onDelete={() => onChange({ search: '' })}
            />
          )}
          {filters.runtime.map(r => (
            <Chip
              key={`runtime-${r}`}
              size="small"
              icon={getRuntimeMeta(r).icon as React.ReactElement}
              label={getRuntimeMeta(r).label}
              onDelete={() => onChange({ runtime: without(filters.runtime, r) })}
            />
          ))}
          {filters.capability.map(c => (
            <Chip
              key={`capability-${c}`}
              size="small"
              label={c}
              onDelete={() => onChange({ capability: without(filters.capability, c) })}
            />
          ))}
          {filters.lifecycle.map(l => (
            <Chip
              key={`lifecycle-${l}`}
              size="small"
              label={l}
              onDelete={() => onChange({ lifecycle: without(filters.lifecycle, l) })}
            />
          ))}
          {filters.owner.map(o => (
            <Chip
              key={`owner-${o}`}
              size="small"
              label={o}
              onDelete={() => onChange({ owner: without(filters.owner, o) })}
            />
          ))}
        </Box>
      )}
    </Paper>
  );
};
