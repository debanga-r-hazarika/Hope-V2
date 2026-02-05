import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { ModernButton } from './ModernButton';

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

interface DateRangePickerProps {
  label: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESETS = [
  { label: 'Today', type: 'today' },
  { label: 'This Week', type: 'thisWeek' },
  { label: 'Last Week', type: 'lastWeek' },
  { label: 'This Month', type: 'thisMonth' },
  { label: 'Last 3 Months', type: 'last3Months' },
];

export function DateRangePicker({
  label,
  value,
  onChange,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // New state for Month/Year selection
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    const end = new Date();
    const start = new Date();
    // Reset hours to ensure clean day boundaries
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    switch (preset.type) {
      case 'today':
        // Start and end are already today
        break;
      case 'thisWeek':
        // Assuming week starts on Monday
        const day = start.getDay() || 7; // Get current day number, converting Sun (0) to 7
        if (day !== 1) start.setHours(-24 * (day - 1)); // Go back to Monday
        // end is today
        break;
      case 'lastWeek':
        // Last week Monday to Sunday
        const currentDay = start.getDay() || 7;
        start.setDate(start.getDate() - currentDay - 6); // Previous Monday
        end.setDate(end.getDate() - currentDay); // Previous Sunday
        break;
      case 'thisMonth':
        start.setDate(1);
        // end is today
        break;
      case 'last3Months':
        start.setMonth(start.getMonth() - 2); // Go back 2 more months (current + 2 prev = 3)
        start.setDate(1);
        // end is today
        break;
    }

    onChange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
    setIsOpen(false);
  };

  const handleMonthYearApply = () => {
    const start = new Date(selectedYear, selectedMonth - 1, 1);
    const end = new Date(selectedYear, selectedMonth, 0); // Last day of the month

    onChange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
    setIsOpen(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const displayText = value.startDate && value.endDate
    ? `${formatDate(value.startDate)} - ${formatDate(value.endDate)}`
    : 'Select date range';

  const clearRange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ startDate: null, endDate: null });
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div
        className="w-full min-h-[42px] px-3 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all flex items-center justify-between gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className={`text-sm truncate ${!value.startDate ? 'text-gray-400' : 'text-gray-900'}`}>
            {displayText}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(value.startDate || value.endDate) && (
            <button
              onClick={clearRange}
              className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[100] left-0 mt-1 w-full sm:w-[500px] bg-white border border-gray-200 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="bg-gray-50 p-2 border-b sm:border-b-0 sm:border-r border-gray-100 sm:w-36 flex-shrink-0 flex flex-col gap-1">
            <span className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Quick Select</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className="px-3 py-2 text-xs text-left font-medium text-gray-600 hover:bg-white hover:text-primary rounded-lg transition-colors border border-transparent hover:border-gray-100 hover:shadow-sm"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            {/* Month & Year Selection */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Select Month</h4>
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(0, m - 1).toLocaleString('en', { month: 'short' })}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ModernButton
                  onClick={handleMonthYearApply}
                  size="sm"
                  variant="outline"
                  className="px-3"
                >
                  Go
                </ModernButton>
              </div>
            </div>

            {/* Custom Range */}
            <div className="p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Custom Range</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={value.startDate || ''}
                    onChange={(e) => onChange({ ...value, startDate: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={value.endDate || ''}
                    onChange={(e) => onChange({ ...value, endDate: e.target.value })}
                    min={value.startDate || undefined}
                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <ModernButton
                onClick={() => setIsOpen(false)}
                className="w-full"
                size="sm"
                variant="primary"
              >
                Apply Custom Range
              </ModernButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
