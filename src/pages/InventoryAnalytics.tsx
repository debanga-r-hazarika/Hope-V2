import { useEffect, useState } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  RawMaterialLotDetail,
  RecurringProductLotDetail,
  ProcessedGoodsBatchDetail,
} from '../types/inventory-analytics';
import {
  fetchAllCurrentInventory,
  fetchOutOfStockItems,
  fetchLowStockItems,
  fetchConsumptionByType,
  fetchConsumptionRawMaterials,
  fetchConsumptionRecurringProducts,
  fetchConsumptionProducedGoods,
  calculateInventoryMetrics,
  fetchRawMaterialLotDetails,
  fetchRecurringProductLotDetails,
  fetchProcessedGoodsBatchDetails,
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

export function InventoryAnalytics({ accessLevel: _accessLevel }: InventoryAnalyticsProps) {
  // Helper function to format dates consistently
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  // Month-Year state (defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Tag filter for consumption (defaults to null = all tags)
  const [selectedConsumptionTag, setSelectedConsumptionTag] = useState<string | null>(null);

  const [filters, setFilters] = useState<InventoryAnalyticsFilters>({
    inventoryType: 'raw_material', // Default to raw materials
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'outofstock' | 'lowstock' | 'consumption'>('current');

  // Data states
  const [currentInventory, setCurrentInventory] = useState<{ type: InventoryType; data: CurrentInventoryByTag[] }[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<OutOfStockItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [consumptionData, setConsumptionData] = useState<ConsumptionSummary[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  
  // Lot/Batch details states
  const [tagDetails, setTagDetails] = useState<Record<string, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Month navigation functions
  const goToPreviousMonth = () => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      
      if (newDate > currentMonth) {
        return prev;
      }
      return newDate;
    });
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return selectedMonth.getFullYear() === now.getFullYear() && 
           selectedMonth.getMonth() === now.getMonth();
  };

  useEffect(() => {
    loadInventoryAnalytics();
  }, [filters, selectedMonth]);

  const loadInventoryAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilters = getDateFilters();
      const fullFilters = { ...filters, ...dateFilters };

      // Load consumption data for all types or specific type
      const consumptionPromise = filters.inventoryType
        ? fetchConsumptionByType(filters.inventoryType, fullFilters)
        : Promise.all([
            fetchConsumptionRawMaterials(fullFilters),
            fetchConsumptionRecurringProducts(fullFilters),
            fetchConsumptionProducedGoods(fullFilters),
          ]).then((results) => results.flat());

      const [inventory, outOfStock, lowStock, consumption, metricsData] = await Promise.all([
        fetchAllCurrentInventory(fullFilters),
        fetchOutOfStockItems(fullFilters),
        fetchLowStockItems(fullFilters),
        consumptionPromise,
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
    // Get first and last day of selected month
    const startDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

    return {
      startDate: filters.startDate || startDate.toISOString().split('T')[0],
      endDate: filters.endDate || endDate.toISOString().split('T')[0],
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

  // Toggle tag expansion and fetch lot/batch details
  const toggleTagExpansion = async (tagId: string, inventoryType: InventoryType, usable?: boolean) => {
    const key = usable !== undefined ? `${tagId}-${usable}` : tagId;
    
    if (expandedTags.has(key)) {
      // Collapse
      setExpandedTags(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    } else {
      // Expand and fetch details if not already loaded
      setExpandedTags(prev => new Set(prev).add(key));
      
      if (!tagDetails[key]) {
        setLoadingDetails(prev => new Set(prev).add(key));
        try {
          let details: any[] = [];
          
          if (inventoryType === 'raw_material') {
            details = await fetchRawMaterialLotDetails(tagId, usable);
          } else if (inventoryType === 'recurring_product') {
            details = await fetchRecurringProductLotDetails(tagId);
          } else if (inventoryType === 'produced_goods') {
            details = await fetchProcessedGoodsBatchDetails(tagId);
          }
          
          setTagDetails(prev => ({ ...prev, [key]: details }));
        } catch (error) {
          console.error('Failed to load tag details:', error);
        } finally {
          setLoadingDetails(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }
      }
    }
  };

  // Prepare chart data - filter by selected inventory type
  const currentInventoryChartData = currentInventory
    .filter((inv) => !filters.inventoryType || inv.type === filters.inventoryType)
    .flatMap((inv) => 
      inv.data.map((item) => ({
        tag_name: item.tag_name,
        value: item.current_balance,
        type: inv.type as InventoryType,
        usable: item.usable, // Will be undefined for non-raw materials
      }))
    );

  // Prepare consumption trend data - filter by selected tag if specified
  const consumptionTrendData = consumptionData
    .filter((item) => !selectedConsumptionTag || item.tag_id === selectedConsumptionTag)
    .reduce((acc: any[], item) => {
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

  // Get unique tags from consumption data for the dropdown
  const availableTags = Array.from(
    new Map(
      consumptionData.map((item) => [item.tag_id, { id: item.tag_id, name: item.tag_name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Helper function to render lot/batch details
  const renderTagDetails = (key: string, inventoryType: InventoryType) => {
    const details = tagDetails[key];
    const isLoading = loadingDetails.has(key);

    if (isLoading) {
      return (
        <tr>
          <td colSpan={5} className="px-4 py-4 bg-slate-50">
            <div className="flex items-center justify-center gap-2 text-slate-600">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Loading details...</span>
            </div>
          </td>
        </tr>
      );
    }

    if (!details || details.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="px-4 py-4 bg-slate-50">
            <p className="text-sm text-slate-500 text-center">No details available</p>
          </td>
        </tr>
      );
    }

    if (inventoryType === 'raw_material') {
      const rawDetails = details as RawMaterialLotDetail[];
      return (
        <tr>
          <td colSpan={5} className="px-4 py-2 bg-slate-50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Lot ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Name</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Available</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Received</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Supplier</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rawDetails.map((detail) => (
                    <tr key={detail.id} className="hover:bg-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{detail.lot_id}</td>
                      <td className="px-3 py-2 text-slate-700">{detail.name}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{detail.quantity_available.toFixed(2)} {detail.unit}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(detail.received_date)}</td>
                      <td className="px-3 py-2 text-slate-600">{detail.supplier_name || '-'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{detail.storage_notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      );
    }

    if (inventoryType === 'recurring_product') {
      const recurringDetails = details as RecurringProductLotDetail[];
      return (
        <tr>
          <td colSpan={5} className="px-4 py-2 bg-slate-50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Lot ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Name</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Available</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recurringDetails.map((detail) => (
                    <tr key={detail.id} className="hover:bg-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{detail.lot_id}</td>
                      <td className="px-3 py-2 text-slate-700">{detail.name}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{detail.quantity_available.toFixed(2)} {detail.unit}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(detail.received_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      );
    }

    if (inventoryType === 'produced_goods') {
      const batchDetails = details as ProcessedGoodsBatchDetail[];
      return (
        <tr>
          <td colSpan={5} className="px-4 py-2 bg-slate-50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Batch ID</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total Created</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Available</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Production Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {batchDetails.map((detail) => (
                    <tr key={detail.id} className="hover:bg-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{detail.batch_name}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{detail.quantity_created.toFixed(2)} {detail.unit}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-medium">{detail.quantity_available.toFixed(2)} {detail.unit}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(detail.production_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      );
    }

    return null;
  };

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
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="font-medium">Export Excel</span>
          </button>
        </div>
      </div>

      {/* Inventory Type Filter Buttons */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Filter by Inventory Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => updateFilter('inventoryType', 'raw_material')}
            className={`px-4 sm:px-6 py-3 rounded-xl font-medium transition-all ${
              filters.inventoryType === 'raw_material'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200'
                : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Raw Materials</span>
            </span>
          </button>

          <button
            onClick={() => updateFilter('inventoryType', 'recurring_product')}
            className={`px-4 sm:px-6 py-3 rounded-xl font-medium transition-all ${
              filters.inventoryType === 'recurring_product'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-200'
                : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-purple-300 hover:bg-purple-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Recurring Products</span>
            </span>
          </button>

          <button
            onClick={() => updateFilter('inventoryType', 'produced_goods')}
            className={`px-4 sm:px-6 py-3 rounded-xl font-medium transition-all ${
              filters.inventoryType === 'produced_goods'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-200'
                : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Produced Goods</span>
            </span>
          </button>
        </div>
      </div>

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
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Stock by Tag</h3>
                  {filters.inventoryType === 'raw_material' && (
                    <div className="flex items-center gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-emerald-500"></div>
                        <span className="text-slate-600">Usable</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-amber-500"></div>
                        <span className="text-slate-600">Unusable</span>
                      </div>
                    </div>
                  )}
                  <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={currentInventoryChartData.slice(0, 15)} margin={{ bottom: 120 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="tag_name" 
                          height={120}
                          tick={(props) => {
                            const { x, y, payload } = props;
                            const words = payload.value.split(' ');
                            const lines: string[] = [];
                            let currentLine = '';
                            
                            words.forEach((word: string) => {
                              if ((currentLine + word).length > 15) {
                                if (currentLine) lines.push(currentLine.trim());
                                currentLine = word + ' ';
                              } else {
                                currentLine += word + ' ';
                              }
                            });
                            if (currentLine) lines.push(currentLine.trim());
                            
                            return (
                              <g transform={`translate(${x},${y})`}>
                                {lines.map((line, index) => (
                                  <text
                                    key={index}
                                    x={0}
                                    y={index * 14}
                                    dy={16}
                                    textAnchor="middle"
                                    fill="#64748b"
                                    fontSize={12}
                                  >
                                    {line}
                                  </text>
                                ))}
                              </g>
                            );
                          }}
                        />
                        <YAxis tick={{ fontSize: 12 }} label={{ value: 'Quantity', angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[4, 4, 0, 0]}
                          fill="#6366f1"
                        >
                          {currentInventoryChartData.slice(0, 15).map((entry: any, index: number) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={
                                entry.type === 'raw_material' && entry.usable !== undefined
                                  ? (entry.usable ? '#10b981' : '#f59e0b')
                                  : '#6366f1'
                              } 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-slate-500 mt-4 text-center">💡 Hover over bars to see exact quantities</p>
                </div>
              )}

              {/* Table */}
              {currentInventory
                .filter((inv) => !filters.inventoryType || inv.type === filters.inventoryType)
                .map((inv) => {
                  // For raw materials, separate usable and unusable
                  if (inv.type === 'raw_material') {
                    const usableItems = inv.data.filter(item => item.usable === true);
                    const unusableItems = inv.data.filter(item => item.usable === false);
                    
                    return (
                      <div key={inv.type} className="space-y-6">
                        {/* Usable Raw Materials Section */}
                        {usableItems.length > 0 && (
                          <div>
                            <h3 className="text-lg font-bold text-emerald-700 mb-3 flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                              Usable Raw Materials
                            </h3>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-emerald-50 border-y border-emerald-200">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase">Tag</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 uppercase">Balance</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 uppercase">Unit</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 uppercase">Items</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 uppercase">Last Activity</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {usableItems.map((item) => {
                                    const key = `${item.tag_id}-true`;
                                    const isExpanded = expandedTags.has(key);
                                    return (
                                      <>
                                        <tr 
                                          key={item.tag_id} 
                                          onClick={() => toggleTagExpansion(item.tag_id, 'raw_material', true)}
                                          className="hover:bg-emerald-50/30 cursor-pointer"
                                        >
                                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                            <div className="flex items-center gap-2">
                                              {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-emerald-600" />
                                              ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                              )}
                                              {item.tag_name}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-sm text-right text-slate-700">{item.current_balance.toFixed(2)}</td>
                                          <td className="px-4 py-3 text-sm text-right text-slate-500">{item.default_unit}</td>
                                          <td className="px-4 py-3 text-sm text-right text-slate-700">{item.item_count}</td>
                                          <td className="px-4 py-3 text-sm text-right text-slate-500">
                                            {formatDate(item.last_movement_date)}
                                          </td>
                                        </tr>
                                        {isExpanded && renderTagDetails(key, 'raw_material')}
                                      </>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Unusable Raw Materials Section */}
                        {unusableItems.length > 0 && (
                          <div>
                            <h3 className="text-lg font-bold text-amber-700 mb-3 flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                              Unusable Raw Materials
                            </h3>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-amber-50 border-y border-amber-200">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase">Tag</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-amber-700 uppercase">Balance</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-amber-700 uppercase">Unit</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-amber-700 uppercase">Items</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-amber-700 uppercase">Last Activity</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {unusableItems.map((item) => {
                                    const key = `${item.tag_id}-false`;
                                    const isExpanded = expandedTags.has(key);
                                    return (
                                      <>
                                        <tr 
                                          key={item.tag_id} 
                                          onClick={() => toggleTagExpansion(item.tag_id, 'raw_material', false)}
                                          className="hover:bg-amber-50/30 cursor-pointer"
                                        >
                                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                            <div className="flex items-center gap-2">
                                              {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-amber-600" />
                                              ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                              )}
                                              {item.tag_name}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-sm text-right text-slate-700">{item.current_balance.toFixed(2)}</td>
                                          <td className="px-4 py-3 text-sm text-right text-slate-500">{item.default_unit}</td>
                                          <td className="px-4 py-3 text-sm text-right text-slate-700">{item.item_count}</td>
                                          <td className="px-4 py-3 text-sm text-right text-slate-500">
                                            {formatDate(item.last_movement_date)}
                                          </td>
                                        </tr>
                                        {isExpanded && renderTagDetails(key, 'raw_material')}
                                      </>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  // For other inventory types, render normally
                  return (
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
                            {inv.data.map((item) => {
                              const key = item.tag_id;
                              const isExpanded = expandedTags.has(key);
                              return (
                                <>
                                  <tr 
                                    key={item.tag_id} 
                                    onClick={() => toggleTagExpansion(item.tag_id, inv.type)}
                                    className="hover:bg-slate-50 cursor-pointer"
                                  >
                                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                      <div className="flex items-center gap-2">
                                        {isExpanded ? (
                                          <ChevronDown className="w-4 h-4 text-indigo-600" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4 text-slate-400" />
                                        )}
                                        {item.tag_name}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-slate-700">{item.current_balance.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-sm text-right text-slate-500">{item.default_unit}</td>
                                    <td className="px-4 py-3 text-sm text-right text-slate-700">{item.item_count}</td>
                                    <td className="px-4 py-3 text-sm text-right text-slate-500">
                                      {formatDate(item.last_movement_date || item.last_production_date)}
                                    </td>
                                  </tr>
                                  {isExpanded && renderTagDetails(key, inv.type)}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Out of Stock Tab */}
          {activeTab === 'outofstock' && (
            <div className="space-y-4">
              {(() => {
                const filteredItems = filters.inventoryType 
                  ? outOfStockItems.filter(item => item.inventory_type === filters.inventoryType)
                  : outOfStockItems;
                
                return filteredItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No out-of-stock items{filters.inventoryType ? ` for ${filters.inventoryType.replace('_', ' ')}` : ''}</p>
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
                        {filteredItems.map((item) => {
                          const key = item.tag_id;
                          const isExpanded = expandedTags.has(key);
                          return (
                            <>
                              <tr 
                                key={`${item.inventory_type}-${item.tag_id}`} 
                                onClick={() => toggleTagExpansion(item.tag_id, item.inventory_type as InventoryType)}
                                className="hover:bg-slate-50 cursor-pointer"
                              >
                                <td className="px-4 py-3 text-sm capitalize text-slate-700">{item.inventory_type.replace('_', ' ')}</td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-rose-600" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-400" />
                                    )}
                                    {item.tag_name}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-rose-600 font-medium">{item.current_balance.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right text-slate-500">{formatDate(item.last_activity_date)}</td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={4} className="px-0 py-0">
                                    <div className="px-4 py-4 bg-slate-50 text-center text-sm text-slate-600">
                                      <p>Out of stock items have no current inventory to display.</p>
                                      <p className="text-xs text-slate-500 mt-1">Check the Consumption tab for historical usage data.</p>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Low Stock Tab */}
          {activeTab === 'lowstock' && (
            <div className="space-y-4">
              {(() => {
                const filteredItems = filters.inventoryType 
                  ? lowStockItems.filter(item => item.inventory_type === filters.inventoryType)
                  : lowStockItems;
                
                return filteredItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No low-stock items{filters.inventoryType ? ` for ${filters.inventoryType.replace('_', ' ')}` : ''}</p>
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
                        {filteredItems.map((item) => {
                          const key = item.tag_id;
                          const isExpanded = expandedTags.has(key);
                          return (
                            <>
                              <tr 
                                key={`${item.inventory_type}-${item.tag_id}`} 
                                onClick={() => toggleTagExpansion(item.tag_id, item.inventory_type as InventoryType)}
                                className="hover:bg-slate-50 cursor-pointer"
                              >
                                <td className="px-4 py-3 text-sm capitalize text-slate-700">{item.inventory_type.replace('_', ' ')}</td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-amber-600" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-400" />
                                    )}
                                    {item.tag_name}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-amber-600 font-medium">{item.current_balance.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right text-slate-700">{item.threshold_quantity.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right text-rose-600 font-medium">{item.shortage_amount.toFixed(2)}</td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={5} className="px-0 py-0">
                                    {renderTagDetails(key, item.inventory_type as InventoryType)}
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Consumption Tab */}
          {activeTab === 'consumption' && (
            <div className="space-y-6">
              {/* Month-Year Switcher and Tag Filter for Consumption */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Month Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 rounded-xl p-4 gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm sm:text-base">Select Month</h4>
                    <p className="text-xs sm:text-sm text-slate-500">View consumption data for a specific month</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                      title="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                    </button>
                    
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 min-w-[120px] sm:min-w-[140px] text-center">
                      {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    
                    <button
                      onClick={goToNextMonth}
                      disabled={isCurrentMonth()}
                      className={`p-1 rounded transition-colors ${
                        isCurrentMonth() 
                          ? 'opacity-40 cursor-not-allowed' 
                          : 'hover:bg-slate-200'
                      }`}
                      title={isCurrentMonth() ? "Can't view future months" : "Next month"}
                    >
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                    </button>
                  </div>
                </div>

                {/* Tag Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 rounded-xl p-4 gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm sm:text-base">Filter by Tag</h4>
                    <p className="text-xs sm:text-sm text-slate-500">View consumption for a specific tag</p>
                  </div>
                  <div className="min-w-[200px]">
                    <select
                      value={selectedConsumptionTag || ''}
                      onChange={(e) => setSelectedConsumptionTag(e.target.value || null)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">All Tags</option>
                      {availableTags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {consumptionTrendData.length > 0 && (
                <>
                  {/* Line Chart */}
                  <div className="bg-slate-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">
                      Consumption Trend
                      {selectedConsumptionTag && (
                        <span className="text-sm font-normal text-slate-600 ml-2">
                          - {availableTags.find(t => t.id === selectedConsumptionTag)?.name}
                        </span>
                      )}
                    </h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={consumptionTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip 
                            labelFormatter={(value) => {
                              const date = new Date(value);
                              return date.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              });
                            }}
                          />
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

              {/* Empty state when no data for selected tag */}
              {consumptionTrendData.length === 0 && selectedConsumptionTag && (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-400 opacity-50" />
                  <p className="text-slate-600 font-medium">No consumption data for selected tag</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Try selecting a different tag or month
                  </p>
                </div>
              )}

              {/* Empty state when no data at all */}
              {consumptionTrendData.length === 0 && !selectedConsumptionTag && (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-400 opacity-50" />
                  <p className="text-slate-600 font-medium">No consumption data available</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Try selecting a different month or inventory type
                  </p>
                </div>
              )}

              {/* Table */}
              {(() => {
                // Show consumption data for all items, including those currently out of stock
                // Consumption history is important even if the item is now depleted
                
                // Group by tag and accumulate totals
                const groupedByTag = consumptionData.reduce((acc, item) => {
                  const key = item.tag_id;
                  if (!acc[key]) {
                    acc[key] = {
                      tag_id: item.tag_id,
                      tag_name: item.tag_name,
                      total_consumed: 0,
                      total_wasted: 0,
                      total_transactions: 0,
                      details: []
                    };
                  }
                  acc[key].total_consumed += item.total_consumed || 0;
                  acc[key].total_wasted += item.total_wasted || 0;
                  acc[key].total_transactions += item.consumption_transactions || 0;
                  acc[key].details.push(item);
                  return acc;
                }, {} as Record<string, {
                  tag_id: string;
                  tag_name: string;
                  total_consumed: number;
                  total_wasted: number;
                  total_transactions: number;
                  details: ConsumptionSummary[];
                }>);

                const aggregatedData = Object.values(groupedByTag);

                const toggleExpand = (tagId: string) => {
                  setExpandedTags(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(tagId)) {
                      newSet.delete(tagId);
                    } else {
                      newSet.add(tagId);
                    }
                    return newSet;
                  });
                };

                return aggregatedData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-y border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-8"></th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Tag</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Total Consumed</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Total Wasted</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Transactions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {aggregatedData.map((group) => {
                          const isExpanded = expandedTags.has(group.tag_id);
                          return (
                            <>
                              {/* Summary Row */}
                              <tr 
                                key={group.tag_id}
                                onClick={() => toggleExpand(group.tag_id)}
                                className="hover:bg-indigo-50 cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-3 text-sm text-slate-500">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{group.tag_name}</td>
                                <td className="px-4 py-3 text-sm text-right text-indigo-600 font-semibold">{group.total_consumed.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right text-rose-600 font-semibold">{group.total_wasted.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right text-slate-700 font-semibold">{group.total_transactions}</td>
                              </tr>
                              
                              {/* Expanded Detail Rows */}
                              {isExpanded && group.details.map((detail, idx) => (
                                <tr key={`${group.tag_id}-${idx}`} className="bg-slate-50">
                                  <td className="px-4 py-2"></td>
                                  <td className="px-4 py-2 text-xs text-slate-600 pl-8">{formatDate(detail.consumption_date)}</td>
                                  <td className="px-4 py-2 text-xs text-right text-slate-700">{detail.total_consumed.toFixed(2)}</td>
                                  <td className="px-4 py-2 text-xs text-right text-rose-500">{detail.total_wasted.toFixed(2)}</td>
                                  <td className="px-4 py-2 text-xs text-right text-slate-500">{detail.consumption_transactions}</td>
                                </tr>
                              ))}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
