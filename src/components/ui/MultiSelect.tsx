import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectProps {
  label?: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ 
  label, 
  options, 
  value = [], 
  onChange, 
  placeholder = 'Select...',
  className = ''
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(item => item !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full text-left text-sm border border-gray-200 rounded-lg bg-gray-50/50 px-3 py-2.5 flex items-center justify-between focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white"
        >
          <span className={`block truncate ${value.length === 0 ? 'text-gray-500' : 'text-gray-900'}`}>
            {value.length === 0 
              ? placeholder 
              : value.length === 1 
                ? options.find(o => o.value === value[0])?.label || value[0]
                : `${value.length} selected`}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100">
            <div className="p-1 space-y-0.5">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-400 text-center">No options available</div>
              ) : (
                options.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md cursor-pointer transition-colors"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      value.includes(option.value) 
                        ? 'bg-blue-600 border-blue-600' 
                        : 'border-gray-300 bg-white'
                    }`}>
                      {value.includes(option.value) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
