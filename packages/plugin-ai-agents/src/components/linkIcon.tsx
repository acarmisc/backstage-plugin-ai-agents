import React from 'react';
import {
  RiArticleLine,
  RiBugLine,
  RiCodeLine,
  RiDashboardLine,
  RiFileTextLine,
  RiGlobalLine,
  RiLinkM,
} from '@remixicon/react';

const LINK_ICON: Record<string, React.ReactElement> = {
  dashboard: <RiDashboardLine size={16} />,
  docs: <RiFileTextLine size={16} />,
  playbook: <RiArticleLine size={16} />,
  issues: <RiBugLine size={16} />,
  code: <RiCodeLine size={16} />,
  web: <RiGlobalLine size={16} />,
};

/** Icon for a catalog entity link, keyed by its `icon` field. */
export function getLinkIcon(icon?: string): React.ReactElement {
  return LINK_ICON[icon ?? ''] ?? <RiLinkM size={16} />;
}
