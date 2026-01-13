import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  Filter,
  Calendar,
  Tag,
  DollarSign,
  AlertCircle,
  Target,
  ChevronDown,
  ChevronUp,
  Activity,
  ChevronRight,
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  AnalyticsFilters,
  DateRangePreset,
  TagType,
  PaymentStatusFilter,
  ViewMode,
  SalesMetrics,
  FinancialVerdict,
  Recommendation,
  TargetProgress,
} from '../types/analytics';
import {
  fetchSalesMetrics,
  calculateFinancialVerdict,
  generateRecommendations,
  fetchAllTargetProgress,
  fetchSalesAnalyticsByTag,
  fetchIncomeAnalytics,
  fetchExpenseAnalytics,
} from '../lib/analytics';
import { fetchProducedGoodsTags, fetchRawMaterialTags, fetchRecurringProductTags } from '../lib/tags';
import type { ProducedGoodsTag, RawMaterialTag, RecurringProductTag } from '../types/tags';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsProps {
  accessLevel: AccessLevel;
}

export function Analytics({ accessLevel: _accessLevel }: AnalyticsProps) {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: 'month',
    viewMode: 'summary',
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set());

  // Data states
  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics | null>(null);
  const [financialVerdict, setFinancialVerdict] = useState<FinancialVerdict | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [targetProgress, setTargetProgress] = useState<TargetProgress[]>([]);
  const [salesChartData, setSalesChartData] = useState<any[]>([]);
  const [incomeExpenseData, setIncomeExpenseData] = useState<any[]>([]);

  // Tag options
  const [producedGoodsTags, setProducedGoodsTags] = useState<ProducedGoodsTag[]>([]);
  const [rawMaterialTags, setRawMaterialTags] = useState<RawMaterialTag[]>([]);
  const [recurringProductTags, setRecurringProductTags] = useState<RecurringProductTag[]>([]);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [filters]);

  const loadTags = async () => {
    try {
      const [produced, raw, recurring] = await Promise.all([
        fetchProducedGoodsTags(),
        fetchRawMaterialTags(),
        fetchRecurringProductTags(),
      ]);
      setProducedGoodsTags(produced);
      setRawMaterialTags(raw);
      setRecurringProductTags(recurring);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [
        sales,
        verdict,
        recs,
        targets,
        salesData,
        incomeData,
        expenseData,
      ] = await Promise.all([
        fetchSalesMetrics(filters),
        calculateFinancialVerdict(filters),
        generateRecommendations(filters),
        fetchAllTargetProgress(),
        fetchSalesAnalyticsByTag(filters),
        fetchIncomeAnalytics(filters),
        fetchExpenseAnalytics(filters),
      ]);

      setSalesMetrics(sales);
      setFinancialVerdict(verdict);
      setRecommendations(recs);

      // Filter targets by current date range
      const { start, end } = getDateRange(filters);
      const filteredTargets = targets.filter(
        (t) => t.target.period_start <= end && t.target.period_end >= start
      );
      setTargetProgress(filteredTargets);

      // Prepare chart data
      const salesChart = salesData.reduce((acc: any, item) => {
        const date = item.date;
        const existing = acc.find((d: any) => d.date === date);
        if (existing) {
          existing.value += item.total_sales_value || 0;
        } else {
          acc.push({ date, value: item.total_sales_value || 0 });
        }
        return acc;
      }, []);

      setSalesChartData(salesChart);

      // Combine income and expense data
      const incomeMap = new Map(incomeData.map((i) => [i.date, i.total_income]));
      const expenseMap = new Map(expenseData.map((e) => [e.date, e.total_expense]));

      const allDates = new Set([...incomeMap.keys(), ...expenseMap.keys()]);
      const combinedData = Array.from(allDates)
        .sort()
        .map((date) => ({
          date,
          income: incomeMap.get(date) || 0,
          expense: expenseMap.get(date) || 0,
        }));

      setIncomeExpenseData(combinedData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (filters: AnalyticsFilters): { start: string; end: string } => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const end = today.toISOString().split('T')[0];

    let start: Date;
    switch (filters.dateRange) {
      case 'today':
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      case 'custom':
        start = filters.startDate ? new Date(filters.startDate) : new Date(today);
        break;
      default:
        start = new Date(today);
        start.setMonth(start.getMonth() - 1);
    }

    if (filters.dateRange === 'custom' && filters.startDate) {
      start = new Date(filters.startDate);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end,
    };
  };

  const updateFilter = <K extends keyof AnalyticsFilters>(
    key: K,
    value: AnalyticsFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'stable':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const availableTags = useMemo(() => {
    switch (filters.tagType) {
      case 'raw_material':
        return rawMaterialTags;
      case 'recurring_product':
        return recurringProductTags;
      case 'produced_goods':
        return producedGoodsTags;
      default:
        return [];
    }
  }, [filters.tagType, rawMaterialTags, recurringProductTags, producedGoodsTags]);

  if (loading && !salesMetrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Intelligence</h1>
          <p className="mt-2 text-gray-600">Unified performance metrics and insights</p>
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Filter className="w-5 h-5" />
          <span>Filters</span>
          {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Global Filter Panel */}
      {filtersOpen && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => updateFilter('dateRange', e.target.value as DateRangePreset)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="today">Today</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Custom Date Range */}
            {filters.dateRange === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => updateFilter('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => updateFilter('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {/* Tag Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                Tag Type
              </label>
              <select
                value={filters.tagType || ''}
                onChange={(e) => {
                  const value = e.target.value as TagType | '';
                  updateFilter('tagType', value || undefined);
                  updateFilter('specificTagId', undefined);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Tags</option>
                <option value="raw_material">Raw Material</option>
                <option value="recurring_product">Recurring Product</option>
                <option value="produced_goods">Produced Goods</option>
              </select>
            </div>

            {/* Specific Tag */}
            {filters.tagType && availableTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Specific Tag</label>
                <select
                  value={filters.specificTagId || ''}
                  onChange={(e) => updateFilter('specificTagId', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All {filters.tagType} tags</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
              <select
                value={filters.paymentStatus || 'all'}
                onChange={(e) => updateFilter('paymentStatus', e.target.value as PaymentStatusFilter)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>

            {/* View Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">View Mode</label>
              <select
                value={filters.viewMode}
                onChange={(e) => updateFilter('viewMode', e.target.value as ViewMode)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="summary">Summary</option>
                <option value="detailed">Detailed</option>
                <option value="comparative">Comparative</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setFilters({
                  dateRange: 'month',
                  viewMode: 'summary',
                });
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Financial Verdict Section */}
      {financialVerdict && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Financial Verdict
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className={`p-4 rounded-lg ${getHealthColor(financialVerdict.overallHealth)}`}>
              <p className="text-sm font-medium mb-1">Overall Health</p>
              <p className="text-2xl font-bold capitalize">{financialVerdict.overallHealth}</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-50">
              <p className="text-sm font-medium text-blue-700 mb-1">Revenue Trend</p>
              <p className="text-2xl font-bold text-blue-900 capitalize">{financialVerdict.revenueTrend}</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50">
              <p className="text-sm font-medium text-purple-700 mb-1">Expense Pressure</p>
              <p className="text-2xl font-bold text-purple-900 capitalize">{financialVerdict.expensePressure}</p>
            </div>
            <div className="p-4 rounded-lg bg-indigo-50">
              <p className="text-sm font-medium text-indigo-700 mb-1">Inventory Risk</p>
              <p className="text-2xl font-bold text-indigo-900 capitalize">{financialVerdict.inventoryRisk}</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-700">{financialVerdict.message}</p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (() => {
        // Group recommendations by title/type
        const groupedRecs = recommendations.reduce((acc, rec) => {
          const key = rec.title;
          if (!acc[key]) {
            acc[key] = {
              title: rec.title,
              type: rec.type,
              severity: rec.severity,
              items: [],
            };
          }
          acc[key].items.push(rec);
          // Keep the most severe severity
          const severityOrder = { critical: 0, warning: 1, info: 2 };
          if (severityOrder[rec.severity] < severityOrder[acc[key].severity]) {
            acc[key].severity = rec.severity;
          }
          return acc;
        }, {} as Record<string, { title: string; type: string; severity: 'critical' | 'warning' | 'info'; items: Recommendation[] }>);

        const groupedArray = Object.values(groupedRecs);

        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Recommendations
                <span className="text-sm font-normal text-gray-500">({recommendations.length} items)</span>
              </h2>
            </div>
            <div className="space-y-2">
              {groupedArray.map((group) => {
                const isExpanded = expandedRecommendations.has(group.title);
                const itemCount = group.items.length;
                const itemText = itemCount === 1 ? 'Product' : 'Products';

                return (
                  <div
                    key={group.title}
                    className={`border rounded-lg overflow-hidden ${getSeverityColor(group.severity)}`}
                  >
                    <button
                      onClick={() => {
                        setExpandedRecommendations((prev) => {
                          const newSet = new Set(prev);
                          if (newSet.has(group.title)) {
                            newSet.delete(group.title);
                          } else {
                            newSet.add(group.title);
                          }
                          return newSet;
                        });
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-opacity-80 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <AlertCircle
                          className={`w-5 h-5 flex-shrink-0 ${
                            group.severity === 'critical' ? 'text-red-600' : group.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">
                            {group.title}
                            {itemCount > 1 && (
                              <span className="ml-2 text-sm font-normal text-gray-600">
                                - {itemCount} {itemText} affected
                              </span>
                            )}
                          </h3>
                          {itemCount === 1 && (
                            <p className="text-sm text-gray-700 mt-1">{group.items[0].message}</p>
                          )}
                        </div>
                      </div>
                      {itemCount > 1 && (
                        <div className="flex-shrink-0 ml-4">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                      )}
                    </button>
                    {isExpanded && itemCount > 1 && (
                      <div className="border-t bg-white bg-opacity-50">
                        <div className="p-4 space-y-3">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="pl-8 border-l-2 border-gray-300"
                            >
                              <p className="text-sm text-gray-700">
                                <span className="font-medium text-gray-900">
                                  {item.relatedTagName || 'Unknown Product'}:
                                </span>{' '}
                                {item.message.split('.').slice(1).join('.').trim() || item.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Sales Analytics */}
      {salesMetrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Sales Analytics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 font-medium">Total Sales</p>
              <p className="text-2xl font-bold text-blue-900">
                ₹{salesMetrics.totalSalesValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700 font-medium">Quantity Sold</p>
              <p className="text-2xl font-bold text-green-900">
                {salesMetrics.totalQuantitySold.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700 font-medium">Orders</p>
              <p className="text-2xl font-bold text-purple-900">{salesMetrics.numberOfOrders}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-700 font-medium">Avg Order Value</p>
              <p className="text-2xl font-bold text-orange-900">
                ₹{salesMetrics.averageOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-700 font-medium">Payment Collected</p>
              <p className="text-2xl font-bold text-emerald-900">
                ₹{salesMetrics.paymentCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700 font-medium">Payment Pending</p>
              <p className="text-2xl font-bold text-red-900">
                ₹{salesMetrics.paymentPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Sales Chart */}
          {salesChartData.length > 0 && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" name="Sales Value" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Finance Analytics */}
      {incomeExpenseData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Finance Analytics
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#10b981" name="Income" />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Expense" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Targets Dashboard */}
      {targetProgress.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Targets Progress
          </h2>
          <div className="space-y-4">
            {targetProgress.map((progress) => (
              <div key={progress.target.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{progress.target.target_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    progress.isOnTrack ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {progress.isOnTrack ? 'On Track' : 'Behind'}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Achieved: {progress.achieved.toLocaleString('en-IN')}</span>
                    <span>Target: {progress.target.target_value.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        progress.percentage >= 100 ? 'bg-green-500' : progress.percentage >= 75 ? 'bg-blue-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(100, progress.percentage)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{progress.percentage.toFixed(1)}%</span>
                    <span>{progress.daysRemaining} days remaining</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
