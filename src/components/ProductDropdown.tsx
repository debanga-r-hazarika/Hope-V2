import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { ProcessedGood } from '../types/operations';

interface ProductDropdownProps {
    value: string;
    onChange: (value: string) => void;
    processedGoods: Array<ProcessedGood & { actual_available: number }>;
    disabled?: boolean;
    required?: boolean;
}

export function ProductDropdown({ value, onChange, processedGoods, disabled, required }: ProductDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedProduct = processedGoods.find(pg => pg.id === value);
    const displayText = selectedProduct
        ? `${selectedProduct.product_type} - ${selectedProduct.unit} - ${selectedProduct.batch_reference} - ${selectedProduct.actual_available} available`
        : 'Select product';

    // Filter products based on search term and availability
    const filteredProducts = processedGoods.filter(pg => {
        // Only show products with available quantity > 0
        // Note: If a product is already selected (value === pg.id), we should still show it even if available <= 0 
        // to allow viewing/changing the current selection, but typically we filter by availability for new selections.
        if (pg.actual_available <= 0 && pg.id !== value) return false;

        if (!searchTerm.trim()) return true;
        const search = searchTerm.toLowerCase();
        return (
            pg.product_type?.toLowerCase().includes(search) ||
            pg.batch_reference?.toLowerCase().includes(search) ||
            pg.unit?.toLowerCase().includes(search) ||
            pg.produced_goods_tag_name?.toLowerCase().includes(search)
        );
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); // Clear search when closing
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Focus search input when dropdown opens
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Clear search when dropdown closes
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
          w-full px-4 py-3 text-left bg-white border-2 rounded-xl
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400
          flex items-center justify-between gap-2 text-sm font-medium
          transition-all duration-200
          ${isOpen ? 'border-blue-500 shadow-md' : 'border-gray-300 hover:border-gray-400'}
          ${value ? 'text-gray-900' : 'text-gray-500'}
        `}
            >
                <span className="truncate">{displayText}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-200 sticky top-0 bg-white">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search products..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        <div
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                                setSearchTerm('');
                            }}
                            className={`px-4 py-3 text-sm cursor-pointer transition-colors font-medium ${!value ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            Select product
                        </div>
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map((pg) => (
                                <div
                                    key={pg.id}
                                    onClick={() => {
                                        onChange(pg.id);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`px-4 py-3 text-sm cursor-pointer transition-colors border-l-4 ${value === pg.id
                                            ? 'bg-blue-50 text-blue-700 border-blue-500 font-medium'
                                            : 'text-gray-700 hover:bg-gray-50 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-medium flex-1 min-w-0">{pg.product_type}</div>
                                        <div className="flex-shrink-0">
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full border border-orange-200">
                                                {pg.production_date}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {pg.output_size && pg.output_size_unit ? `${pg.output_size} ${pg.output_size_unit} • ` : ''}
                                        {pg.unit} • Batch: {pg.batch_reference} • Available: {pg.actual_available}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                No products found matching "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>
            )}

            {required && !value && (
                <input
                    type="text"
                    required
                    className="absolute opacity-0 pointer-events-none"
                    tabIndex={-1}
                    value=""
                    onChange={() => { }}
                />
            )}
        </div>
    );
}
