import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select...',
  className = '',
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

  const handleToggle = (value: string) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(newSelected);
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== value));
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div
        className="w-full min-h-[42px] px-3 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1.5">
          {selectedValues.length === 0 && (
            <span className="text-gray-400 text-sm">{placeholder}</span>
          )}
          {selectedValues.map((value) => {
            const option = options.find((o) => o.value === value);
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200"
              >
                {option?.label || value}
                <button
                  onClick={(e) => handleRemove(value, e)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                    isSelected ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  onClick={() => handleToggle(option.value)}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {option.label}
                </div>
              );
            })}
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400 text-center">No options available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
