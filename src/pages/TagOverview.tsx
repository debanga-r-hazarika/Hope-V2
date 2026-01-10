import { useEffect, useState } from 'react';
import { Package, Box, Factory, RefreshCw, TrendingUp, AlertCircle, Info, ChevronRight } from 'lucide-react';
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

export function TagOverview({ accessLevel }: TagOverviewProps) {
  const [activeSection, setActiveSection] = useState<TagOverviewSection>('raw-materials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Raw Materials
  const [rawMaterialTags, setRawMaterialTags] = useState<RawMaterialTag[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [rawMaterialSummary, setRawMaterialSummary] = useState<TagInventorySummary[]>([]);

  // Recurring Products
  const [recurringProductTags, setRecurringProductTags] = useState<RecurringProductTag[]>([]);
  const [recurringProducts, setRecurringProducts] = useState<RecurringProduct[]>([]);
  const [recurringProductSummary, setRecurringProductSummary] = useState<TagInventorySummary[]>([]);

  // Produced Goods
  const [producedGoodsTags, setProducedGoodsTags] = useState<ProducedGoodsTag[]>([]);
  const [processedGoods, setProcessedGoods] = useState<ProcessedGood[]>([]);
  const [producedGoodsSummary, setProducedGoodsSummary] = useState<TagInventorySummary[]>([]);

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    loadAllData();
  }, [accessLevel, activeSection]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawTags, rawMats, recurringTags, recurringProds, producedTags, processed] = await Promise.all([
        fetchRawMaterialTags(false),
        fetchRawMaterials(false),
        fetchRecurringProductTags(false),
        fetchRecurringProducts(false),
        fetchProducedGoodsTags(false),
        fetchProcessedGoods(),
      ]);

      setRawMaterialTags(rawTags);
      setRawMaterials(rawMats);
      setRecurringProductTags(recurringTags);
      setRecurringProducts(recurringProds);
      setProducedGoodsTags(producedTags);
      setProcessedGoods(processed);

      calculateSummaries(rawTags, rawMats, 'raw-material');
      calculateSummaries(recurringTags, recurringProds, 'recurring-product');
      calculateSummaries(producedTags, processed, 'produced-goods');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
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
        tagIds = (item as RawMaterial).raw_material_tag_ids || 
                 ((item as RawMaterial).raw_material_tag_id ? [(item as RawMaterial).raw_material_tag_id!] : []);
        quantity = (item as RawMaterial).quantity_available;
        unit = (item as RawMaterial).unit;
      } else if (type === 'recurring-product') {
        tagIds = (item as RecurringProduct).recurring_product_tag_ids || 
                 ((item as RecurringProduct).recurring_product_tag_id ? [(item as RecurringProduct).recurring_product_tag_id!] : []);
        quantity = (item as RecurringProduct).quantity_available;
        unit = (item as RecurringProduct).unit;
      } else {
        tagIds = (item as ProcessedGood).produced_goods_tag_ids || 
                 ((item as ProcessedGood).produced_goods_tag_id ? [(item as ProcessedGood).produced_goods_tag_id!] : []);
        quantity = (item as ProcessedGood).quantity_available;
        unit = (item as ProcessedGood).unit;
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

    const summaries: TagInventorySummary[] = Array.from(summaryMap.values()).map((summary) => {
      if (summary.total_quantity === 0) {
        summary.status = 'out-of-stock';
      } else if (summary.total_in_stock_quantity > 0 && summary.total_in_stock_quantity / summary.total_quantity < 0.3) {
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
      label: 'Raw Material Tags',
      shortLabel: 'Raw Materials',
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300',
      hoverBg: 'hover:bg-green-50',
      summary: rawMaterialSummary,
    },
    {
      id: 'recurring-products' as TagOverviewSection,
      label: 'Recurring Product Tags',
      shortLabel: 'Recurring Products',
      icon: Box,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300',
      hoverBg: 'hover:bg-purple-50',
      summary: recurringProductSummary,
    },
    {
      id: 'produced-goods' as TagOverviewSection,
      label: 'Produced Goods Tags',
      shortLabel: 'Produced Goods',
      icon: Factory,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300',
      hoverBg: 'hover:bg-blue-50',
      summary: producedGoodsSummary,
    },
  ];

  const currentSection = sections.find((s) => s.id === activeSection);
  const SectionIcon = currentSection?.icon || Package;

  if (accessLevel === 'no-access') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-700 shadow-sm">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="font-medium">You do not have access to the Operations module.</p>
        <p className="text-sm text-gray-500 mt-1">Please contact an administrator.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 pb-6 sm:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 space-y-3 sm:space-y-4 pt-3 sm:pt-4">
        {/* Header Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200/50 p-4 sm:p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                  Inventory Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                  View inventory aggregated by tags (Read-Only)
                </p>
              </div>
            </div>
            <button
              onClick={loadAllData}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow transition-shadow"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 rounded-lg p-4 flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-900">Error loading data</p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Section Tabs - Mobile Optimized */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200/50 p-2 sm:p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              const summary = section.summary;
              const totalTags = summary.length;
              const inStockTags = summary.filter((s) => s.status === 'in-stock').length;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center justify-between sm:justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all relative overflow-hidden group ${
                    isActive
                      ? `${section.bgColor} ${section.color} font-semibold shadow-sm border-2 ${section.borderColor}`
                      : 'text-gray-700 hover:bg-gray-50 border-2 border-transparent hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none">
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isActive ? section.color : 'text-gray-500'}`} />
                    <span className="text-sm sm:text-base font-medium text-left sm:text-center">
                      <span className="sm:hidden">{section.shortLabel}</span>
                      <span className="hidden sm:inline">{section.label}</span>
                    </span>
                  </div>
                  {totalTags > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      isActive 
                        ? 'bg-white/70 text-gray-900' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      <span className="text-green-600 font-semibold">{inStockTags}</span>
                      <span className="text-gray-400">/</span>
                      <span>{totalTags}</span>
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200/50 p-12 text-center">
            <div className="inline-flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm text-gray-600 font-medium">Loading inventory data...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden">
            <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${currentSection?.bgColor || 'bg-gray-100'} ${currentSection?.color || 'text-gray-600'} flex items-center justify-center flex-shrink-0`}>
                  <SectionIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{currentSection?.label}</h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                    Inventory aggregated by tag
                  </p>
                </div>
              </div>
            </div>

            {currentSection?.summary.length === 0 ? (
              <div className="text-center py-12 sm:py-16 px-4">
                <div className="inline-flex flex-col items-center gap-3">
                  <SectionIcon className="w-16 h-16 text-gray-300" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">No tags found</p>
                    <p className="text-xs text-gray-500 mt-1">Create tags in the Admin page first</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tag</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tag Key</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Quantity</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Lots</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Availability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentSection?.summary.map((summary) => (
                        <tr
                          key={summary.tag_id}
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {summary.tag_display_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <code className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200">
                              {summary.tag_key}
                            </code>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {summary.total_quantity.toLocaleString('en-IN')} <span className="text-gray-500 font-normal">
                                {summary.total_quantity === 1 ? 'unit' : 'units'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700 font-medium">{summary.lots_count}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                                summary.status === 'in-stock'
                                  ? 'bg-green-100 text-green-800 border border-green-200'
                                  : summary.status === 'low-stock'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}
                            >
                              {summary.status === 'in-stock'
                                ? 'In Stock'
                                : summary.status === 'low-stock'
                                ? 'Low Stock'
                                : 'Out of Stock'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600 font-medium">
                                {summary.total_in_stock_quantity.toLocaleString('en-IN')} {summary.total_in_stock_quantity === 1 ? 'unit' : 'units'}
                              </span>
                              <span className="text-gray-300">|</span>
                              <span className="text-red-600">
                                {summary.total_out_of_stock_quantity > 0 
                                  ? `${summary.total_out_of_stock_quantity.toLocaleString('en-IN')} ${summary.total_out_of_stock_quantity === 1 ? 'unit' : 'units'}` 
                                  : '0 units'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {currentSection?.summary.map((summary) => (
                    <div
                      key={summary.tag_id}
                      className="p-4 sm:p-5 hover:bg-gray-50/50 transition-colors active:bg-gray-100"
                    >
                      <div className="space-y-3">
                        {/* Tag Name & Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-base leading-tight mb-1">
                              {summary.tag_display_name}
                            </h3>
                            <code className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 inline-block">
                              {summary.tag_key}
                            </code>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                              summary.status === 'in-stock'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : summary.status === 'low-stock'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            {summary.status === 'in-stock'
                              ? 'In Stock'
                              : summary.status === 'low-stock'
                              ? 'Low Stock'
                              : 'Out of Stock'}
                          </span>
                        </div>

                        {/* Quantity & Lots Row */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Quantity</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {summary.total_quantity.toLocaleString('en-IN')} <span className="font-normal text-gray-600">
                                {summary.total_quantity === 1 ? 'unit' : 'units'}
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Lots</p>
                            <p className="text-sm font-semibold text-gray-900">{summary.lots_count}</p>
                          </div>
                        </div>

                        {/* Availability Row */}
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">Availability</p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              <span className="text-green-600 font-medium">
                                {summary.total_in_stock_quantity.toLocaleString('en-IN')} {summary.total_in_stock_quantity === 1 ? 'unit' : 'units'} in stock
                              </span>
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              <span className="text-red-600">
                                {summary.total_out_of_stock_quantity > 0 
                                  ? `${summary.total_out_of_stock_quantity.toLocaleString('en-IN')} ${summary.total_out_of_stock_quantity === 1 ? 'unit' : 'units'} out`
                                  : '0 units out'}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Info Section - Mobile Optimized */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-blue-900 mb-1.5">About Inventory Dashboard</h3>
              <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                This dashboard shows inventory aggregated by tags across all lots. Tags group items with different names, suppliers, or batches that represent the same material type operationally. This view is read-only. To manage tags, go to the Admin page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
