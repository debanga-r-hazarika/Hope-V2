import React, { useState, useEffect } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Save, Check } from 'lucide-react';
import { MultiSelect } from './ui/MultiSelect';
import { DateRangePicker } from './ui/DateRangePicker';

export interface ProcessedGoodsFilterState {
    search: string;
    tags: string[];
    stockStatus: string[];
    dateFrom: string;
    dateTo: string;
}

export const initialProcessedGoodsFilterState: ProcessedGoodsFilterState = {
    search: '',
    tags: [],
    stockStatus: ['in_stock'], // Default to In Stock
    dateFrom: '',
    dateTo: '',
};

interface SavedPreset {
    id: string;
    name: string;
    filters: ProcessedGoodsFilterState;
}

interface ProcessedGoodsFilterPanelProps {
    filters: ProcessedGoodsFilterState;
    onChange: (filters: ProcessedGoodsFilterState) => void;
    onClear: () => void;
    tags: { id: string; display_name: string }[];
    className?: string;
}

export function ProcessedGoodsFilterPanel({
    filters,
    onChange,
    onClear,
    tags,
    className = '',
}: ProcessedGoodsFilterPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [presets, setPresets] = useState<SavedPreset[]>([]);
    const [showSavePreset, setShowSavePreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    // Load presets from local storage
    useEffect(() => {
        const saved = localStorage.getItem('processedGoodsFilterPresets');
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
        localStorage.setItem('processedGoodsFilterPresets', JSON.stringify(updated));
        setNewPresetName('');
        setShowSavePreset(false);
    };

    const handleLoadPreset = (preset: SavedPreset) => {
        onChange(preset.filters);
    };

    const handleDeletePreset = (id: string) => {
        const updated = presets.filter(p => p.id !== id);
        setPresets(updated);
        localStorage.setItem('processedGoodsFilterPresets', JSON.stringify(updated));
    };

    const updateFilter = (key: keyof ProcessedGoodsFilterState, value: any) => {
        onChange({ ...filters, [key]: value });
    };

    const activeCount = Object.entries(filters).filter(([key, value]) => {
        if (key === 'search') return false; // Search is external now
        if (key === 'stockStatus') {
            // Ignore if it matches default ['in_stock']
            if (Array.isArray(value) && value.length === 1 && value[0] === 'in_stock') return false;
            return value.length > 0;
        }
        if (Array.isArray(value)) return value.length > 0;
        if (value === '') return false;
        return true;
    }).length;

    return (
        <div className={`bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-300 ${className}`}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Filter className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Filters</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{activeCount === 0 ? 'No active filters' : `${activeCount} active filters`}</span>
                            {activeCount > 0 && (
                                <span className="text-indigo-600 font-medium cursor-pointer hover:underline ml-1" onClick={(e) => {
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
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Presets:</span>
                            {presets.length === 0 && <span className="text-xs text-gray-400 italic">No saved presets</span>}
                            {presets.map(preset => (
                                <div key={preset.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs shadow-sm hover:border-indigo-200 transition-colors">
                                    <span
                                        className="cursor-pointer font-medium hover:text-indigo-600"
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
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                            {showSavePreset ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                                    <input
                                        type="text"
                                        value={newPresetName}
                                        onChange={(e) => setNewPresetName(e.target.value)}
                                        placeholder="Preset name..."
                                        className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-indigo-500 w-32"
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
                                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                                >
                                    <Save className="w-3 h-3" />
                                    Save Current
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Status Group */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1 flex items-center gap-2">
                                Status
                            </h4>

                            <MultiSelect
                                label="Stock Status"
                                value={filters.stockStatus}
                                onChange={(vals) => updateFilter('stockStatus', vals)}
                                options={[
                                    { value: 'in_stock', label: 'In Stock' },
                                    { value: 'out_of_stock', label: 'Out of Stock' },
                                ]}
                                placeholder="Select Status"
                            />
                        </div>

                        {/* Tag Group */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1 flex items-center gap-2">
                                Product Tag
                            </h4>
                            <MultiSelect
                                label="Product Tag"
                                value={filters.tags}
                                onChange={(vals) => updateFilter('tags', vals)}
                                options={tags.map(t => ({ value: t.id, label: t.display_name })).concat({ value: 'no_tag', label: 'No Tag' })}
                                placeholder="All Tags"
                            />
                        </div>

                        {/* Date Range Group */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1 flex items-center gap-2">
                                Timeline
                            </h4>
                            <DateRangePicker
                                label="Production Date Range"
                                value={{
                                    startDate: filters.dateFrom || null,
                                    endDate: filters.dateTo || null
                                }}
                                onChange={(range) => {
                                    onChange({
                                        ...filters,
                                        dateFrom: range.startDate || '',
                                        dateTo: range.endDate || ''
                                    });
                                }}
                            />
                        </div>
                    </div>
                    {/* Tip */}
                    <div className="pt-2 border-t border-gray-50">
                        <p className="text-xs text-gray-400">
                            Tip: Use presets to save your favorite filter configurations.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
