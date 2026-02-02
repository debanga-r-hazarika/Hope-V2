import React, { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ModernButton } from './ModernButton';

interface FilterPanelProps {
  children: React.ReactNode;
  onClearAll: () => void;
  activeFiltersCount: number;
  className?: string;
}

export function FilterPanel({
  children,
  onClearAll,
  activeFiltersCount,
  className = '',
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`bg-gray-50/50 border border-gray-200 rounded-2xl transition-all duration-300 ${className}`}>
      {/* Header / Mobile Toggle */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer sm:cursor-default"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm text-gray-500">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Filters</h3>
            <p className="text-xs text-gray-500 hidden sm:block">Refine your search results</p>
            <p className="text-xs text-gray-500 sm:hidden">
              {activeFiltersCount > 0 ? `${activeFiltersCount} active filters` : 'Tap to expand'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearAll();
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          )}
          <div className="sm:hidden text-gray-400">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`
        border-t border-gray-200 bg-white rounded-b-2xl
        ${isExpanded ? 'block' : 'hidden sm:block'}
      `}>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {children}
        </div>
      </div>
    </div>
  );
}
