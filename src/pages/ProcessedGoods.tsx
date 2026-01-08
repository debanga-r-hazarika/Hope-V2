import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Box, Search, Filter, X, Download } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { ProcessedGood } from '../types/operations';
import { fetchProcessedGoods } from '../lib/operations';
import { exportProcessedGoods } from '../utils/excelExport';
import { InfoDialog } from '../components/ui/InfoDialog';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

interface ProcessedGoodsProps {
  accessLevel: AccessLevel;
}

export function ProcessedGoods({ accessLevel }: ProcessedGoodsProps) {
  const [goods, setGoods] = useState<ProcessedGood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterQAStatus, setFilterQAStatus] = useState<string>('all');
  const [filterStockStatus, setFilterStockStatus] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProcessedGoods();
      setGoods(data);
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

  // Filter and search logic
  const filteredGoods = useMemo(() => {
    let filtered = [...goods];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((g) =>
        g.product_type.toLowerCase().includes(term) ||
        g.batch_reference.toLowerCase().includes(term) ||
        (g.qa_status || '').toLowerCase().includes(term)
      );
    }

    // QA Status filter
    if (filterQAStatus !== 'all') {
      filtered = filtered.filter((g) => g.qa_status === filterQAStatus);
    }

    // Stock status filter
    if (filterStockStatus !== 'all') {
      if (filterStockStatus === 'in_stock') {
        filtered = filtered.filter((g) => g.quantity_available > 0);
      } else if (filterStockStatus === 'out_of_stock') {
        filtered = filtered.filter((g) => g.quantity_available === 0);
      }
    }

    // Date range filter
    if (filterDateFrom) {
      filtered = filtered.filter((g) => g.production_date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter((g) => g.production_date <= filterDateTo);
    }

    return filtered;
  }, [goods, searchTerm, filterQAStatus, filterStockStatus, filterDateFrom, filterDateTo]);

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

      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
        Note: Processed goods are automatically created from approved production batches. Manual entry is not allowed.
      </div>

        {/* Search and Filters */}
        <ModernCard>
          <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product type, batch reference..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Export Button - Only for R/W users */}
          {accessLevel === 'read-write' && (
            <button
              onClick={() => exportProcessedGoods(filteredGoods)}
              className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-blue-300 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-medium"
              title="Export to Excel"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Export</span>
            </button>
          )}
          
          {/* Filter Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowFilters(!showFilters);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 border-2 rounded-lg transition-all font-medium ${
              showFilters || filterQAStatus !== 'all' || filterStockStatus !== 'all' || filterDateFrom || filterDateTo
                ? 'bg-teal-50 border-teal-400 text-teal-700 shadow-sm'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
            {(filterQAStatus !== 'all' || filterStockStatus !== 'all' || filterDateFrom || filterDateTo) && (
              <span className="bg-teal-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {[filterQAStatus !== 'all', filterStockStatus !== 'all', filterDateFrom, filterDateTo].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                QA Status
              </label>
              <select
                value={filterQAStatus}
                onChange={(e) => setFilterQAStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Statuses</option>
                {Array.from(new Set(goods.map((g) => g.qa_status))).sort().map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Stock Status
              </label>
              <select
                value={filterStockStatus}
                onChange={(e) => setFilterStockStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All</option>
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Production Date From
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Production Date To
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex items-end">
              <button
                onClick={() => {
                  setFilterQAStatus('all');
                  setFilterStockStatus('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                  setSearchTerm('');
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
        </ModernCard>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{goods.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">In Stock</p>
          <p className="text-2xl font-semibold text-green-600 mt-1">
            {goods.filter((g) => g.quantity_available > 0).length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Out of Stock</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">
            {goods.filter((g) => g.quantity_available === 0).length}
          </p>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Available</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Production Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading processed goods...</span>
                  </div>
                </td>
              </tr>
            ) : filteredGoods.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Box className="w-8 h-8 text-gray-400" />
                    <span>{goods.length === 0 ? 'No processed goods found' : 'No goods match your filters'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredGoods.map((good) => (
                <tr key={good.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{good.product_type}</td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">{good.batch_reference}</td>
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
                    <span className={`px-2 py-1 text-xs rounded ${
                      good.qa_status === 'approved' 
                        ? 'bg-green-50 text-green-700' 
                        : good.qa_status === 'hold'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-gray-50 text-gray-700'
                    }`}>
                      {good.qa_status === 'hold' ? 'Hold - Not Ready for Sale' : good.qa_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3 sm:space-y-4">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="text-gray-500">Loading processed goods...</span>
            </div>
          </div>
        ) : filteredGoods.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Box className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">{goods.length === 0 ? 'No processed goods found' : 'No goods match your filters'}</span>
            </div>
          </div>
        ) : (
          filteredGoods.map((good) => (
            <ModernCard key={good.id} className="hover:shadow-lg transition-shadow">
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
                <span className={`px-2 py-1 text-xs rounded ${
                  good.qa_status === 'approved' 
                    ? 'bg-green-50 text-green-700' 
                    : good.qa_status === 'hold'
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-gray-50 text-gray-700'
                }`}>
                  {good.qa_status === 'hold' ? 'Hold - Not Ready for Sale' : good.qa_status}
                </span>
              </div>
            </ModernCard>
          ))
        )}
      </div>

      {/* Info Dialog */}
      <InfoDialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title="Processed Goods Guide"
        message="View all finished goods that have been approved from production batches. Goods with 'Hold' status are marked with red background and are not ready for sale. Use filters to find specific products by QA status, stock level, or production date."
        type="info"
      />
    </div>
  );
}
