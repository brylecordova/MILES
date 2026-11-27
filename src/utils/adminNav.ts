export type AdminTabId =
  | 'analytics'
  | 'submissions'
  | 'courses'
  | 'branding'
  | 'distribution';

export interface AdminNavItem {
  id: AdminTabId;
  label: string;
  description: string;
}

export interface AdminNavCluster {
  id: string;
  label: string;
  items: readonly AdminNavItem[];
}

export const ADMIN_NAV_CLUSTERS: readonly AdminNavCluster[] = [
  {
    id: 'certificates-reporting',
    label: 'Certificates & Reporting',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        description: 'Downloads, completions, reading time & capacity',
      },
      {
        id: 'submissions',
        label: 'Submissions',
        description: 'Review quiz attempts & approve certificates',
      },
    ],
  },
  {
    id: 'curriculum-management',
    label: 'Curriculum Management',
    items: [
      {
        id: 'courses',
        label: 'Courses',
        description: 'Catalog, lessons, quizzes & certificate designer',
      },
    ],
  },
  {
    id: 'system-settings',
    label: 'System Settings',
    items: [
      {
        id: 'branding',
        label: 'Branding & Identity',
        description: 'System name, colors, icon & branded source ZIP',
      },
      {
        id: 'distribution',
        label: 'App Distribution',
        description: 'Direct APK release & Google Play store link',
      },
    ],
  },
] as const;

export function getAdminClusterForTab(tab: AdminTabId): AdminNavCluster {
  return (
    ADMIN_NAV_CLUSTERS.find((cluster) => cluster.items.some((item) => item.id === tab)) ??
    ADMIN_NAV_CLUSTERS[0]
  );
}
