import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';

interface Tag {
  id: string;
  display_name: string;
  tag_key?: string;
}

interface SearchableTagDropdownProps {
  tags: Tag[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  multiple?: boolean;
  emptyMessage?: string;
  colorScheme?: 'green' | 'purple' | 'blue';
  disabled?: boolean;
}

export function SearchableTagDropdown({
  tags,
  selectedIds,
  onChange,
  placeholder = 'Select tags...',
  label,
  required = false,
  multiple = true,
  emptyMessage = 'No tags available',
  colorScheme = 'green',
  disabled = false,
}: SearchableTagDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Color scheme classes
  const colorClasses = {
    green: {
      border: 'border-green-500',
      ring: 'focus:ring-green-500',
      bg: 'bg-green-50',
      text: 'text-green-700',
      checkbox: 'text-green-600',
    },
    purple: {
      border: 'border-purple-500',
      ring: 'focus:ring-purple-500',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      checkbox: 'text-purple-600',
    },
    blue: {
      border: 'border-blue-500',
      ring: 'focus:ring-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      checkbox: 'text-blue-600',
    },
  };

  const colors = colorClasses[colorScheme];

  // Sort tags alphabetically
  const sortedTags = [...tags].sort((a, b) => 
    a.display_name.localeCompare(b.display_name)
  );

  // Filter tags based on search query
  const filteredTags = sortedTags.filter((tag) =>
    tag.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tag.tag_key && tag.tag_key.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get selected tags for display
  const selectedTags = sortedTags.filter((tag) => selectedIds.includes(tag.id));

  // Handle tag selection
  const handleTagToggle = (tagId: string) => {
    if (disabled) return;

    if (multiple) {
      if (selectedIds.includes(tagId)) {
        onChange(selectedIds.filter((id) => id !== tagId));
      } else {
        onChange([...selectedIds, tagId]);
      }
    } else {
      onChange([tagId]);
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  // Remove a selected tag
  const handleRemoveTag = (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter((id) => id !== tagId));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
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

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="w-full" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Dropdown Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-3 py-2.5 text-left bg-white border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 ${colors.ring} focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-all duration-200
            ${isOpen ? `${colors.border} border-2` : 'hover:border-gray-400'}
            min-h-[42px] flex items-center justify-between gap-2
          `}
          onKeyDown={handleKeyDown}
        >
          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[24px]">
            {selectedTags.length === 0 ? (
              <span className="text-gray-500 text-sm">{placeholder}</span>
            ) : (
              selectedTags.map((tag) => (
                <span
                  key={tag.id}
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
                    ${colors.bg} ${colors.text}
                    ${disabled ? 'opacity-60' : ''}
                  `}
                >
                  {tag.display_name}
                  {!disabled && multiple && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveTag(e, tag.id)}
                      className="hover:bg-opacity-80 rounded-full p-0.5 transition-colors"
                      aria-label={`Remove ${tag.display_name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))
            )}
          </div>
          <ChevronDown
            className={`
              w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200
              ${isOpen ? 'transform rotate-180' : ''}
            `}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className={`
              absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg
              max-h-64 overflow-hidden flex flex-col
            `}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tags..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* Tags List */}
            <div className="overflow-y-auto flex-1">
              {filteredTags.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {searchQuery ? 'No tags found' : emptyMessage}
                </div>
              ) : (
                <div className="p-1">
                  {filteredTags.map((tag) => {
                    const isSelected = selectedIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleTagToggle(tag.id)}
                        className={`
                          w-full text-left px-3 py-2 rounded-md text-sm
                          transition-colors duration-150
                          flex items-center gap-2
                          ${isSelected ? colors.bg : 'hover:bg-gray-50'}
                        `}
                      >
                        <div className={`
                          w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0
                          ${isSelected ? `${colors.checkbox} border-current` : 'border-gray-300'}
                        `}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-700 font-medium truncate">
                            {tag.display_name}
                          </div>
                          {tag.tag_key && (
                            <div className="text-xs text-gray-500 truncate">
                              {tag.tag_key}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Count (for multiple selection) */}
            {multiple && selectedTags.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
