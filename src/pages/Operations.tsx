import { useState } from 'react';
import { Suppliers } from './Suppliers';
import { RawMaterials } from './RawMaterials';
import { RecurringProducts } from './RecurringProducts';
import { Production } from './Production';
import { ProcessedGoods } from './ProcessedGoods';
import { Machines } from './Machines';
import { TagOverview } from './TagOverview';
import { ProductionDocuments } from './ProductionDocuments';
import { ShieldCheck, ArrowLeft, Users, Package, Box, Wrench, Factory, RefreshCw, BarChart3, ChevronRight, FileText } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

type OperationsSection = 'suppliers' | 'raw-materials' | 'recurring-products' | 'production' | 'processed-goods' | 'machines' | 'tag-overview' | 'production-documents';

interface OperationsProps {
  section: OperationsSection | null;
  onNavigateToSection: (section: OperationsSection | null) => void;
  accessLevel: AccessLevel;
  onNavigateToOrder?: (orderId: string) => void;
}

export function Operations({ section, onNavigateToSection, accessLevel, onNavigateToOrder }: OperationsProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  if (accessLevel === 'no-access') {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <ModernCard className="max-w-md w-full text-center p-8 bg-white/50 backdrop-blur-sm">
          <ShieldCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-600">You do not have permission to access the Operations module. Please contact your administrator.</p>
        </ModernCard>
      </div>
    );
  }

  const sections: Array<{
    id: OperationsSection;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    gradient: string;
    isPriority?: boolean;
    category?: 'inventory' | 'manufacturing';
  }> = [
      {
        id: 'tag-overview',
        label: 'Inventory Dashboard',
        description: 'Real-time analytics and inventory status',
        icon: BarChart3,
        color: 'text-white',
        bgColor: 'bg-indigo-600',
        gradient: 'from-indigo-500 via-purple-500 to-pink-500',
        isPriority: true
      },
      {
        id: 'suppliers',
        label: 'Suppliers',
        description: 'Manage vendor relationships',
        icon: Users,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        gradient: 'from-cyan-500 to-blue-500',
        category: 'inventory'
      },
      {
        id: 'raw-materials',
        label: 'Raw Materials',
        description: 'Track inventory lots and stock',
        icon: Package,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        gradient: 'from-emerald-500 to-teal-500',
        category: 'inventory'
      },
      {
        id: 'recurring-products',
        label: 'Recurring Products',
        description: 'Packaging and consumables',
        icon: Box,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        gradient: 'from-amber-500 to-orange-500',
        category: 'inventory'
      },
      {
        id: 'machines',
        label: 'Machines',
        description: 'Equipment maintenance and status',
        icon: Wrench,
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        gradient: 'from-slate-500 to-gray-500',
        category: 'inventory'
      },
      {
        id: 'production',
        label: 'Production',
        description: 'Manage batches and manufacturing',
        icon: Factory,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        gradient: 'from-blue-500 to-cyan-500',
        category: 'manufacturing'
      },
      {
        id: 'processed-goods',
        label: 'Processed Goods',
        description: 'Finished products inventory',
        icon: Box,
        color: 'text-violet-600',
        bgColor: 'bg-violet-50',
        gradient: 'from-violet-500 to-purple-500',
        category: 'manufacturing'
      },
      {
        id: 'production-documents',
        label: 'Production Documents',
        description: 'Recipe & formula documentation',
        icon: FileText,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        gradient: 'from-rose-500 to-pink-500',
        category: 'manufacturing'
      },
    ];

  const currentSection = sections.find(s => s.id === section);
  const Icon = currentSection?.icon || Package;

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const inventorySections = sections.filter(s => s.category === 'inventory');
  const manufacturingSections = sections.filter(s => s.category === 'manufacturing');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header - Adaptive based on state */}
      <div className="-mx-4 px-4 py-4 md:-mx-6 md:px-6 md:py-5 mb-6 border-b border-gray-200/50">
        {section ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigateToSection(null)}
                className="group flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 hover:shadow-md transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <div className="flex items-center gap-3">
                {currentSection && (
                  <div className={`hidden sm:flex w-10 h-10 rounded-lg ${currentSection.bgColor} ${currentSection.color} items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900 leading-tight">{currentSection?.label}</h1>
                  <p className="text-xs text-gray-500 font-medium">Operations Management</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100/80 border border-gray-200 text-gray-600 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                {accessLevel === 'read-write' ? 'Full Access' : 'View Only'}
              </div>
              <ModernButton
                onClick={handleRefresh}
                variant="secondary"
                size="sm"
                className="shadow-sm"
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Refresh
              </ModernButton>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Operations Hub</h1>
              <p className="text-sm text-gray-500 mt-1">Central command for manufacturing and inventory</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {accessLevel === 'read-write' ? 'Read & Write' : 'Read Only'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        {!section ? (
          <div className="space-y-8">
            {/* Priority Dashboard Section */}
            {sections.filter(sec => sec.isPriority).map((sec) => {
              const SecIcon = sec.icon;
              return (
                <div
                  key={sec.id}
                  onClick={() => onNavigateToSection(sec.id)}
                  className="relative overflow-hidden rounded-2xl cursor-pointer group shadow-premium hover:shadow-premium-lg transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${sec.gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80')] bg-cover bg-center mix-blend-overlay opacity-10" />

                  <div className="relative p-6 sm:p-8 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                        <SecIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{sec.label}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-white/20 border border-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                            Dashboard
                          </span>
                        </div>
                        <p className="text-blue-50 text-sm sm:text-base max-w-lg">{sec.description}</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm items-center justify-center text-white group-hover:bg-white/20 group-hover:translate-x-1 transition-all">
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Resources & Assets Section */}
            <div className="mb-10">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-500" />
                Resources & Assets
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {sections.filter(sec => ['suppliers', 'raw-materials', 'recurring-products', 'machines'].includes(sec.id)).map((sec) => {
                  const SecIcon = sec.icon;
                  return (
                    <ModernCard
                      key={sec.id}
                      onClick={() => onNavigateToSection(sec.id)}
                      className="group hover:border-blue-200 transition-all duration-200 active:scale-[0.99]"
                      padding="lg"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-xl ${sec.bgColor} ${sec.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                          <SecIcon className="w-6 h-6" />
                        </div>
                        <div className="text-gray-300 group-hover:text-blue-500 transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                        {sec.label}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {sec.description}
                      </p>
                    </ModernCard>
                  );
                })}
              </div>
            </div>

            {/* Production & Output Section */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Factory className="w-5 h-5 text-gray-500" />
                Production & Output
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {sections.filter(sec => ['production', 'processed-goods', 'production-documents'].includes(sec.id)).map((sec) => {
                  const SecIcon = sec.icon;
                  return (
                    <ModernCard
                      key={sec.id}
                      onClick={() => onNavigateToSection(sec.id)}
                      className="group hover:border-blue-200 transition-all duration-200 active:scale-[0.99]"
                      padding="lg"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-xl ${sec.bgColor} ${sec.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                          <SecIcon className="w-6 h-6" />
                        </div>
                        <div className="text-gray-300 group-hover:text-blue-500 transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                        {sec.label}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {sec.description}
                      </p>
                    </ModernCard>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-[500px] animate-slide-down">
            {section === 'suppliers' && <Suppliers key={refreshKey} accessLevel={accessLevel} />}
            {section === 'raw-materials' && <RawMaterials key={refreshKey} accessLevel={accessLevel} />}
            {section === 'recurring-products' && <RecurringProducts key={refreshKey} accessLevel={accessLevel} />}
            {section === 'production' && <Production key={refreshKey} accessLevel={accessLevel} />}
            {section === 'processed-goods' && <ProcessedGoods key={refreshKey} accessLevel={accessLevel} onNavigateToSection={onNavigateToSection} onNavigateToOrder={onNavigateToOrder} />}
            {section === 'machines' && <Machines key={refreshKey} accessLevel={accessLevel} />}
            {section === 'tag-overview' && <TagOverview key={refreshKey} accessLevel={accessLevel} />}
            {section === 'production-documents' && <ProductionDocuments key={refreshKey} accessLevel={accessLevel} />}
          </div>
        )}
      </div>
    </div>
  );
}
