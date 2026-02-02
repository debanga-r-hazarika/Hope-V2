import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  FileText,
  KanbanSquare,
  Factory,
  ShoppingCart,
  ArrowRight
} from 'lucide-react';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { MODULE_DEFINITIONS, type ModuleId } from '../types/modules';

interface Module {
  id: ModuleId;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
}

interface DashboardProps {
  onNavigateToModule?: (moduleId: ModuleId) => void;
  moduleAccess?: never;
}

const MODULE_ICON_MAP: Record<
  ModuleId,
  { icon: React.ElementType; color: string; borderColor: string }
> = {
  finance: { 
    icon: DollarSign, 
    color: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    borderColor: 'group-hover:border-emerald-200'
  },
  analytics: { 
    icon: TrendingUp, 
    color: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100',
    borderColor: 'group-hover:border-violet-200'
  },
  documents: { 
    icon: FileText, 
    color: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
    borderColor: 'group-hover:border-blue-200'
  },
  agile: { 
    icon: KanbanSquare, 
    color: 'bg-sky-50 text-sky-600 group-hover:bg-sky-100',
    borderColor: 'group-hover:border-sky-200'
  },
  operations: { 
    icon: Factory, 
    color: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
    borderColor: 'group-hover:border-orange-200'
  },
  sales: { 
    icon: ShoppingCart, 
    color: 'bg-fuchsia-50 text-fuchsia-600 group-hover:bg-fuchsia-100',
    borderColor: 'group-hover:border-fuchsia-200'
  },
};

export function Dashboard({ onNavigateToModule }: DashboardProps) {
  const navigate = useNavigate();
  const { access: moduleAccess } = useModuleAccess();

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
          borderColor: meta.borderColor,
        };
      }),
    []
  );

  const handleModuleClick = (moduleId: ModuleId) => {
    if (moduleId === 'finance' || moduleId === 'analytics' || moduleId === 'documents' || moduleId === 'agile' || moduleId === 'operations' || moduleId === 'sales') {
      if (onNavigateToModule) {
        onNavigateToModule(moduleId);
      } else {
        navigate(`/${moduleId}`);
      }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-surface p-8 rounded-2xl shadow-premium border border-border">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="mt-2 text-gray-500 text-lg">
          Welcome to HATVONI INSIDER. Select a module to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.filter((module) => moduleAccess[module.id] !== 'no-access').length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 bg-surface rounded-2xl border border-border border-dashed text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No Modules Available</h3>
            <p className="text-gray-500 mt-2 max-w-sm">
              You do not have access to any modules yet. Please contact your administrator to request access.
            </p>
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
                  className={`
                    group relative overflow-hidden bg-surface p-6 rounded-2xl border border-border 
                    hover:shadow-premium-md transition-all duration-300 hover:-translate-y-1 text-left
                    ${module.borderColor}
                  `}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-14 h-14 rounded-xl ${module.color} flex items-center justify-center transition-colors duration-300 shadow-sm`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowRight className="w-4 h-4 text-gray-600" />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {module.description}
                  </p>
                  
                  <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              );
            })
        )}
      </div>
    </div>
  );
}
