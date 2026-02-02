import { NavigationItem } from './NavigationItem';
import type { NavigationItem as NavItem, PageType } from '../types/navigation';
import { LogOut, Bell } from 'lucide-react';

interface HeaderProps {
  activePage: PageType;
  navItems: NavItem[];
  onNavigate: (page: PageType) => void;
  onLogout: () => void;
}

export function Header({ activePage, navItems, onNavigate, onLogout }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface border-b border-border z-40 shadow-premium-sm">
      <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-gray-900 tracking-tight">
            HATVONI INSIDER
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavigationItem
              key={item.id}
              label={item.label}
              isActive={activePage === item.id}
              onClick={() => onNavigate(item.id)}
              variant="horizontal"
            />
          ))}

          <div className="ml-4 pl-4 border-l border-gray-200 flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            <button
              onClick={onLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
