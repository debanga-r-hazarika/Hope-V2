import { useEffect, useState, useMemo, useRef } from 'react';
import { RefreshCw, Box, Download, ArrowUpDown, SlidersHorizontal, Search, X } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { ProcessedGood } from '../types/operations';
import { fetchProcessedGoods, fixProcessedGoodsProductionDates } from '../lib/operations';
import { ProcessedGoodDetailsModal } from '../components/ProcessedGoodDetailsModal';
import { exportProcessedGoods } from '../utils/excelExport';
import { fetchProducedGoodsTags } from '../lib/tags';
import type { ProducedGoodsTag } from '../types/tags';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import {
  ProcessedGoodsFilterPanel,
  type ProcessedGoodsFilterState,
  initialProcessedGoodsFilterState
} from '../components/ProcessedGoodsFilterPanel';

interface ProcessedGoodsProps {
  accessLevel: AccessLevel;
  onNavigateToSection?: (section: string) => void;
  onNavigateToOrder?: (orderId: string) => void;
}

export function ProcessedGoods({ accessLevel, onNavigateToSection, onNavigateToOrder }: ProcessedGoodsProps) {
  const [goods, setGoods] = useState<(ProcessedGood & { production_start_date?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGood, setSelectedGood] = useState<(ProcessedGood & { production_start_date?: string }) | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [producedGoodsTags, setProducedGoodsTags] = useState<ProducedGoodsTag[]>([]);
  const goodsListRef = useRef<HTMLDivElement>(null);

  // New Filter State (default: show all stock statuses so Production users see all items including 0 stock)
  const [filters, setFilters] = useState<ProcessedGoodsFilterState>({
    ...initialProcessedGoodsFilterState,
    stockStatus: ['in_stock', 'out_of_stock']
  });

  // Sorting
  const [sortBy, setSortBy] = useState<'date' | 'quantity' | 'product_type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [fixingDates, setFixingDates] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, tagsData] = await Promise.all([
        fetchProcessedGoods(),
        fetchProducedGoodsTags(false),
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

  // Filtered and sorted processed goods (actual_available includes waste deduction)
  const filteredAndSortedGoods = useMemo(() => {
    let filtered = goods.filter((good) => {
      const totalCreated = good.quantity_created ?? good.quantity_available;
      const totalDelivered = good.quantity_delivered ?? 0;
      const availableQuantity = good.actual_available ?? (totalCreated - totalDelivered);
      const isZeroQuantity = availableQuantity <= 0;

      // 1. Search Query
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        // Check Product Type, Batch Ref, and Tags
        const matchesSearch =
          good.product_type.toLowerCase().includes(searchLower) ||
          good.batch_reference.toLowerCase().includes(searchLower) ||
          (good.produced_goods_tag_name || '').toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // 2. Stock Status (Multi-select)
      if (filters.stockStatus.length > 0) {
        const matchesInStock = filters.stockStatus.includes('in_stock') && availableQuantity > 0;
        const matchesOutOfStock = filters.stockStatus.includes('out_of_stock') && isZeroQuantity;

        // If neither match, filter it out (union of selected statuses)
        if (!matchesInStock && !matchesOutOfStock) return false;
      }

      // 3. Product Tag (Multi-select)
      if (filters.tags.length > 0) {
        const tagId = good.produced_goods_tag_id || 'no_tag';
        if (!filters.tags.includes(tagId)) return false;
      }

      // 4. Date Range
      if (filters.dateFrom) {
        const itemDate = new Date(good.production_date);
        itemDate.setHours(0, 0, 0, 0);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (itemDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const itemDate = new Date(good.production_date);
        itemDate.setHours(0, 0, 0, 0);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(0, 0, 0, 0);
        if (itemDate > toDate) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'date') {
        const dateComparison = new Date(a.production_date).getTime() - new Date(b.production_date).getTime();
        if (dateComparison === 0) {
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else {
          comparison = dateComparison;
        }
      } else if (sortBy === 'quantity') {
        const aAvailable = a.actual_available ?? ((a.quantity_created ?? a.quantity_available) - (a.quantity_delivered ?? 0));
        const bAvailable = b.actual_available ?? ((b.quantity_created ?? b.quantity_available) - (b.quantity_delivered ?? 0));
        comparison = aAvailable - bAvailable;
      } else if (sortBy === 'product_type') {
        comparison = a.product_type.localeCompare(b.product_type);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [goods, filters, sortBy, sortOrder]);

  const tagSummaries = useMemo(() => {
    const tagMap = new Map<string, {
      tagId: string;
      tagDisplayName: string;
      goods: Array<ProcessedGood & { actual_available?: number; production_start_date?: string }>;
      totalQuantity: number;
      unit: string;
    }>();

    producedGoodsTags.forEach((tag) => {
      tagMap.set(tag.id, {
        tagId: tag.id,
        tagDisplayName: tag.display_name,
        goods: [],
        totalQuantity: 0,
        unit: '',
      });
    });

    tagMap.set('no_tag', {
      tagId: 'no_tag',
      tagDisplayName: 'No Tag',
      goods: [],
      totalQuantity: 0,
      unit: '',
    });

    goods.forEach((good) => {
      const tagId = good.produced_goods_tag_id || 'no_tag';
      const availableQuantity = good.actual_available ?? ((good.quantity_created ?? good.quantity_available) - (good.quantity_delivered ?? 0));

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
      if (!tagSummary.unit) {
        tagSummary.unit = good.unit;
      }
    });

    return Array.from(tagMap.values()).sort((a, b) =>
      a.tagDisplayName.localeCompare(b.tagDisplayName)
    );
  }, [goods, producedGoodsTags]);

  const handleFixDates = async () => {
    setFixingDates(true);
    try {
      await fixProcessedGoodsProductionDates();
      await loadData();
      alert('Production dates fixed fixed successfully!');
    } catch (error) {
      console.error('Failed to fix production dates:', error);
      alert('Failed to fix dates details.');
    } finally {
      setFixingDates(false);
    }
  };

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto">
        <ModernCard className="text-center p-8">
          <h1 className="text-2xl font-semibold text-gray-900">Operations module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Processed Goods</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Manage inventory and production outputs</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ModernButton
            onClick={handleFixDates}
            variant="secondary"
            loading={fixingDates}
            className="flex-1 sm:flex-none justify-center"
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Fix Dates
          </ModernButton>
          <ModernButton
            onClick={() => exportProcessedGoods(filteredAndSortedGoods)}
            variant="primary"
            className="flex-1 sm:flex-none justify-center bg-gradient-to-r from-emerald-600 to-emerald-700 border-none"
            icon={<Download className="w-4 h-4" />}
          >
            Export Excel
          </ModernButton>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* Tag Summaries */}
      <ModernCard className="overflow-hidden bg-gradient-to-br from-white to-gray-50/50">
        <div className="flex items-center gap-2 mb-4 px-1">
          <Box className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-900">Inventory Overview</h3>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-sm font-medium text-gray-500">Loading inventory data...</p>
          </div>
        ) : tagSummaries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No inventory data available</p>
        ) : (
          <div className="relative -mx-6 px-6">
            <div
              className="overflow-x-auto pb-4 tag-scrollbar relative z-20 flex gap-4 pr-6"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {tagSummaries.map((summary) => (
                <button
                  key={summary.tagId}
                  onClick={() => {
                    // Update filters to select this tag only, effectively filtering by it.
                    const newTags = filters.tags.includes(summary.tagId)
                      ? []
                      : [summary.tagId];

                    setFilters(prev => ({ ...prev, tags: newTags }));

                    setTimeout(() => {
                      goodsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className={`
                    flex-shrink-0 min-w-[220px] p-5 rounded-2xl border transition-all duration-300 text-left group relative overflow-hidden
                    ${filters.tags.includes(summary.tagId)
                      ? 'bg-indigo-600 border-indigo-600 shadow-indigo-200 shadow-lg scale-[1.02]'
                      : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-md'
                    }
                  `}
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-sm font-bold truncate pr-2 ${filters.tags.includes(summary.tagId)
                        ? 'text-indigo-100'
                        : 'text-gray-600'
                        }`}>
                        {summary.tagDisplayName}
                      </span>
                      {summary.totalQuantity > 0 && (
                        <div className={`w-2 h-2 rounded-full ${filters.tags.includes(summary.tagId)
                          ? 'bg-emerald-400'
                          : 'bg-emerald-500'
                          }`} />
                      )}
                    </div>

                    <div className="flex items-baseline gap-1 mb-1">
                      <span className={`text-3xl font-extrabold tracking-tight ${filters.tags.includes(summary.tagId)
                        ? 'text-white'
                        : 'text-gray-900 group-hover:text-indigo-600 transition-colors'
                        }`}>
                        {summary.totalQuantity}
                      </span>
                      <span className={`text-sm font-medium ${filters.tags.includes(summary.tagId)
                        ? 'text-indigo-200'
                        : 'text-gray-400'
                        }`}>
                        {summary.unit}
                      </span>
                    </div>

                    <p className={`text-xs font-medium uppercase tracking-wider ${filters.tags.includes(summary.tagId)
                      ? 'text-indigo-200'
                      : 'text-gray-400'
                      }`}>
                      {summary.goods.length} Lots
                    </p>
                  </div>

                  {/* Decorative Elements */}
                  <div className={`absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4 ${filters.tags.includes(summary.tagId) ? 'text-white' : 'text-indigo-600'
                    }`}>
                    <Box className="w-24 h-24" />
                  </div>
                </button>
              ))}
            </div>
            {/* Fade Gradients */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-30" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-30" />
          </div>
        )}
      </ModernCard>

      {/* Search Bar & Filter Panel */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products, batches, or tags..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm outline-none shadow-sm"
          />
          {filters.search && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <ProcessedGoodsFilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters({ ...initialProcessedGoodsFilterState, stockStatus: ['in_stock'] })}
          tags={producedGoodsTags}
        />
      </div>

      {/* Results Count & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
        <p className="text-sm font-medium text-gray-500">
          Found <span className="text-gray-900 font-bold">{filteredAndSortedGoods.length}</span> items
          {(filters.search || filters.stockStatus.length > 0 || filters.tags.length > 0) && (
            <span className="ml-1 text-gray-400 font-normal">(Filtered)</span>
          )}
        </p>

        <div className="flex items-center gap-3 w-full sm:w-auto bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-2 border-r border-gray-100">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Sort</span>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'quantity' | 'product_type')}
            className="text-sm border-none focus:ring-0 text-gray-700 font-medium py-1 bg-transparent cursor-pointer outline-none"
          >
            <option value="date">Production Date</option>
            <option value="quantity">Available Quantity</option>
            <option value="product_type">Product Name</option>
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 hover:bg-gray-50 rounded-md transition-colors text-gray-500"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            <ArrowUpDown className={`w-4 h-4 transition-transform duration-200 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Goods List Section */}
      <div ref={goodsListRef} className="scroll-mt-4">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Info</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inventory Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch Ref</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                      <span className="font-medium">Loading processed goods...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedGoods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                        <Box className="w-6 h-6 text-gray-400" />
                      </div>
                      <span className="font-medium text-gray-900">No items found</span>
                      <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                      <button
                        onClick={() => setFilters({ ...initialProcessedGoodsFilterState, stockStatus: ['in_stock'] })}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mt-2"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedGoods.map((good) => {
                  const totalCreated = good.quantity_created ?? good.quantity_available;
                  const totalDelivered = good.quantity_delivered ?? 0;
                  const available = good.actual_available ?? (totalCreated - totalDelivered);

                  return (
                    <tr
                      key={good.id}
                      className="group hover:bg-gray-50/80 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedGood(good);
                        setShowDetailsModal(true);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {good.product_type}
                          </span>
                          {good.produced_goods_tag_name ? (
                            <span className="inline-flex mt-1">
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wide rounded-full border border-indigo-100">
                                {good.produced_goods_tag_name}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 mt-1 italic">No Tag</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {/* Main Available Count */}
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-lg font-bold ${available <= 0 ? 'text-red-500' : 'text-emerald-600'
                              }`}>
                              {available}
                            </span>
                            <span className="text-xs font-medium text-gray-500 uppercase">{good.unit}</span>
                            {available <= 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">Out</span>}
                          </div>

                          {/* Secondary numbers */}
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span title="Total Created">Tot: {totalCreated}</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span title="Ordered" className="text-blue-600 font-medium">Ord: {totalDelivered}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200">
                          {good.batch_reference}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-gray-900">
                            {new Date(good.production_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          {good.production_start_date && (
                            <span className="text-xs text-gray-500">
                              Started: {new Date(good.production_start_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${good.qa_status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : good.qa_status === 'rejected'
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                          {good.qa_status || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {loading ? (
            <ModernCard className="p-8 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-400" />
              <p>Loading items...</p>
            </ModernCard>
          ) : filteredAndSortedGoods.length === 0 ? (
            <ModernCard className="p-8 text-center text-gray-500">
              <Box className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No items found matching your filters</p>
            </ModernCard>
          ) : (
            filteredAndSortedGoods.map((good) => {
              const totalCreated = good.quantity_created ?? good.quantity_available;
              const totalDelivered = good.quantity_delivered ?? 0;
              const available = good.actual_available ?? (totalCreated - totalDelivered);
              const totalWasted = good.total_wasted ?? 0;

              return (
                <ModernCard
                  key={good.id}
                  className="active:scale-[0.98] transition-transform"
                  onClick={() => {
                    setSelectedGood(good);
                    setShowDetailsModal(true);
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{good.product_type}</h3>
                      <div className="mt-2 flex items-center justify-between gap-2 w-full">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 font-medium shadow-sm flex-shrink-0">
                          {good.batch_reference}
                        </span>
                        {good.produced_goods_tag_name && (
                          <span className="text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 shadow-sm tracking-wide truncate text-right min-w-0">
                            {good.produced_goods_tag_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${good.qa_status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                      {good.qa_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Available</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-xl font-bold ${available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {available}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">{good.unit}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">ORDERED</span>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xl font-bold text-blue-600">
                          {totalDelivered}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">{good.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                    <span>Prod: {new Date(good.production_date).toLocaleDateString()}</span>
                    {totalWasted > 0 && (
                      <span className="text-amber-600 font-medium">Unbilled/damage: {totalWasted} {good.unit}</span>
                    )}
                  </div>
                </ModernCard>
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
            window.location.href = '/operations/production?batchId=' + batchId;
          }
        }}
        onOrderClick={(orderId) => {
          if (onNavigateToOrder) {
            onNavigateToOrder(orderId);
          }
        }}
        onWasteRecorded={async () => {
          try {
            const updated = await fetchProcessedGoods();
            setGoods(updated);
            if (selectedGood) {
              const next = updated.find((g) => g.id === selectedGood.id);
              if (next) setSelectedGood(next);
            }
          } catch (_) { }
        }}
      />
    </div>
  );
}
