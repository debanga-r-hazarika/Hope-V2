import { useEffect, useState } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  CurrentInventoryByTag,
  OutOfStockItem,
  LowStockItem,
  ConsumptionSummary,
  InventoryAnalyticsFilters,
  InventoryMetrics,
  InventoryType,
} from '../types/inventory-analytics';
import {
  fetchAllCurrentInventory,
  fetchOutOfStockItems,
  fetchLowStockItems,
  fetchConsumptionByType,
  calculateInventoryMetrics,
} from '../lib/inventory-analytics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { exportInventoryToExcel } from '../utils/inventoryExcelExport';

interface InventoryAnalyticsProps {
  accessLevel: AccessLevel;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

export function InventoryAnalytics({ accessLevel: _accessLevel }: InventoryAnalyticsProps) {
  const [filters, setFilters] = useState<InventoryAnalyticsFilters>({
    includeZeroBalance: false,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'outofstock' | 'lowstock' | 'consumption'>('current');

  // Data states
  const [currentInventory, setCurrentInventory] = useState<{ type: InventoryType; data: CurrentInventoryByTag[] }[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<OutOfStockItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [consumptionData, setConsumptionData] = useState<ConsumptionSummary[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);

  useEffect(() => {
    loadInventoryAnalytics();
  }, [filters]);

  const loadInventoryAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilters = getDateFilters();
      const fullFilters = { ...filters, ...dateFilters };

      const [inventory, outOfStock, lowStock, consumption, metricsData] = await Promise.all([
        fetchAllCurrentInventory(fullFilters),
        fetchOutOfStockItems(fullFilters),
        fetchLowStockItems(fullFilters),
        filters.inventoryType
          ? fetchConsumptionByType(filters.inventoryType, fullFilters)
          : Promise.resolve([]),
        calculateInventoryMetrics(fullFilters),
      ]);

      setCurrentInventory(inventory);
      setOutOfStockItems(outOfStock);
      setLowStockItems(lowStock);
      setConsumptionData(consumption);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to load inventory analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDateFilters = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return {
      startDate: filters.startDate || thirtyDaysAgo.toISOString().split('T')[0],
      endDate: filters.endDate || today.toISOString().split('T')[0],
    };
  };

  const updateFilter = <K extends keyof InventoryAnalyticsFilters>(
    key: K,
    value: InventoryAnalyticsFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    const dateFilters = getDateFilters();
    exportInventoryToExcel(
      currentInventory,
      outOfStockItems,
      lowStockItems,
      consumptionData,
      dateFilters.startDate,
      dateFilters.endDate
    );
  };

  // Prepare chart data
  const currentInventoryChartData = currentInventory.flatMap((inv) =>
    inv.data.map((item) => ({
      tag_name: item.tag_name,
      value: item.current_balance,
      type: inv.type,
    }))
  );

  const consumptionTrendData = consumptionData.reduce((acc: any[], item) => {
    const existing = acc.find((d) => d.date === item.consumption_date);
    if (existing) {
      existing.consumed += item.total_consumed || 0;
      existing.wasted += item.total_wasted || 0;
    } else {
      acc.push({
        date: item.consumption_date,
        consumed: item.total_consumed || 0,
        wasted: item.total_wasted || 0,
      });
    }
    return acc;
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-600 font-medium animate-pulse">Loading inventory data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inventory Reports & Analytics</h1>
          <p className="mt-2 text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Real-time inventory visibility and consumption tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all ${
              filtersOpen
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filters</span>
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="font-medium">Export Excel</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {filtersOpen && (
        <div className="bg-white border border-indigo-100 rounded-xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory Type</label>
              <select
                value={filters.inventoryType || ''}
                onChange={(e) => updateFilter('inventoryType', (e.target.value as InventoryType) || undefined)}
                className="w-full px-3 py-2.5 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Types</option>
                <option value="raw_material">Raw Materials</option>
                <option value="recurring_product">Recurring Products</option>
                <option value="produced_goods">Produced Goods</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => updateFilter('startDate', e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => updateFilter('endDate', e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="includeZero"
              checked={filters.includeZeroBalance || false}
              onChange={(e) => updateFilter('includeZeroBalance', e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <label htmlFor="includeZero" className="text-sm text-slate-600">
              Include zero balance items
            </label>
          </div>
        </div>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{metrics.totalItems}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500 font-medium">Total Items</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{metrics.outOfStockCount}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500 font-medium">Out of Stock</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <TrendingDown className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{metrics.lowStockCount}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500 font-medium">Low Stock</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{metrics.wastePercentage.toFixed(1)}%</span>
            </div>
            <p className="mt-2 text-sm text-slate-500 font-medium">Waste Rate</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {[
            { key: 'current', label: 'Current Inventory', icon: Package },
            { key: 'outofstock', label: 'Out of Stock', icon: AlertTriangle },
            { key: 'lowstock', label: 'Low Stock', icon: TrendingDown },
            { key: 'consumption', label: 'Consumption', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Current Inventory Tab */}
          {activeTab === 'current' && (
            <div className="space-y-6">
              {/* Chart */}
              {currentInventoryChartData.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Stock by Tag</h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={currentInventoryChartData.slice(0, 15)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="tag_name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Table */}
              {currentInventory.map((inv) => (
                <div key={inv.type}>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 capitalize">
                    {inv.type.replace('_', ' ')}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-y border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Tag</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Balance</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Unit</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Items</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inv.data.map((item) => (
                          <tr key={item.tag_id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.tag_name}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-700">{item.current_balance.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-500">{item.default_unit}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-700">{item.item_count}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-500">
                              {item.last_movement_date || item.last_production_date || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Out of Stock Tab */}
          {activeTab === 'outofstock' && (
            <div className="space-y-4">
              {outOfStockItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No out-of-stock items</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-y border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Tag</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Balance</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {outOfStockItems.map((item) => (
                        <tr key={`${item.inventory_type}-${item.tag_id}`} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm capitalize text-slate-700">{item.inventory_type.replace('_', ' ')}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.tag_name}</td>
                          <td className="px-4 py-3 text-sm text-right text-rose-600 font-medium">{item.current_balance.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-500">{item.last_activity_date || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Low Stock Tab */}
          {activeTab === 'lowstock' && (
            <div className="space-y-4">
              {lowStockItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No low-stock items</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-y border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Tag</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Current</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Threshold</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lowStockItems.map((item) => (
                        <tr key={`${item.inventory_type}-${item.tag_id}`} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm capitalize text-slate-700">{item.inventory_type.replace('_', ' ')}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.tag_name}</td>
                          <td className="px-4 py-3 text-sm text-right text-amber-600 font-medium">{item.current_balance.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-700">{item.threshold_quantity.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-rose-600 font-medium">{item.shortage_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Consumption Tab */}
          {activeTab === 'consumption' && (
            <div className="space-y-6">
              {consumptionTrendData.length > 0 && (
                <>
                  {/* Line Chart */}
                  <div className="bg-slate-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Consumption Trend</h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={consumptionTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="consumed" stroke="#6366f1" strokeWidth={2} name="Consumed" />
                          <Line type="monotone" dataKey="wasted" stroke="#ef4444" strokeWidth={2} name="Wasted" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pie Chart */}
                  <div className="bg-slate-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Consumption vs Waste</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: 'Consumed',
                                value: consumptionTrendData.reduce((sum, d) => sum + d.consumed, 0),
                              },
                              {
                                name: 'Wasted',
                                value: consumptionTrendData.reduce((sum, d) => sum + d.wasted, 0),
                              },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${entry.value.toFixed(0)}`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            <Cell fill="#6366f1" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Tag</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Consumed</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Wasted</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Transactions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consumptionData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-700">{item.consumption_date}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.tag_name}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">{item.total_consumed.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-rose-600">{item.total_wasted.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-500">{item.consumption_transactions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
