import React, { useState, useEffect } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Save, Check } from 'lucide-react';
import { MultiSelect } from './MultiSelect';

export interface FilterState {
  search: string;
  deliveryStatus: string[];
  paymentStatus: string[];
  orderStatus: string[];
  dateFrom: string;
  dateTo: string;
  customerType: string[];
  productType: string[];
  paymentMode: string[];
  minAmount: string;
  maxAmount: string;
}

export const initialFilterState: FilterState = {
  search: '',
  deliveryStatus: [],
  paymentStatus: [],
  orderStatus: [],
  dateFrom: '',
  dateTo: '',
  customerType: [],
  productType: [],
  paymentMode: [],
  minAmount: '',
  maxAmount: '',
};

interface SavedPreset {
  id: string;
  name: string;
  filters: FilterState;
}

interface AdvancedFilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onClear: () => void;
  productTypes: string[];
  customerTypes: string[];
  className?: string;
}

export function AdvancedFilterPanel({
  filters,
  onChange,
  onClear,
  productTypes,
  customerTypes,
  className = '',
}: AdvancedFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Load presets from local storage
  useEffect(() => {
    const saved = localStorage.getItem('orderFilterPresets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved presets', e);
      }
    }
  }, []);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: SavedPreset = {
      id: Date.now().toString(),
      name: newPresetName,
      filters: { ...filters },
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('orderFilterPresets', JSON.stringify(updated));
    setNewPresetName('');
    setShowSavePreset(false);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    onChange(preset.filters);
  };

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('orderFilterPresets', JSON.stringify(updated));
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const activeCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return false; 
    if (Array.isArray(value)) return value.length > 0;
    if (value === '') return false;
    return true;
  }).length;

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm transition-all duration-300 ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Advanced Filters</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{activeCount} active filters</span>
              {activeCount > 0 && (
                <span className="text-purple-600 font-medium cursor-pointer hover:underline" onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}>
                  Clear all
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-100 space-y-6">
          
          {/* Presets Section */}
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Presets:</span>
              {presets.length === 0 && <span className="text-xs text-gray-400 italic">No saved presets</span>}
              {presets.map(preset => (
                <div key={preset.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs shadow-sm">
                  <span 
                    className="cursor-pointer font-medium hover:text-purple-600"
                    onClick={() => handleLoadPreset(preset)}
                  >
                    {preset.name}
                  </span>
                  <button 
                    onClick={() => handleDeletePreset(preset.id)}
                    className="text-gray-400 hover:text-red-500 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-4">
              {showSavePreset ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                  <input 
                    type="text" 
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-purple-500 w-32"
                    autoFocus
                  />
                  <button onClick={handleSavePreset} className="text-green-600 hover:bg-green-50 p-1 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowSavePreset(false)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowSavePreset(true)}
                  className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                >
                  <Save className="w-3 h-3" />
                  Save Current
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Status Group */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1">Status</h4>
              
              <MultiSelect
                label="Delivery Status"
                selected={filters.deliveryStatus}
                onChange={(vals) => updateFilter('deliveryStatus', vals)}
                options={[
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'READY_FOR_DELIVERY', label: 'Ready for Delivery' },
                  { value: 'PARTIALLY_DELIVERED', label: 'Partially Delivered' },
                  { value: 'DELIVERY_COMPLETED', label: 'Delivery Completed' },
                ]}
                placeholder="All Statuses"
              />

              <MultiSelect
                label="Payment Status"
                selected={filters.paymentStatus}
                onChange={(vals) => updateFilter('paymentStatus', vals)}
                options={[
                  { value: 'READY_FOR_PAYMENT', label: 'Ready for Payment' },
                  { value: 'PARTIAL_PAYMENT', label: 'Partially Paid' },
                  { value: 'FULL_PAYMENT', label: 'Fully Paid' },
                ]}
                placeholder="All Payments"
              />

              <MultiSelect
                label="Order State"
                selected={filters.orderStatus}
                onChange={(vals) => updateFilter('orderStatus', vals)}
                options={[
                  { value: 'ORDER_COMPLETED', label: 'Completed Orders' },
                  { value: 'CANCELLED', label: 'Cancelled Orders' },
                ]}
                placeholder="All States"
              />
            </div>

            {/* Date & Amount Group */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1">Time & Value</h4>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    className="w-full text-xs border-gray-200 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-gray-50/50"
                  />
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    className="w-full text-xs border-gray-200 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-gray-50/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Order Amount (₹)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minAmount}
                    onChange={(e) => updateFilter('minAmount', e.target.value)}
                    className="w-full text-sm border-gray-200 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-gray-50/50"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxAmount}
                    onChange={(e) => updateFilter('maxAmount', e.target.value)}
                    className="w-full text-sm border-gray-200 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-gray-50/50"
                  />
                </div>
              </div>
            </div>

            {/* Details Group */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1">Details</h4>
              
              <MultiSelect
                label="Customer Type"
                selected={filters.customerType}
                onChange={(vals) => updateFilter('customerType', vals)}
                options={customerTypes.map(type => ({ value: type, label: type }))}
                placeholder="All Types"
              />

              <MultiSelect
                label="Payment Method"
                selected={filters.paymentMode}
                onChange={(vals) => updateFilter('paymentMode', vals)}
                options={[
                  { value: 'Cash', label: 'Cash' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'Bank', label: 'Bank Transfer' },
                ]}
                placeholder="All Methods"
              />
            </div>

             {/* Products Group */}
             <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1">Products</h4>
              
              <MultiSelect
                label="Contains Product"
                selected={filters.productType}
                onChange={(vals) => updateFilter('productType', vals)}
                options={productTypes.map(type => ({ value: type, label: type }))}
                placeholder="Any Product"
              />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
