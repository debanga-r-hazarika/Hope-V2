import { Filter, ChevronUp, ChevronDown, Users, Calendar, ArrowUpDown, X, ListFilter, CheckCircle } from 'lucide-react';
import { AgileStatus } from '../../types/agile';
import { ModernCard } from '../ui/ModernCard';
import { MultiSelect, MultiSelectOption } from '../ui/MultiSelect';

interface AgileFiltersProps {
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  filtersActive: boolean;
  filters: {
    statusIds: string[];
    ownerIds: string[];
    dueRange: '' | 'overdue' | 'week' | 'today';
    sort: '' | 'deadline-asc' | 'status-asc';
    readyOnly: boolean;
    assignedOnly: boolean;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    statusIds: string[];
    ownerIds: string[];
    dueRange: '' | 'overdue' | 'week' | 'today';
    sort: '' | 'deadline-asc' | 'status-asc';
    readyOnly: boolean;
    assignedOnly: boolean;
  }>>;
  statuses: AgileStatus[];
  owners: Array<{ id: string; name: string }>;
}

export function AgileFilters({
  showFilters,
  setShowFilters,
  filtersActive,
  filters,
  setFilters,
  statuses,
  owners,
}: AgileFiltersProps) {
  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm appearance-none";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5";

  const clearFilters = () => {
    setFilters({
      statusIds: [],
      ownerIds: [],
      dueRange: '',
      sort: '',
      readyOnly: false,
      assignedOnly: false,
    });
  };

  const statusOptions: MultiSelectOption[] = statuses.map((status) => ({
    value: status.id,
    label: status.name,
  }));

  const ownerOptions: MultiSelectOption[] = owners.map((owner) => ({
    value: owner.id,
    label: owner.name,
  }));

  return (
    <ModernCard padding="none" className="overflow-hidden border border-gray-200 shadow-sm">
      <div 
        onClick={() => setShowFilters(!showFilters)}
        className="w-full flex items-center justify-between px-6 py-4 bg-white hover:bg-gray-50/50 transition-colors cursor-pointer border-b border-transparent md:border-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${filtersActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
            <ListFilter className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-gray-900 block text-sm">Filter & Sort</span>
            <span className="text-xs text-gray-500 font-medium">
              {filtersActive ? 'Filters active' : 'Refine your view'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {filtersActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors hidden sm:block"
            >
              Clear all
            </button>
          )}
          <div className="bg-gray-50 p-2 rounded-lg text-gray-400">
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>
      
      <div className={`
        ${showFilters ? 'block' : 'hidden'} 
        bg-gray-50/30 border-t border-gray-100 p-6 animate-fade-in
      `}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Status Filter */}
          <div className="space-y-1">
            <label className={labelClass}>
              <Filter className="w-3.5 h-3.5" />
              Status
            </label>
            <MultiSelect
              options={statusOptions}
              value={filters.statusIds}
              onChange={(value) => setFilters((prev) => ({ ...prev, statusIds: value }))}
              placeholder="All Statuses"
            />
          </div>

          {/* Owner Filter */}
          <div className="space-y-1">
            <label className={labelClass}>
              <Users className="w-3.5 h-3.5" />
              Assigned To
            </label>
            <MultiSelect
              options={ownerOptions}
              value={filters.ownerIds}
              onChange={(value) => setFilters((prev) => ({ ...prev, ownerIds: value }))}
              placeholder="All Team Members"
            />
          </div>

          {/* Due Date Filter */}
          <div className="space-y-1">
            <label className={labelClass}>
              <Calendar className="w-3.5 h-3.5" />
              Due Date
            </label>
            <div className="relative">
              <select
                value={filters.dueRange}
                onChange={(e) => setFilters((prev) => ({ ...prev, dueRange: e.target.value as typeof prev.dueRange }))}
                className={inputClass}
              >
                <option value="">Any Time</option>
                <option value="today">Due Today</option>
                <option value="week">Due This Week</option>
                <option value="overdue">Overdue</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Sort Filter */}
          <div className="space-y-1">
            <label className={labelClass}>
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort Order
            </label>
            <div className="relative">
              <select
                value={filters.sort}
                onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value as typeof prev.sort }))}
                className={inputClass}
              >
                <option value="">Default (Manual)</option>
                <option value="deadline-asc">Deadline (Soonest)</option>
                <option value="status-asc">Status (Progress)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Quick Filters Toggle Group */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <label className={labelClass}>Quick Filters</label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFilters(prev => ({ ...prev, readyOnly: !prev.readyOnly }))}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border
                ${filters.readyOnly 
                  ? 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm' 
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <CheckCircle className={`w-4 h-4 ${filters.readyOnly ? 'fill-amber-200' : ''}`} />
              Ready for Review
            </button>
            
            <button
              onClick={() => setFilters(prev => ({ ...prev, assignedOnly: !prev.assignedOnly }))}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border
                ${filters.assignedOnly 
                  ? 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm' 
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <Users className={`w-4 h-4 ${filters.assignedOnly ? 'fill-blue-200' : ''}`} />
              My Tasks Only
            </button>

            {filtersActive && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors ml-auto sm:hidden"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>
    </ModernCard>
  );
}
