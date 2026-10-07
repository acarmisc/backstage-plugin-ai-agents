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
  dashboard: <RiDashboardLine size={20} />,
  docs: <RiFileTextLine size={20} />,
  playbook: <RiArticleLine size={20} />,
  issues: <RiBugLine size={20} />,
  code: <RiCodeLine size={20} />,
  web: <RiGlobalLine size={20} />,
};

/** Icon for a catalog entity link, keyed by its `icon` field. */
export function getLinkIcon(icon?: string): React.ReactElement {
  return LINK_ICON[icon ?? ''] ?? <RiLinkM size={20} />;
}
