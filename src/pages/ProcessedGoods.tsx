import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Box, Search, Filter, ArrowUpDown, Download } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { ProcessedGood } from '../types/operations';
import { fetchProcessedGoods } from '../lib/operations';
import { ProcessedGoodDetailsModal } from '../components/ProcessedGoodDetailsModal';
import { exportProcessedGoods } from '../utils/excelExport';
import { fetchProducedGoodsTags } from '../lib/tags';
import type { ProducedGoodsTag } from '../types/tags';

interface ProcessedGoodsProps {
  accessLevel: AccessLevel;
  onNavigateToSection?: (section: string) => void;
}

export function ProcessedGoods({ accessLevel, onNavigateToSection }: ProcessedGoodsProps) {
  const [goods, setGoods] = useState<ProcessedGood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGood, setSelectedGood] = useState<ProcessedGood | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [producedGoodsTags, setProducedGoodsTags] = useState<ProducedGoodsTag[]>([]);

  // Search, Filter, and Sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [qaStatusFilter, setQaStatusFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
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
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        good.product_type.toLowerCase().includes(searchLower) ||
        good.batch_reference.toLowerCase().includes(searchLower);

      // QA Status filter
      const matchesQaStatus = qaStatusFilter === 'all' || good.qa_status === qaStatusFilter;

      // Stock Status filter
      const matchesStockStatus = 
        stockStatusFilter === 'all' ||
        (stockStatusFilter === 'in_stock' && good.quantity_available > 0) ||
        (stockStatusFilter === 'out_of_stock' && good.quantity_available === 0);

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
        comparison = new Date(a.production_date).getTime() - new Date(b.production_date).getTime();
      } else if (sortBy === 'quantity') {
        comparison = a.quantity_available - b.quantity_available;
      } else if (sortBy === 'product_type') {
        comparison = a.product_type.localeCompare(b.product_type);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [goods, searchQuery, qaStatusFilter, stockStatusFilter, tagFilter, sortBy, sortOrder]);

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
        <button
          onClick={() => exportProcessedGoods(filteredAndSortedGoods)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
          title="Export filtered processed goods to Excel"
        >
          <Download className="w-4 h-4" />
          <span>Export to Excel</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{filteredAndSortedGoods.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">In Stock</p>
          <p className="text-2xl font-semibold text-green-600 mt-1">
            {filteredAndSortedGoods.filter((g) => g.quantity_available > 0).length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Out of Stock</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">
            {filteredAndSortedGoods.filter((g) => g.quantity_available === 0).length}
          </p>
        </div>
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

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-3">
          {/* QA Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={qaStatusFilter}
              onChange={(e) => setQaStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Stock Status</option>
            <option value="in_stock">In Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          {/* Tag Filter */}
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Tags</option>
            <option value="no_tag">No Tag</option>
            {producedGoodsTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.display_name}
              </option>
            ))}
          </select>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by as 'date' | 'quantity' | 'product_type');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <div className="text-sm text-gray-600">
          Showing {filteredAndSortedGoods.length} of {goods.length} products
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Available</th>
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
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
                  <td className="px-4 py-3 font-medium text-gray-900">{good.product_type}</td>
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
                    <span
                      className={`font-semibold ${
                        good.quantity_available === 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {good.quantity_available} {good.unit}
                    </span>
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
          filteredAndSortedGoods.map((good) => (
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
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  good.quantity_available === 0
                    ? 'bg-red-50 text-red-600'
                    : 'bg-green-50 text-green-600'
                }`}>
                  {good.quantity_available} {good.unit}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500">Production Date:</span>
                  <span className="ml-1 text-gray-900">{good.production_date}</span>
                </div>
                <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                  {good.qa_status}
                </span>
              </div>
            </div>
          ))
        )}
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
            onNavigateToSection('production');
          }
        }}
      />
    </div>
  );
}
