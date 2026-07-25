import React from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import type { AiAgent } from '../types';
import type { AgentFilters } from '../hooks/useAgents';

export interface AgentFiltersBarProps {
  agents: AiAgent[];
  filters: AgentFilters;
  onChange: (patch: Partial<AgentFilters>) => void;
  onReset: () => void;
}

const SELECT_PROPS = {
  SelectProps: { multiple: true, renderValue: (v: unknown) => (v as string[]).join(', ') || 'All' },
} as const;

export const AgentFiltersBar: React.FC<AgentFiltersBarProps> = ({
  agents,
  filters,
  onChange,
  onReset,
}) => {
  const runtimes = Array.from(new Set(agents.map(a => a.runtime.runtime))).sort();
  const capabilities = Array.from(
    new Set(agents.flatMap(a => a.capabilities.map(c => c.label))),
  ).sort();
  const lifecycles = Array.from(new Set(agents.map(a => a.lifecycle).filter(Boolean))) as string[];
  const owners = Array.from(new Set(agents.map(a => a.owner).filter(Boolean))) as string[];

  const hasFilters =
    filters.search ||
    filters.runtime.length ||
    filters.capability.length ||
    filters.lifecycle.length ||
    filters.owner.length;

  return (
    <Paper sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
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
        sx={{ minWidth: 140 }} {...SELECT_PROPS}>
        {runtimes.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
      </TextField>

      <TextField select size="small" label="Capability" value={filters.capability}
        onChange={e => onChange({ capability: e.target.value as unknown as string[] })}
        sx={{ minWidth: 150 }} {...SELECT_PROPS}>
        {capabilities.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </TextField>

      <TextField select size="small" label="Lifecycle" value={filters.lifecycle}
        onChange={e => onChange({ lifecycle: e.target.value as unknown as string[] })}
        sx={{ minWidth: 130 }} {...SELECT_PROPS}>
        {lifecycles.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
      </TextField>

      <TextField select size="small" label="Owner" value={filters.owner}
        onChange={e => onChange({ owner: e.target.value as unknown as string[] })}
        sx={{ minWidth: 140 }} {...SELECT_PROPS}>
        {owners.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </TextField>

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
    </Paper>
  );
};