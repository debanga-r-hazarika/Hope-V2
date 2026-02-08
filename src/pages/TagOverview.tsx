import { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Box,
  Factory,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Info,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import type { AccessLevel } from '../types/access';
import { fetchRawMaterials, fetchRecurringProducts, fetchProcessedGoods } from '../lib/operations';
import { fetchRawMaterialTags, fetchRecurringProductTags, fetchProducedGoodsTags } from '../lib/tags';
import type { RawMaterialTag, RecurringProductTag, ProducedGoodsTag } from '../types/tags';
import type { RawMaterial, RecurringProduct, ProcessedGood } from '../types/operations';

interface TagOverviewProps {
  accessLevel: AccessLevel;
}

type TagOverviewSection = 'raw-materials' | 'recurring-products' | 'produced-goods';

interface TagInventorySummary {
  tag_id: string;
  tag_key: string;
  tag_display_name: string;
  total_quantity: number;
  unit: string;
  total_in_stock_quantity: number;
  total_out_of_stock_quantity: number;
  lots_count: number;
  status: 'in-stock' | 'out-of-stock' | 'low-stock';
}

const COLORS = {
  'in-stock': '#10b981', // emerald-500
  'low-stock': '#f59e0b', // amber-500
  'out-of-stock': '#ef4444', // red-500
};

export function TagOverview({ accessLevel }: TagOverviewProps) {
  const [activeSection, setActiveSection] = useState<TagOverviewSection>('raw-materials');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [rawMaterialSummary, setRawMaterialSummary] = useState<TagInventorySummary[]>([]);
  const [recurringProductSummary, setRecurringProductSummary] = useState<TagInventorySummary[]>([]);
  const [producedGoodsSummary, setProducedGoodsSummary] = useState<TagInventorySummary[]>([]);

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    loadAllData();
  }, [accessLevel]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [rawTags, rawMats, recurringTags, recurringProds, producedTags, processed] = await Promise.all([
        fetchRawMaterialTags(false),
        fetchRawMaterials(false),
        fetchRecurringProductTags(false),
        fetchRecurringProducts(),
        fetchProducedGoodsTags(false),
        fetchProcessedGoods(),
      ]);

      calculateSummaries(rawTags, rawMats, 'raw-material');
      calculateSummaries(recurringTags, recurringProds, 'recurring-product');
      calculateSummaries(producedTags, processed, 'produced-goods');
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaries = (
    tags: (RawMaterialTag | RecurringProductTag | ProducedGoodsTag)[],
    items: (RawMaterial | RecurringProduct | ProcessedGood)[],
    type: 'raw-material' | 'recurring-product' | 'produced-goods'
  ) => {
    const summaryMap = new Map<string, TagInventorySummary>();

    tags.forEach((tag) => {
      summaryMap.set(tag.id, {
        tag_id: tag.id,
        tag_key: tag.tag_key,
        tag_display_name: tag.display_name,
        total_quantity: 0,
        unit: '',
        total_in_stock_quantity: 0,
        total_out_of_stock_quantity: 0,
        lots_count: 0,
        status: 'out-of-stock',
      });
    });

    items.forEach((item) => {
      let tagIds: string[] = [];
      let quantity: number;
      let unit: string;

      if (type === 'raw-material') {
        const raw = item as RawMaterial;
        tagIds = raw.raw_material_tag_ids || (raw.raw_material_tag_id ? [raw.raw_material_tag_id] : []);
        quantity = raw.quantity_available;
        unit = raw.unit;
      } else if (type === 'recurring-product') {
        const rec = item as RecurringProduct;
        tagIds = rec.recurring_product_tag_ids || (rec.recurring_product_tag_id ? [rec.recurring_product_tag_id] : []);
        quantity = rec.quantity_available;
        unit = rec.unit;
      } else {
        const prod = item as ProcessedGood;
        tagIds = prod.produced_goods_tag_ids || (prod.produced_goods_tag_id ? [prod.produced_goods_tag_id] : []);
        quantity = prod.quantity_available;
        unit = prod.unit;
      }

      if (tagIds.length === 0) return;

      tagIds.forEach((tagId) => {
        const summary = summaryMap.get(tagId);
        if (!summary) return;

        summary.total_quantity += quantity;
        summary.lots_count += 1;
        if (unit && !summary.unit) summary.unit = unit;

        if (quantity > 0) {
          summary.total_in_stock_quantity += quantity;
        } else {
          summary.total_out_of_stock_quantity += quantity;
        }
      });
    });

    const LOW_STOCK_THRESHOLD = 20;

    const summaries: TagInventorySummary[] = Array.from(summaryMap.values()).map((summary) => {
      if (summary.total_quantity <= 0) {
        summary.status = 'out-of-stock';
      } else if (summary.total_quantity <= LOW_STOCK_THRESHOLD) {
        summary.status = 'low-stock';
      } else {
        summary.status = 'in-stock';
      }
      return summary;
    });

    summaries.sort((a, b) => a.tag_display_name.localeCompare(b.tag_display_name));

    if (type === 'raw-material') {
      setRawMaterialSummary(summaries);
    } else if (type === 'recurring-product') {
      setRecurringProductSummary(summaries);
    } else {
      setProducedGoodsSummary(summaries);
    }
  };

  const sections = [
    {
      id: 'raw-materials' as TagOverviewSection,
      label: 'Raw Materials',
      icon: Package,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      fillColor: 'fill-emerald-500',
      borderColor: 'border-emerald-200',
      gradient: 'from-emerald-500 to-teal-500',
      summary: rawMaterialSummary,
    },
    {
      id: 'recurring-products' as TagOverviewSection,
      label: 'Recurring Products',
      icon: Box,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      fillColor: 'fill-amber-500',
      borderColor: 'border-amber-200',
      gradient: 'from-amber-500 to-orange-500',
      summary: recurringProductSummary,
    },
    {
      id: 'produced-goods' as TagOverviewSection,
      label: 'Produced Goods',
      icon: Factory,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      fillColor: 'fill-blue-500',
      borderColor: 'border-blue-200',
      gradient: 'from-blue-500 to-indigo-500',
      summary: producedGoodsSummary,
    },
  ];

  const currentSection = sections.find((s) => s.id === activeSection);
  const filteredSummary = currentSection?.summary.filter(item =>
    item.tag_display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tag_key.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Metrics Logic
  const metrics = useMemo(() => {
    const data = currentSection?.summary || [];
    const totalItems = data.length;
    const lowStock = data.filter(i => i.status === 'low-stock').length;
    const outOfStock = data.filter(i => i.status === 'out-of-stock').length;
    const inStock = data.filter(i => i.status === 'in-stock').length;
    const totalQuantity = data.reduce((acc, curr) => acc + curr.total_quantity, 0);

    return { totalItems, lowStock, outOfStock, inStock, totalQuantity };
  }, [currentSection?.summary]);

  const chartData = [
    { name: 'In Stock', value: metrics.inStock, color: COLORS['in-stock'] },
    { name: 'Low Stock', value: metrics.lowStock, color: COLORS['low-stock'] },
    { name: 'Out of Stock', value: metrics.outOfStock, color: COLORS['out-of-stock'] },
  ].filter(d => d.value > 0);

  if (accessLevel === 'no-access') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center max-w-md shadow-sm">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 text-lg mb-2">Access Restricted</h3>
          <p className="text-gray-500">You do not have permission to view inventory data. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50/50 pb-12 font-sans min-h-[calc(100vh-100px)]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pt-6">

        {/* Toolbar Area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Filter className="w-5 h-5" />
            </div>
            <span className="font-semibold text-gray-700">Inventory Filters</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative group w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-72 transition-all"
              />
            </div>
            <button
              onClick={loadAllData}
              disabled={loading}
              className="p-2.5 text-gray-500 hover:text-indigo-600 bg-gray-50 border border-gray-200 hover:border-indigo-200 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Items Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <span className="flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50">
                  <ArrowUpRight className="w-3 h-3 mr-1" /> Active
                </span>
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Items</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">{metrics.totalItems}</h3>
              </div>
            </div>
          </div>

          {/* In Stock Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">In Stock</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">{metrics.inStock}</h3>
              </div>
            </div>
          </div>

          {/* Low Stock Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                </div>
                {metrics.lowStock > 0 && (
                  <span className="flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100/50">
                    Action Needed
                  </span>
                )}
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">Low Stock Alerts</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">{metrics.lowStock}</h3>
              </div>
            </div>
          </div>

          {/* Out of Stock Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                </div>
                {metrics.outOfStock > 0 && (
                  <span className="flex items-center text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-100/50">
                    <ArrowDownRight className="w-3 h-3 mr-1" /> Critical
                  </span>
                )}
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">Out of Stock</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">{metrics.outOfStock}</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">

            {/* Custom Segmented Control */}
            <div className="bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm inline-flex w-full overflow-x-auto scrollbar-hide">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      relative flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap flex-1 lg:flex-none justify-center group outline-none
                      ${isActive
                        ? `bg-gradient-to-r ${section.gradient} text-white shadow-md`
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
                    {section.label}
                  </button>
                );
              })}
            </div>

            {/* Inventory List */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/30 backdrop-blur-sm sticky top-0 z-10">
                <h3 className="font-bold text-gray-900 flex items-center gap-2.5 text-lg">
                  <div className={`w-1.5 h-6 rounded-full bg-gradient-to-b ${currentSection?.gradient}`}></div>
                  Inventory List
                </h3>
                <span className="hidden sm:inline-flex items-center text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-sm">
                  {filteredSummary.length} ITEMS
                </span>
              </div>

              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    </div>
                  </div>
                  <p className="text-gray-500 font-medium mt-4 animate-pulse">Updating inventory...</p>
                </div>
              ) : filteredSummary.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5 border border-gray-100 shadow-inner">
                    <Search className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-gray-900 font-bold text-lg mb-1">No items found</h3>
                  <p className="text-gray-500 text-sm max-w-xs mx-auto">
                    We couldn't find any tags matching your search for "{searchQuery}"
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 rounded-tl-lg">Item Name</th>
                          <th className="px-6 py-4">Tag Key</th>
                          <th className="px-6 py-4 text-right">Total Qty</th>
                          <th className="px-6 py-4 text-center">Lots</th>
                          <th className="px-6 py-4 rounded-tr-lg">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredSummary.map((item) => (
                          <tr key={item.tag_id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                            <td className="px-6 py-4">
                              <span className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                                {item.tag_display_name}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              <code className="text-[11px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                {item.tag_key}
                              </code>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="font-semibold text-gray-900">
                                {item.total_quantity.toLocaleString()}
                                <span className="text-gray-400 font-normal text-xs ml-1">{item.unit || 'units'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold border border-gray-200">
                                {item.lots_count}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`
                                  inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm
                                  ${item.status === 'in-stock'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : item.status === 'low-stock'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : 'bg-red-50 text-red-700 border-red-100'
                                }
                                `}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-2 
                                    ${item.status === 'in-stock' ? 'bg-emerald-500' : item.status === 'low-stock' ? 'bg-amber-500' : 'bg-red-500'}
                                  `}></span>
                                {item.status === 'in-stock' ? 'In Stock' : item.status === 'low-stock' ? 'Low Stock' : 'Out of Stock'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="sm:hidden flex-1 overflow-y-auto max-h-[600px] p-2 space-y-2.5 bg-gray-50/50">
                    {filteredSummary.map((item) => (
                      <div key={item.tag_id} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-[0.99] transition-transform">
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="flex-1 mr-3">
                            <h4 className="font-bold text-gray-900 text-[15px] leading-tight mb-1">{item.tag_display_name}</h4>
                            <code className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              {item.tag_key}
                            </code>
                          </div>
                          <span className={`
                                  inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border flex-shrink-0
                                  ${item.status === 'in-stock'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : item.status === 'low-stock'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-red-50 text-red-700 border-red-100'
                            }
                                `}>
                            {item.status.replace('-', ' ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Quantity</p>
                            <span className="font-bold text-gray-900 text-sm">
                              {item.total_quantity.toLocaleString()} <span className="text-gray-400 font-medium text-xs scale-90">{item.unit || 'units'}</span>
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Lots</p>
                            <span className="font-bold text-gray-900 text-sm flex items-center justify-end gap-1">
                              <Box className="w-3.5 h-3.5 text-gray-400" />
                              {item.lots_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Sidebar - Analytics */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                  <PieChartIcon className="w-5 h-5 text-indigo-500" />
                  Distribution
                </h3>
              </div>

              <div className="h-[260px] w-full relative">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                        cornerRadius={6}
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '8px 12px' }}
                        itemStyle={{ color: '#111827', fontWeight: 600, fontSize: '13px' }}
                        cursor={false}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
                    <span className="text-sm">No data to display</span>
                  </div>
                )}
                {/* Center Label */}
                {chartData.length > 0 && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                    <span className="text-3xl font-extrabold text-gray-900 block tracking-tight">{metrics.totalItems}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Total Items</span>
                  </div>
                )}
              </div>

              <div className="mt-8 space-y-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-600 font-medium">Stock Efficiency</span>
                    <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
                      {metrics.totalItems > 0 ? Math.round((metrics.inStock / metrics.totalItems) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all duration-1000 ease-out"
                      style={{ width: `${metrics.totalItems > 0 ? (metrics.inStock / metrics.totalItems) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Percentage of items currently in stock</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/50 rounded-2xl">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                      <Info className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-indigo-900">Did you know?</h4>
                      <p className="text-xs text-indigo-800/80 mt-1 leading-relaxed font-medium">
                        This dashboard aggregates inventory by tags to create a unified view across multiple lots and batches.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
