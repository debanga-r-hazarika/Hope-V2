export type PageType = 'dashboard' | 'users' | 'profile' | 'finance' | 'documents' | 'agile' | 'operations' | 'sales' | 'admin';

export interface NavigationItem {
  id: PageType;
  label: string;
  isLogout?: boolean;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'finance', label: 'Finance' },
  { id: 'documents', label: 'Documents' },
  { id: 'agile', label: 'Agile' },
  { id: 'operations', label: 'Operations' },
  { id: 'sales', label: 'Sales' },
  { id: 'users', label: 'Users' },
  { id: 'admin', label: 'Admin' },
  { id: 'profile', label: 'My Profile' },
];
