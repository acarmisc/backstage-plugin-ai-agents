import React from 'react';
import { Badge, Button, DialogTrigger, Flex, Popover } from '@backstage/ui';
import {
  RiBrainLine,
  RiDatabase2Line,
  RiEyeLine,
  RiMicLine,
  RiSearchEyeLine,
  RiShieldCheckLine,
  RiToolsLine,
} from '@remixicon/react';
import type { AgentCapability, AgentCapabilityCategory } from '../types';

/**
 * Categories are told apart by icon, not by color: BUI badges are neutral by
 * design, and one hue per category would clash with the host theme.
 */
const CATEGORY_ICON: Record<AgentCapabilityCategory, React.ReactElement> = {
  reasoning: <RiBrainLine size={18} />,
  retrieval: <RiSearchEyeLine size={18} />,
  tools: <RiToolsLine size={18} />,
  vision: <RiEyeLine size={18} />,
  voice: <RiMicLine size={18} />,
  data: <RiDatabase2Line size={18} />,
  safety: <RiShieldCheckLine size={18} />,
};

const MAX_VISIBLE = 5;

export interface AgentCapabilitiesProps {
  capabilities: AgentCapability[];
  max?: number;
  size?: 'small' | 'medium';
}

function CapabilityBadge({
  capability,
  size,
}: {
  capability: AgentCapability;
  size: 'small' | 'medium';
}) {
  return (
    <Badge
      size={size}
      icon={
        capability.category ? CATEGORY_ICON[capability.category] : undefined
      }
    >
      {capability.label}
    </Badge>
  );
}

export function AgentCapabilities({
  capabilities,
  max = MAX_VISIBLE,
  size = 'small',
}: AgentCapabilitiesProps) {
  if (!capabilities.length) return null;
  const visible = capabilities.slice(0, max);
  const overflow = capabilities.length - visible.length;

  return (
    <Flex gap="1" style={{ flexWrap: 'wrap' }}>
      {visible.map((c, i) => (
        <CapabilityBadge key={`${c.label}-${i}`} capability={c} size={size} />
      ))}
      {overflow > 0 && (
        <DialogTrigger>
          <Button
            size="small"
            variant="tertiary"
            aria-label={`Show all ${capabilities.length} capabilities`}
          >
            {`+${overflow}`}
          </Button>
          <Popover>
            <Flex gap="1" style={{ flexWrap: 'wrap', maxWidth: 280 }}>
              {capabilities.map((c, i) => (
                <CapabilityBadge
                  key={`${c.label}-${i}`}
                  capability={c}
                  size="small"
                />
              ))}
            </Flex>
          </Popover>
        </DialogTrigger>
      )}
    </Flex>
  );
}
