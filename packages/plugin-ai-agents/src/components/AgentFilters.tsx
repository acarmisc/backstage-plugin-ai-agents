import React from 'react';
import {
  Button,
  ButtonIcon,
  DialogTrigger,
  Flex,
  Popover,
  SearchField,
  Select,
  Tag,
  TagGroup,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  TooltipTrigger,
} from '@backstage/ui';
import { RiCloseLine, RiFilter3Line } from '@remixicon/react';
import type { AiAgent } from '../types';
import type { AgentFilters, GroupBy } from '../hooks/useAgents';
import { getRuntimeMeta } from './RuntimeBadge';

export interface AgentFiltersBarProps {
  agents: AiAgent[];
  filters: AgentFilters;
  onChange: (patch: Partial<AgentFilters>) => void;
  onReset: () => void;
  groupBy?: GroupBy;
  onGroupByChange?: (groupBy: GroupBy) => void;
}

type FilterKey = keyof AgentFilters;

function without<T>(arr: T[], value: T): T[] {
  return arr.filter(v => v !== value);
}

/** react-aria hands back an array (multiple mode) or a single key. */
function toStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value instanceof Set) return Array.from(value, String);
  return value === null || value === undefined ? [] : [String(value)];
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string; leadingIcon?: React.ReactNode }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div style={{ width: 200 }}>
      <Select
        aria-label={label}
        placeholder={label}
        size="small"
        selectionMode="multiple"
        options={options}
        value={value}
        onChange={next => onChange(toStrings(next))}
      />
    </div>
  );
}

const unique = (values: (string | undefined)[]): string[] =>
  Array.from(new Set(values.filter(Boolean) as string[])).sort();

export function AgentFiltersBar({
  agents,
  filters,
  onChange,
  onReset,
  groupBy = 'none',
  onGroupByChange,
}: AgentFiltersBarProps) {
  const runtimes = unique(agents.map(a => a.runtime.runtime));
  const capabilities = unique(
    agents.flatMap(a => a.capabilities.map(c => c.label)),
  );
  const lifecycles = unique(agents.map(a => a.lifecycle));
  const owners = unique(agents.map(a => a.owner));
  const squads = unique(agents.map(a => a.squad));

  const moreCount = filters.lifecycle.length + filters.owner.length;
  const hasFilters = Boolean(
    filters.search ||
    filters.runtime.length ||
    filters.capability.length ||
    filters.squad.length ||
    moreCount,
  );

  // One removable tag per active filter value; ids encode "<kind>:<value>".
  const activeTags: { id: string; label: string; icon?: React.ReactNode }[] = [
    ...(filters.search
      ? [{ id: `search:${filters.search}`, label: `"${filters.search}"` }]
      : []),
    ...filters.squad.map(q => ({ id: `squad:${q}`, label: `Squad: ${q}` })),
    ...filters.runtime.map(r => ({
      id: `runtime:${r}`,
      label: getRuntimeMeta(r).label,
      icon: getRuntimeMeta(r).icon,
    })),
    ...filters.capability.map(c => ({ id: `capability:${c}`, label: c })),
    ...filters.lifecycle.map(l => ({ id: `lifecycle:${l}`, label: l })),
    ...filters.owner.map(o => ({ id: `owner:${o}`, label: o })),
  ];

  const removeTag = (id: string) => {
    const at = id.indexOf(':');
    const kind = id.slice(0, at) as FilterKey;
    const value = id.slice(at + 1);
    if (kind === 'search') onChange({ search: '' });
    else onChange({ [kind]: without(filters[kind] as string[], value) });
  };

  return (
    <Flex direction="column" gap="3" mb="4">
      <Flex align="center" gap="3" style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', maxWidth: 360 }}>
          <SearchField
            aria-label="Search agents"
            placeholder="Search agents…"
            size="small"
            value={filters.search}
            onChange={search => onChange({ search })}
          />
        </div>

        {squads.length > 0 && (
          <MultiSelect
            label="Squad"
            options={squads.map(q => ({ id: q, label: q }))}
            value={filters.squad}
            onChange={squad => onChange({ squad })}
          />
        )}

        <MultiSelect
          label="Runtime"
          options={runtimes.map(r => ({
            id: r,
            label: getRuntimeMeta(r).label,
            leadingIcon: getRuntimeMeta(r).icon,
          }))}
          value={filters.runtime}
          onChange={runtime => onChange({ runtime })}
        />

        <MultiSelect
          label="Capability"
          options={capabilities.map(c => ({ id: c, label: c }))}
          value={filters.capability}
          onChange={capability => onChange({ capability })}
        />

        <DialogTrigger>
          <Button
            variant="secondary"
            size="small"
            iconStart={<RiFilter3Line size={16} />}
          >
            {moreCount ? `More filters · ${moreCount}` : 'More filters'}
          </Button>
          <Popover>
            <Flex direction="column" gap="3" style={{ minWidth: 220 }}>
              <MultiSelect
                label="Lifecycle"
                options={lifecycles.map(l => ({ id: l, label: l }))}
                value={filters.lifecycle}
                onChange={lifecycle => onChange({ lifecycle })}
              />
              <MultiSelect
                label="Owner"
                options={owners.map(o => ({ id: o, label: o }))}
                value={filters.owner}
                onChange={owner => onChange({ owner })}
              />
            </Flex>
          </Popover>
        </DialogTrigger>

        {hasFilters && (
          <TooltipTrigger>
            <ButtonIcon
              aria-label="Clear filters"
              variant="tertiary"
              size="small"
              icon={<RiCloseLine size={16} />}
              onPress={onReset}
            />
            <Tooltip>Clear filters</Tooltip>
          </TooltipTrigger>
        )}

        {squads.length > 0 && onGroupByChange && (
          <Flex align="center" gap="2" style={{ marginLeft: 'auto' }}>
            <Text variant="body-small" color="secondary">
              Group by
            </Text>
            <ToggleButtonGroup
              aria-label="Group by"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[groupBy]}
              onSelectionChange={keys => {
                const [key] = Array.from(keys);
                if (key !== undefined) onGroupByChange(key as GroupBy);
              }}
            >
              <ToggleButton id="none" size="small">
                None
              </ToggleButton>
              <ToggleButton id="squad" size="small">
                Squad
              </ToggleButton>
            </ToggleButtonGroup>
          </Flex>
        )}

        <Text
          variant="body-small"
          color="secondary"
          style={{
            marginLeft: squads.length > 0 && onGroupByChange ? 0 : 'auto',
          }}
        >
          <Text as="strong" variant="body-small" weight="bold">
            {agents.length}
          </Text>{' '}
          agent{agents.length !== 1 ? 's' : ''}
        </Text>
      </Flex>

      {activeTags.length > 0 && (
        <TagGroup
          aria-label="Active filters"
          onRemove={keys => keys.forEach(k => removeTag(String(k)))}
        >
          {activeTags.map(t => (
            <Tag key={t.id} id={t.id} icon={t.icon} size="small">
              {t.label}
            </Tag>
          ))}
        </TagGroup>
      )}
    </Flex>
  );
}
