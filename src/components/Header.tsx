import { NavigationItem } from './NavigationItem';
import type { NavigationItem as NavItem, PageType } from '../types/navigation';

interface HeaderProps {
  activePage: PageType;
  navItems: NavItem[];
  onNavigate: (page: PageType) => void;
  onLogout: () => void;
}

export function Header({ activePage, navItems, onNavigate, onLogout }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="h-full max-w-full px-6 flex items-center justify-between">
        <div className="text-xl font-bold text-gray-900">
          HATVONI INSIDER
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => (
            <NavigationItem
              key={item.id}
              label={item.label}
              isActive={activePage === item.id}
              onClick={() => onNavigate(item.id)}
              variant="horizontal"
            />
          ))}

          <div className="ml-4 pl-4 border-l border-gray-300">
            <NavigationItem
              label="Log Out"
              isActive={false}
              isLogout
              onClick={onLogout}
              variant="horizontal"
            />
          </div>
        </nav>
      </div>
    </header>
  );
}
