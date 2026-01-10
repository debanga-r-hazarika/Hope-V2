import { useState } from 'react';
import { Suppliers } from './Suppliers';
import { RawMaterials } from './RawMaterials';
import { RecurringProducts } from './RecurringProducts';
import { Production } from './Production';
import { ProcessedGoods } from './ProcessedGoods';
import { Machines } from './Machines';
import { WasteTransferManagement } from './WasteTransferManagement';
import { TagOverview } from './TagOverview';
import { ShieldCheck, ArrowLeft, Users, Package, Box, Wrench, AlertTriangle, Factory, RefreshCw, TrendingUp, BarChart3 } from 'lucide-react';
import type { AccessLevel } from '../types/access';

type OperationsSection = 'suppliers' | 'raw-materials' | 'recurring-products' | 'production' | 'processed-goods' | 'machines' | 'waste-transfer' | 'tag-overview';

interface OperationsProps {
  section: OperationsSection | null;
  onNavigateToSection: (section: OperationsSection | null) => void;
  accessLevel: AccessLevel;
}

export function Operations({ section, onNavigateToSection, accessLevel }: OperationsProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  if (accessLevel === 'no-access') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-700">
        You do not have access to the Operations module. Please contact an administrator.
      </div>
    );
  }

  const sections: Array<{ 
    id: OperationsSection; 
    label: string; 
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    isPriority?: boolean; // For priority/dashboard sections
  }> = [
    { id: 'tag-overview', label: 'Inventory Dashboard', icon: BarChart3, color: 'text-white', bgColor: 'bg-gradient-to-br from-indigo-500 to-purple-600', isPriority: true },
    { id: 'suppliers', label: 'Suppliers', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { id: 'raw-materials', label: 'Raw Materials', icon: Package, color: 'text-green-600', bgColor: 'bg-green-100' },
    { id: 'recurring-products', label: 'Recurring Products', icon: Box, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    { id: 'production', label: 'Production', icon: Factory, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { id: 'processed-goods', label: 'Processed Goods', icon: Box, color: 'text-teal-600', bgColor: 'bg-teal-100' },
    { id: 'machines', label: 'Machines & Hardware', icon: Wrench, color: 'text-gray-600', bgColor: 'bg-gray-100' },
    { id: 'waste-transfer', label: 'Waste & Transfer', icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  ];

  const currentSection = sections.find(s => s.id === section);
  const Icon = currentSection?.icon || Package;

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-4">
      {/* Header - Only show when no section selected or show back button when section selected */}
      {section ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <button
            onClick={() => onNavigateToSection(null)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Operations</span>
          </button>
          <div className="flex items-center gap-3">
            {currentSection && (
              <div className={`w-10 h-10 rounded-lg ${currentSection.bgColor} ${currentSection.color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{currentSection?.label || 'Operations'}</h1>
              <p className="text-xs text-gray-500 mt-0.5">Operations Module</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                <ShieldCheck className="w-3 h-3" />
                {accessLevel === 'read-write' ? 'R/W' : 'Read'}
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Full Refresh</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Operations</h1>
              <p className="mt-1 md:mt-2 text-sm md:text-base text-gray-600">
                Manage production, inventory, and operations
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs md:text-sm">
              <ShieldCheck className="w-3 h-3 md:w-4 md:h-4" />
              {accessLevel === 'read-write' ? 'Read & Write' : 'Read Only'}
            </div>
          </div>
        </div>
      )}

      {/* Card Navigation - Only show when no section is selected */}
      {!section && (
        <div className="space-y-4">
          {/* Priority Dashboard Section - Full Width */}
          {sections.filter(sec => sec.isPriority).map((sec) => {
            const SecIcon = sec.icon;
            return (
              <button
                key={sec.id}
                onClick={() => onNavigateToSection(sec.id)}
                className="w-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border-2 border-indigo-400 rounded-2xl p-6 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all text-left group relative overflow-hidden"
              >
                {/* Animated background gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="relative flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-lg">
                    <SecIcon className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white text-xl">{sec.label}</h3>
                      <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold rounded-full border border-white/30">
                        PRIORITY
                      </span>
                    </div>
                    <p className="text-sm text-white/90 mt-0.5">Real-time inventory analytics by tags</p>
                  </div>
                  <div className="text-white/80 group-hover:text-white group-hover:translate-x-1 transition-all">
                    <ArrowLeft className="w-6 h-6 rotate-180" />
                  </div>
                </div>
              </button>
            );
          })}
          
          {/* Regular Sections Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.filter(sec => !sec.isPriority).map((sec) => {
              const SecIcon = sec.icon;
              return (
                <button
                  key={sec.id}
                  onClick={() => onNavigateToSection(sec.id)}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-md active:scale-[0.98] transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${sec.bgColor} ${sec.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <SecIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base">{sec.label}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">View & manage</p>
                    </div>
                    <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content - Only show when section is selected */}
      {section && (
        <div className="min-h-[400px]">
          {section === 'suppliers' && <Suppliers key={refreshKey} accessLevel={accessLevel} />}
          {section === 'raw-materials' && <RawMaterials key={refreshKey} accessLevel={accessLevel} />}
          {section === 'recurring-products' && <RecurringProducts key={refreshKey} accessLevel={accessLevel} />}
          {section === 'production' && <Production key={refreshKey} accessLevel={accessLevel} />}
          {section === 'processed-goods' && <ProcessedGoods key={refreshKey} accessLevel={accessLevel} />}
          {section === 'machines' && <Machines key={refreshKey} accessLevel={accessLevel} />}
          {section === 'waste-transfer' && <WasteTransferManagement key={refreshKey} accessLevel={accessLevel} />}
          {section === 'tag-overview' && <TagOverview key={refreshKey} accessLevel={accessLevel} />}
        </div>
      )}
    </div>
  );
}
