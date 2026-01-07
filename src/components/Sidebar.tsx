import { NavigationItem } from './NavigationItem';
import type { NavigationItem as NavItem, PageType } from '../types/navigation';

interface SidebarProps {
  activePage: PageType;
  navItems: NavItem[];
  onNavigate: (page: PageType) => void;
  onLogout: () => void;
}

export function Sidebar({ activePage, navItems, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar flex flex-col z-50">
      <div className="px-6 py-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">
          HATVONI INSIDER
        </h1>
      </div>

      <nav className="flex-1 py-4 flex flex-col">
        <div className="flex-1">
          {navItems.map((item) => (
            <NavigationItem
              key={item.id}
              label={item.label}
              isActive={activePage === item.id}
              onClick={() => onNavigate(item.id)}
              variant="vertical"
            />
          ))}
        </div>

        <div className="mt-auto border-t border-gray-700 pt-4">
          <NavigationItem
            label="Log Out"
            isActive={false}
            isLogout
            onClick={onLogout}
            variant="vertical"
          />
        </div>
      </nav>
    </aside>
  );
}
