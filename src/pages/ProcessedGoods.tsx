import { useEffect, useState, useMemo, useRef } from 'react';
import { RefreshCw, Box, Search, Filter, ArrowUpDown, Download, X } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { ProcessedGood } from '../types/operations';
import { fetchProcessedGoods, fixProcessedGoodsProductionDates } from '../lib/operations';
import { ProcessedGoodDetailsModal } from '../components/ProcessedGoodDetailsModal';
import { exportProcessedGoods } from '../utils/excelExport';
import { fetchProducedGoodsTags } from '../lib/tags';
import type { ProducedGoodsTag } from '../types/tags';

interface ProcessedGoodsProps {
  accessLevel: AccessLevel;
  onNavigateToSection?: (section: string) => void;
  onNavigateToOrder?: (orderId: string) => void;
}

export function ProcessedGoods({ accessLevel, onNavigateToSection, onNavigateToOrder }: ProcessedGoodsProps) {
  const [goods, setGoods] = useState<ProcessedGood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGood, setSelectedGood] = useState<ProcessedGood | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [producedGoodsTags, setProducedGoodsTags] = useState<ProducedGoodsTag[]>([]);
  const goodsListRef = useRef<HTMLDivElement>(null);

  // Search, Filter, and Sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [qaStatusFilter, setQaStatusFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [showZeroQuantity, setShowZeroQuantity] = useState<boolean>(false); // Hide zero quantity by default
  const [sortBy, setSortBy] = useState<'date' | 'quantity' | 'product_type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, tagsData] = await Promise.all([
        fetchProcessedGoods(),
        fetchProducedGoodsTags(false), // Only active tags
      ]);
      setGoods(data);
      setProducedGoodsTags(tagsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load processed goods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    void loadData();
  }, [accessLevel]);

  // Filtered and sorted processed goods
  const filteredAndSortedGoods = useMemo(() => {
    let filtered = goods.filter((good) => {
      // Calculate available quantity using the same logic as display: Created - Delivered
      const totalCreated = good.quantity_created ?? good.quantity_available;
      const totalDelivered = good.quantity_delivered ?? 0;
      const availableQuantity = totalCreated - totalDelivered;
      const isZeroQuantity = availableQuantity <= 0;

      // Zero quantity filter (hide by default, but allow when checkbox is checked)
      if (!showZeroQuantity && isZeroQuantity) {
        return false;
      }

      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        good.product_type.toLowerCase().includes(searchLower) ||
        good.batch_reference.toLowerCase().includes(searchLower);

      // QA Status filter
      const matchesQaStatus = qaStatusFilter === 'all' || good.qa_status === qaStatusFilter;

      // Stock Status filter
      // When showing zero quantity, allow zero quantity items to pass through regardless of stock status filter
      const matchesStockStatus = 
        stockStatusFilter === 'all' ||
        (showZeroQuantity && isZeroQuantity) || // If showing zero quantity, always include zero quantity items
        (stockStatusFilter === 'in_stock' && availableQuantity > 0) ||
        (stockStatusFilter === 'out_of_stock' && availableQuantity <= 0);

      // Tag filter
      const matchesTag = 
        tagFilter === 'all' ||
        (tagFilter === 'no_tag' && !good.produced_goods_tag_id) ||
        good.produced_goods_tag_id === tagFilter;

      return matchesSearch && matchesQaStatus && matchesStockStatus && matchesTag;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        // First compare by production_date
        const dateComparison = new Date(a.production_date).getTime() - new Date(b.production_date).getTime();
        // If dates are the same, use created_at as tiebreaker for proper sorting
        if (dateComparison === 0) {
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else {
          comparison = dateComparison;
        }
      } else if (sortBy === 'quantity') {
        // Use the same calculation as display: Created - Delivered
        const aCreated = a.quantity_created ?? a.quantity_available;
        const aDelivered = a.quantity_delivered ?? 0;
        const aAvailable = aCreated - aDelivered;
        
        const bCreated = b.quantity_created ?? b.quantity_available;
        const bDelivered = b.quantity_delivered ?? 0;
        const bAvailable = bCreated - bDelivered;
        
        comparison = aAvailable - bAvailable;
      } else if (sortBy === 'product_type') {
        comparison = a.product_type.localeCompare(b.product_type);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [goods, searchQuery, qaStatusFilter, stockStatusFilter, tagFilter, showZeroQuantity, sortBy, sortOrder]);

  // Calculate tag-based summaries
  const tagSummaries = useMemo(() => {
    const tagMap = new Map<string, {
      tagId: string;
      tagDisplayName: string;
      goods: Array<ProcessedGood & { actual_available?: number }>;
      totalQuantity: number;
      unit: string;
    }>();

    // Initialize with all admin-defined tags (including those with 0 lots)
    producedGoodsTags.forEach((tag) => {
      tagMap.set(tag.id, {
        tagId: tag.id,
        tagDisplayName: tag.display_name,
        goods: [],
        totalQuantity: 0,
        unit: '', // Will be set when goods are found
      });
    });

    // Also add "No Tag" entry for goods without tags
    tagMap.set('no_tag', {
      tagId: 'no_tag',
      tagDisplayName: 'No Tag',
      goods: [],
      totalQuantity: 0,
      unit: '',
    });

    // Group goods by tag and populate tag summaries
    goods.forEach((good) => {
      const tagId = good.produced_goods_tag_id || 'no_tag';
      // Use the same calculation as display: Created - Delivered
      const totalCreated = good.quantity_created ?? good.quantity_available;
      const totalDelivered = good.quantity_delivered ?? 0;
      const availableQuantity = totalCreated - totalDelivered;

      // If tag doesn't exist in map (shouldn't happen, but handle gracefully)
      if (!tagMap.has(tagId)) {
        const tagDisplayName = good.produced_goods_tag_name || 'No Tag';
        tagMap.set(tagId, {
          tagId,
          tagDisplayName,
          goods: [],
          totalQuantity: 0,
          unit: good.unit,
        });
      }

      const tagSummary = tagMap.get(tagId)!;
      tagSummary.goods.push(good);
      tagSummary.totalQuantity += availableQuantity;
      // Use the first unit found (assuming all goods with same tag have same unit)
      if (!tagSummary.unit) {
        tagSummary.unit = good.unit;
      }
    });

    // Convert to array and sort by display name
    return Array.from(tagMap.values()).sort((a, b) => 
      a.tagDisplayName.localeCompare(b.tagDisplayName)
    );
  }, [goods, producedGoodsTags]);

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Operations module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm flex-1">
          Note: Processed goods are automatically created from approved production batches. Manual entry is not allowed.
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await fixProcessedGoodsProductionDates();
                alert('Production dates fixed successfully! Please refresh the page.');
              } catch (error) {
                console.error('Failed to fix production dates:', error);
                alert('Failed to fix production dates. Please check the console for details.');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
            title="Fix production dates for existing processed goods"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Fix Dates</span>
          </button>
          <button
            onClick={() => exportProcessedGoods(filteredAndSortedGoods)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
            title="Export filtered processed goods to Excel"
          >
            <Download className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Tag-based Summary - Horizontal Scrollable */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Produced Goods by Tag</h3>
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            <p className="mt-2 text-sm text-gray-600">Loading tag summaries...</p>
          </div>
        ) : tagSummaries.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-4">No processed goods found</p>
        ) : (
          <div className="relative">
            {/* Scrollable container with custom scrollbar */}
            <div 
              className="overflow-x-auto pb-3 tag-scrollbar relative z-20"
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'smooth',
              }}
            >
              <div className="flex gap-4 min-w-max px-12 py-1">
                {tagSummaries.map((summary) => (
                  <button
                    key={summary.tagId}
                    onClick={() => {
                      // Set the tag filter
                      setTagFilter(summary.tagId === 'no_tag' ? 'no_tag' : summary.tagId);
                      // Scroll to goods list after a short delay to ensure filter is applied
                      setTimeout(() => {
                        goodsListRef.current?.scrollIntoView({ 
                          behavior: 'smooth', 
                          block: 'start',
                          inline: 'nearest'
                        });
                      }, 150);
                    }}
                    className={`
                      bg-gradient-to-br from-white via-gray-50 to-gray-100
                      border-2 rounded-xl p-4 min-w-[200px] max-w-[240px] flex-shrink-0
                      hover:shadow-xl hover:scale-[1.02] hover:border-purple-400
                      active:scale-[0.98]
                      transition-all duration-300 ease-out
                      cursor-pointer
                      group
                      ${tagFilter === summary.tagId || (summary.tagId === 'no_tag' && tagFilter === 'no_tag') 
                        ? 'border-purple-500 shadow-lg ring-2 ring-purple-200 bg-gradient-to-br from-purple-50 via-white to-gray-50' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-bold text-gray-900 truncate flex-1 text-left" title={summary.tagDisplayName}>
                        {summary.tagDisplayName}
                      </p>
                      {(tagFilter === summary.tagId || (summary.tagId === 'no_tag' && tagFilter === 'no_tag')) && (
                        <div className="ml-2 w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <p className={`text-2xl font-extrabold mb-1 ${
                      summary.totalQuantity === 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {summary.totalQuantity} {summary.unit || ''}
                    </p>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                      {summary.goods.length} {summary.goods.length === 1 ? 'lot' : 'lots'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Gradient fade effect on the left */}
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white via-white to-transparent pointer-events-none z-10"></div>
            
            {/* Gradient fade effect on the right */}
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white to-transparent pointer-events-none z-10"></div>
          </div>
        )}
      </div>

      {/* Search, Filter, and Sort Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by Product Type or Batch Reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filters and Sort - Mobile Optimized */}
        <div className="space-y-3">
          {/* Filter Row 1: Status Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* QA Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <select
                value={qaStatusFilter}
                onChange={(e) => setQaStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All QA Status</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="hold">Hold</option>
              </select>
            </div>

            {/* Stock Status Filter */}
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Stock Status</option>
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>

          {/* Filter Row 2: Tag Filter */}
          <div className="w-full">
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Tags</option>
              <option value="no_tag">No Tag</option>
              {producedGoodsTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Row 3: Options and Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Show Zero Quantity Toggle */}
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition-colors bg-white">
              <input
                type="checkbox"
                checked={showZeroQuantity}
                onChange={(e) => setShowZeroQuantity(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-700">Show Zero Quantity</span>
            </label>

            {/* Clear Filters Button - Show when any filter is active */}
            {(searchQuery || qaStatusFilter !== 'all' || stockStatusFilter !== 'all' || tagFilter !== 'all' || showZeroQuantity) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setQaStatusFilter('all');
                  setStockStatusFilter('all');
                  setTagFilter('all');
                  setShowZeroQuantity(false);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100 transition-colors"
                title="Clear all filters"
              >
                <X className="w-4 h-4" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>

          {/* Sort Row */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <ArrowUpDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by as 'date' | 'quantity' | 'product_type');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date-desc">Production Date: Newest First</option>
              <option value="date-asc">Production Date: Oldest First</option>
              <option value="quantity-desc">Quantity: High to Low</option>
              <option value="quantity-asc">Quantity: Low to High</option>
              <option value="product_type-asc">Product Type: A-Z</option>
              <option value="product_type-desc">Product Type: Z-A</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-600 pt-2 border-t border-gray-200">
          Showing {filteredAndSortedGoods.length} of {goods.length} products
        </div>
      </div>

      {/* Goods List Section - Scroll target */}
      <div ref={goodsListRef} className="scroll-mt-4">
        {/* Desktop Table View */}
        <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inventory</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Production Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading processed goods...</span>
                  </div>
                </td>
              </tr>
            ) : filteredAndSortedGoods.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Box className="w-8 h-8 text-gray-400" />
                    <span>No processed goods found</span>
                    {(searchQuery || qaStatusFilter !== 'all' || stockStatusFilter !== 'all' || tagFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setQaStatusFilter('all');
                          setStockStatusFilter('all');
                          setTagFilter('all');
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 mt-2"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedGoods.map((good) => (
                <tr 
                  key={good.id} 
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedGood(good);
                    setShowDetailsModal(true);
                  }}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex flex-col gap-1">
                      <span>{good.product_type}</span>
                      <span className="text-xs text-gray-500 font-normal">Production end: {good.production_date}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">{good.batch_reference}</td>
                  <td className="px-4 py-3 text-sm">
                    {good.produced_goods_tag_name ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                        {good.produced_goods_tag_name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Created:</span>
                        <span className="font-semibold text-gray-900">
                          {good.quantity_created ?? good.quantity_available} {good.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Available:</span>
                        <span
                          className={`font-semibold ${
                            ((good.quantity_created ?? good.quantity_available) - (good.quantity_delivered ?? 0)) === 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {(good.quantity_created ?? good.quantity_available) - (good.quantity_delivered ?? 0)} {good.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Delivered:</span>
                        <span className="font-semibold text-blue-600">
                          {good.quantity_delivered ?? 0} {good.unit}
                        </span>
                      </div>
                      {good.actual_available !== undefined && good.actual_available !== good.quantity_available && (
                        <span className="text-xs text-gray-500 mt-0.5">
                          ({good.quantity_available - (good.actual_available ?? 0)} reserved)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{good.production_date}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                      {good.qa_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="text-gray-500">Loading processed goods...</span>
            </div>
          </div>
        ) : filteredAndSortedGoods.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Box className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">No processed goods found</span>
              {(searchQuery || qaStatusFilter !== 'all' || stockStatusFilter !== 'all' || tagFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setQaStatusFilter('all');
                    setStockStatusFilter('all');
                    setTagFilter('all');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredAndSortedGoods.map((good) => {
            const totalCreated = good.quantity_created ?? good.quantity_available;
            const totalDelivered = good.quantity_delivered ?? 0;
            const available = totalCreated - totalDelivered; // Available = Created - Delivered
            const actualAvailable = (good as any).actual_available ?? good.quantity_available;
            const reservedQuantity = good.actual_available !== undefined && good.actual_available !== good.quantity_available 
              ? good.quantity_available - actualAvailable 
              : 0;
            const hasReservations = reservedQuantity > 0;

            return (
              <div 
                key={good.id} 
                className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedGood(good);
                  setShowDetailsModal(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-base">{good.product_type}</h3>
                    <p className="text-xs text-gray-500 font-mono mt-1">Batch: {good.batch_reference}</p>
                    <p className="text-xs text-gray-500 mt-1">Production end: {good.production_date}</p>
                  </div>
                </div>

                {/* Quantity Information */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Created:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {totalCreated} {good.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Available:</span>
                    <span className={`text-sm font-semibold ${
                      available === 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {available} {good.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Delivered:</span>
                    <span className="text-sm font-semibold text-blue-600">
                      {totalDelivered} {good.unit}
                    </span>
                  </div>
                  {hasReservations && (
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                      <span>Reserved:</span>
                      <span>{reservedQuantity} {good.unit}</span>
                    </div>
                  )}
                </div>
              
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                  <div>
                    <span className="text-gray-500">Production Date:</span>
                    <span className="ml-1 text-gray-900">{good.production_date}</span>
                  </div>
                  <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                    {good.qa_status}
                  </span>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* Processed Good Details Modal */}
      <ProcessedGoodDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedGood(null);
        }}
        processedGood={selectedGood}
        onBatchReferenceClick={(batchId) => {
          if (onNavigateToSection) {
            // Navigate to production with batch ID as search parameter
            window.location.href = '/operations/production?batchId=' + batchId;
          }
        }}
        onOrderClick={(orderId) => {
          if (onNavigateToOrder) {
            onNavigateToOrder(orderId);
          }
        }}
      />
    </div>
  );
}
