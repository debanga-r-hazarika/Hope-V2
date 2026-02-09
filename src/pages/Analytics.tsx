import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Filter,
  DollarSign,
  AlertCircle,
  Target,
  ChevronDown,
  ChevronUp,
  Activity,
  ChevronRight,
  Building2,
  ShoppingBag,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Package
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  AnalyticsFilters,
  DateRangePreset,
  TagType,
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
import { fetchAllCustomersWithStats } from '../lib/sales';
import { fetchProducedGoodsTags, fetchRawMaterialTags, fetchRecurringProductTags } from '../lib/tags';
import type { ProducedGoodsTag, RawMaterialTag, RecurringProductTag } from '../types/tags';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';

interface AnalyticsProps {
  accessLevel: AccessLevel;
}

export function Analytics({ accessLevel: _accessLevel }: AnalyticsProps) {
  const navigate = useNavigate();
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
  const [customerOverview, setCustomerOverview] = useState<{
    totalCustomers: number;
    totalOrders: number;
    totalRevenue: number;
    totalOutstanding: number;
  } | null>(null);

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
        customersData
      ] = await Promise.all([
        fetchSalesMetrics(filters),
        calculateFinancialVerdict(filters),
        generateRecommendations(filters),
        fetchAllTargetProgress(),
        fetchSalesAnalyticsByTag(filters),
        fetchIncomeAnalytics(filters),
        fetchExpenseAnalytics(filters),
        fetchAllCustomersWithStats()
      ]);

      setSalesMetrics(sales);
      setFinancialVerdict(verdict);
      setRecommendations(recs);

      // Calculate Customer Overview
      const totalCustomers = customersData.length;
      const totalOrders = customersData.reduce((sum, c) => sum + (c.order_count || 0), 0);
      const totalRevenue = customersData.reduce((sum, c) => sum + (c.total_sales_value || 0), 0);
      const totalOutstanding = customersData.reduce((sum, c) => sum + (c.outstanding_amount || 0), 0);
      setCustomerOverview({ totalCustomers, totalOrders, totalRevenue, totalOutstanding });

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
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-600 font-medium animate-pulse">Gathering insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Business Analytics</h1>
          <p className="mt-2 text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Real-time performance metrics and financial intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/analytics/inventory')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-all"
          >
            <Package className="w-4 h-4" />
            <span className="font-medium">Inventory Reports</span>
          </button>

          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            {(['month', 'quarter', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => updateFilter('dateRange', range)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filters.dateRange === range
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all ${filtersOpen
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600'
              }`}
          >
            <Filter className="w-4 h-4" />
            <span className="font-medium">Advanced Filters</span>
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {filtersOpen && (
        <div className="bg-white border border-indigo-100 rounded-xl p-6 shadow-xl shadow-indigo-100/50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Time Period</label>
              <select
                value={filters.dateRange}
                onChange={(e) => updateFilter('dateRange', e.target.value as DateRangePreset)}
                className="w-full px-3 py-2.5 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="today">Today</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {filters.dateRange === 'custom' && (
              <>
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
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
              <select
                value={filters.tagType || ''}
                onChange={(e) => {
                  const value = e.target.value as TagType | '';
                  updateFilter('tagType', value || undefined);
                  updateFilter('specificTagId', undefined);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Categories</option>
                <option value="raw_material">Raw Materials</option>
                <option value="recurring_product">Recurring Products</option>
                <option value="produced_goods">Produced Goods</option>
              </select>
            </div>

            {filters.tagType && availableTags.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Specific Item</label>
                <select
                  value={filters.specificTagId || ''}
                  onChange={(e) => updateFilter('specificTagId', e.target.value || undefined)}
                  className="w-full px-3 py-2.5 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Items</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.display_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
            <button
              onClick={() => setFilters({ dateRange: 'month', viewMode: 'summary' })}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* Left Column - Financial Health & KPI */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* Financial Verdict Card - Hero */}
          {financialVerdict && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 transition-transform group-hover:scale-110 duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-medium text-slate-300 flex items-center gap-2">
                      <Activity className="w-5 h-5" /> Financial Health Score
                    </h2>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className={`text-4xl font-bold capitalize ${financialVerdict.overallHealth === 'stable' ? 'text-emerald-400' :
                          financialVerdict.overallHealth === 'warning' ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                        {financialVerdict.overallHealth}
                      </span>
                      <span className="text-slate-400 font-light">Status</span>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
                    <p className="text-xs text-slate-300 uppercase tracking-wider mb-1">Revenue Trend</p>
                    <div className="text-xl font-bold flex items-center gap-1">
                      {financialVerdict.revenueTrend === 'growing' ? <ArrowUpRight className="w-5 h-5 text-emerald-400" /> : <ArrowDownRight className="w-5 h-5 text-rose-400" />}
                      <span className="capitalize">{financialVerdict.revenueTrend}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                    <p className="text-sm text-slate-400 mb-1">Expense Pressure</p>
                    <p className={`text-lg font-semibold capitalize ${financialVerdict.expensePressure === 'high' ? 'text-rose-300' : 'text-emerald-300'
                      }`}>{financialVerdict.expensePressure}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                    <p className="text-sm text-slate-400 mb-1">Inventory Risk</p>
                    <p className={`text-lg font-semibold capitalize ${financialVerdict.inventoryRisk !== 'balanced' ? 'text-rose-300' : 'text-emerald-300'
                      }`}>{financialVerdict.inventoryRisk}</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    <Zap className="w-4 h-4 inline mr-2 text-yellow-400" />
                    {financialVerdict.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sales Chart Section */}
          {salesChartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Revenue Trajectory
                </h3>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(value) => `₹${value / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorSales)"
                      name="Sales"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {incomeExpenseData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Cash Flow Analysis
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeExpenseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="expense" fill="#ef4444" name="Expesne" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Metrics & Lists */}
        <div className="col-span-12 lg:col-span-4 space-y-6">

          {/* Quick Metrics Grid */}
          {salesMetrics && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                <div className="p-2 w-fit rounded-lg bg-emerald-50 text-emerald-600 mb-2">
                  <DollarSign className="w-4 h-4" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900 mt-1">₹{salesMetrics.totalSalesValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                <div className="p-2 w-fit rounded-lg bg-blue-50 text-blue-600 mb-2">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Total Orders</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{salesMetrics.numberOfOrders}</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                <div className="p-2 w-fit rounded-lg bg-amber-50 text-amber-600 mb-2">
                  <Target className="w-4 h-4" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Avg Order Val</p>
                <p className="text-xl font-bold text-slate-900 mt-1">₹{salesMetrics.averageOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                <div className="p-2 w-fit rounded-lg bg-rose-50 text-rose-600 mb-2">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Pending Pay</p>
                <p className="text-xl font-bold text-slate-900 mt-1">₹{salesMetrics.paymentPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          )}

          {/* Targets Section */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-fit">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Active Targets</h3>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{targetProgress.length}</span>
            </div>
            <div className="p-2 divide-y divide-slate-50">
              {targetProgress.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active targets for this period</p>
                </div>
              ) : (
                targetProgress.map((progress) => (
                  <div key={progress.target.id} className="p-3 hover:bg-slate-50 rounded-lg transition-colors group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-slate-700 text-sm">{progress.target.target_name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${progress.isOnTrack ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                        {progress.isOnTrack ? 'On Track' : 'Behind'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${progress.percentage >= 100 ? 'bg-emerald-500' : progress.percentage >= 75 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                        style={{ width: `${Math.min(100, progress.percentage)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{progress.percentage.toFixed(0)}% Complete</span>
                      <span>{progress.daysRemaining} days left</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Customer Overview Card */}
          {customerOverview && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Customer Base
                <span className="text-xs font-normal text-slate-400 ml-auto">Lifetime</span>
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-indigo-600">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{customerOverview.totalCustomers}</p>
                      <p className="text-xs text-slate-500">Active Customers</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-emerald-600">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">₹{customerOverview.totalRevenue.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-slate-500">Total Lifetime Value</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Recommendations - Bottom Full Width */}
      {recommendations.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {(() => {
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
              const severityOrder = { critical: 0, warning: 1, info: 2 };
              if (severityOrder[rec.severity] < severityOrder[acc[key].severity]) {
                acc[key].severity = rec.severity;
              }
              return acc;
            }, {} as Record<string, { title: string; type: string; severity: 'critical' | 'warning' | 'info'; items: Recommendation[] }>);

            const groupedArray = Object.values(groupedRecs);

            return (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    AI Actions & Recommendations
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {groupedArray.map((group) => {
                    const isExpanded = expandedRecommendations.has(group.title);
                    const itemCount = group.items.length;

                    return (
                      <div key={group.title} className="group hover:bg-slate-50/50 transition-colors">
                        <button
                          onClick={() => {
                            setExpandedRecommendations((prev) => {
                              const newSet = new Set(prev);
                              if (newSet.has(group.title)) newSet.delete(group.title);
                              else newSet.add(group.title);
                              return newSet;
                            });
                          }}
                          className="w-full text-left p-4 sm:p-5 focus:outline-none"
                        >
                          <div className="flex items-start sm:items-center gap-4">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${group.severity === 'critical' ? 'bg-rose-100 text-rose-600' :
                                group.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                              <AlertCircle className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900 text-sm sm:text-base">{group.title}</h3>
                                {itemCount > 1 && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                    {itemCount} items
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 mt-1 pr-4 truncate">
                                {itemCount === 1 ? group.items[0].message : 'Multiple similar issues detected affecting inventory/sales.'}
                              </p>
                            </div>
                            {itemCount > 1 && (
                              <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            )}
                          </div>
                        </button>

                        {isExpanded && itemCount > 1 && (
                          <div className="bg-slate-50/80 p-4 pl-[4.5rem] space-y-3 animate-in slide-in-from-top-2">
                            {group.items.map((item) => (
                              <div key={item.id} className="text-sm text-slate-700 flex gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0"></span>
                                <span>
                                  <span className="font-medium text-slate-900">{item.relatedTagName || 'Unknown'}:</span>{' '}
                                  {item.message.split('.').slice(1).join('.').trim() || item.message}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
