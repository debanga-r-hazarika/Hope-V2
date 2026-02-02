import { NavigationItem } from './NavigationItem';
import type { NavigationItem as NavItem, PageType } from '../types/navigation';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  activePage: PageType;
  navItems: NavItem[];
  onNavigate: (page: PageType) => void;
  onLogout: () => void;
}

export function Sidebar({ activePage, navItems, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar flex flex-col z-50 shadow-premium-lg border-r border-white/5">
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-white tracking-tight">
          HATVONI INSIDER
        </h1>
      </div>

      <nav className="flex-1 py-6 flex flex-col px-2 overflow-y-auto custom-scrollbar">
        <div className="flex-1 space-y-1">
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

        <div className="mt-auto border-t border-white/10 pt-4 px-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/10 rounded-xl transition-all duration-200 group"
          >
            <LogOut className="w-4 h-4 mr-3 group-hover:-translate-x-1 transition-transform" />
            Log Out
          </button>
        </div>
      </nav>
    </aside>
  );
}
