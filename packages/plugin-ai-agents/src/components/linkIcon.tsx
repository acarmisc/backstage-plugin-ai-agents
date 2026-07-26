import React from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import BugReportIcon from '@mui/icons-material/BugReport';
import CodeIcon from '@mui/icons-material/Code';
import LanguageIcon from '@mui/icons-material/Language';
import LinkIcon from '@mui/icons-material/Link';

const LINK_ICON: Record<string, React.ReactElement> = {
  dashboard: <DashboardIcon fontSize="small" />,
  docs: <DescriptionIcon fontSize="small" />,
  playbook: <ArticleIcon fontSize="small" />,
  issues: <BugReportIcon fontSize="small" />,
  code: <CodeIcon fontSize="small" />,
  web: <LanguageIcon fontSize="small" />,
};

/** Icon for a catalog entity link, keyed by its `icon` field. */
export function getLinkIcon(icon?: string): React.ReactElement {
  return LINK_ICON[icon ?? ''] ?? <LinkIcon fontSize="small" />;
}
