import { useMemo, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  FileText,
  KanbanSquare,
  Factory,
  ShoppingCart
} from 'lucide-react';
import type { ModuleAccessMap } from '../types/access';
import { MODULE_DEFINITIONS, type ModuleId } from '../types/modules';

interface Module {
  id: ModuleId;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface DashboardProps {
  onNavigateToModule?: (moduleId: ModuleId) => void;
  moduleAccess: ModuleAccessMap;
}

const MODULE_ICON_MAP: Record<
  ModuleId,
  { icon: React.ElementType; color: string }
> = {
  finance: { icon: DollarSign, color: 'bg-green-50 text-green-600' },
  analytics: { icon: TrendingUp, color: 'bg-pink-50 text-pink-600' },
  documents: { icon: FileText, color: 'bg-indigo-50 text-indigo-600' },
  agile: { icon: KanbanSquare, color: 'bg-sky-50 text-sky-600' },
  operations: { icon: Factory, color: 'bg-orange-50 text-orange-600' },
  sales: { icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
};

export function Dashboard({ onNavigateToModule, moduleAccess }: DashboardProps) {
  const [showMessage, setShowMessage] = useState(false);

  const modules: Module[] = useMemo(
    () =>
      MODULE_DEFINITIONS.map((definition) => {
        const meta = MODULE_ICON_MAP[definition.id];
        return {
          id: definition.id,
          title: definition.name,
          description: definition.description,
          icon: meta.icon,
          color: meta.color,
        };
      }),
    []
  );

  const handleModuleClick = (moduleId: ModuleId) => {
    if (
      onNavigateToModule &&
      (moduleId === 'finance' || moduleId === 'documents' || moduleId === 'agile' || moduleId === 'operations' || moduleId === 'sales')
    ) {
      onNavigateToModule(moduleId);
      return;
    }

    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome to HATVONI INSIDER
        </p>
      </div>

      {showMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-blue-600 text-white px-8 py-4 rounded-lg shadow-xl flex items-center gap-3 min-w-[400px]">
            <div className="flex-1">
              <span className="font-semibold text-lg">Feature in Development</span>
              <p className="text-blue-100 text-sm mt-1">This module is currently being built</p>
            </div>
            <button
              onClick={() => setShowMessage(false)}
              className="text-white hover:bg-blue-700 rounded-full p-1 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {modules.filter((module) => moduleAccess[module.id] !== 'no-access').length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-12">
            You do not have access to any modules yet.
          </div>
        ) : (
          modules
            .filter((module) => moduleAccess[module.id] !== 'no-access')
            .map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              onClick={() => handleModuleClick(module.id)}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-all hover:scale-105 text-left"
            >
              <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center mb-4`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {module.title}
              </h3>
              <p className="text-sm text-gray-600">
                {module.description}
              </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
