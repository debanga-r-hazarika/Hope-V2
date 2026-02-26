import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Users,
  Package,
  DollarSign,
  Calendar,
  Download,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  SalesAnalyticsFilters,
  SalesSummary,
  CustomerSalesReport,
  ProductSalesReport,
  OutstandingPaymentReport,
  SalesTrendData,
  ProductPerformanceData,
  CustomerConcentrationData,
  ProductExtremeData,
  CustomerPaymentPerformance,
  SalesDistribution,
  CustomerTypeDistribution,
  ProductSalesTrendData,
} from '../types/sales-analytics';
import {
  fetchSalesSummary,
  fetchCustomerSalesReport,
  fetchProductSalesReport,
  fetchOutstandingPaymentsReport,
  fetchSalesTrendData,
  fetchProductPerformanceData,
  fetchCustomerConcentrationData,
  fetchTopSellingProducts,
  fetchLowestSellingProducts,
  fetchTopPayingCustomers,
  fetchHighestOutstandingCustomers,
  fetchSalesDistribution,
  fetchCustomerTypeDistribution,
  fetchProductSalesTrendData,
} from '../lib/sales-analytics';
import { fetchCustomerTypes } from '../lib/customer-types';
import type { CustomerType } from '../types/customer-types';
import { supabase } from '../lib/supabase';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
// Custom axis tick for wrapping long labels on multiple lines
const CustomXAxisTick = ({ x, y, payload }: any) => {
  if (!payload || !payload.value) return null;
  const words = payload.value.toString().split(' ');
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word: string) => {
    if ((currentLine + word).length > 14) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine) lines.push(currentLine.trim());

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={30} textAnchor="middle" fill="#64748b" fontSize={11} className="font-medium">
        {lines.map((line, index) => (
          <tspan x={0} dy={index === 0 ? 0 : 16} key={index}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

// Custom pie chart label for wrapping text and preventing clipping
const CustomPieLabel = ({ cx, cy, midAngle, outerRadius, tagName, customerType, shareOfTotalSales, sharePercentage }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 1.25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? 'start' : 'end';

  const name = tagName || customerType || '';
  const share = shareOfTotalSales ?? sharePercentage ?? 0;

  const words = name.toString().split(' ');
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word: string) => {
    if ((currentLine + word).length > 12) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine) lines.push(currentLine.trim());

  return (
    <text x={x} y={y} fill="#64748b" textAnchor={textAnchor} dominantBaseline="central" fontSize={11}>
      {lines.map((line, i) => (
        <tspan x={x} dy={i === 0 ? 0 : 14} key={i}>{line}</tspan>
      ))}
      <tspan x={x} dy={14} fill="#334155" fontWeight="bold">
        {share.toFixed(1)}%
      </tspan>
    </text>
  );
};

interface SalesAnalyticsProps {
  accessLevel: AccessLevel;
}

export function SalesAnalytics({ accessLevel: _accessLevel }: SalesAnalyticsProps) {
  // State management
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'products' | 'customers' | 'trends'>('summary');

  // Date range state (null = All Time, otherwise specific month)
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);

  // Section-specific filters
  const [summaryFilters, setSummaryFilters] = useState<{ customerType?: string }>({});
  const [trendsFilters, setTrendsFilters] = useState<{ customerType?: string; productTag?: string }>({});

  // Customer types (admin-defined)
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // Product tags for filtering
  const [productTags, setProductTags] = useState<{ id: string; display_name: string }[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Data states
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [customerSales, setCustomerSales] = useState<CustomerSalesReport[]>([]);
  const [productSales, setProductSales] = useState<ProductSalesReport[]>([]);
  const [outstandingPayments, setOutstandingPayments] = useState<OutstandingPaymentReport[]>([]);
  const [salesTrend, setSalesTrend] = useState<SalesTrendData[]>([]);
  const [productSalesTrend, setProductSalesTrend] = useState<ProductSalesTrendData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductExtremeData[]>([]);
  const [lowestProducts, setLowestProducts] = useState<ProductExtremeData[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerPaymentPerformance[]>([]);
  const [highestOutstanding, setHighestOutstanding] = useState<CustomerPaymentPerformance[]>([]);
  const [distribution, setDistribution] = useState<SalesDistribution | null>(null);
  const [customerTypeDistribution, setCustomerTypeDistribution] = useState<CustomerTypeDistribution[]>([]);

  // Month navigation
  const goToPreviousMonth = () => {
    setSelectedMonth(prev => {
      if (!prev) {
        // If "All Time", go to current month
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
      }
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    setSelectedMonth(prev => {
      if (!prev) {
        // If "All Time", go to current month
        return currentMonth;
      }
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);

      if (newDate > currentMonth) {
        return prev;
      }
      return newDate;
    });
  };

  const isCurrentMonth = () => {
    if (!selectedMonth) return false;
    const now = new Date();
    return selectedMonth.getFullYear() === now.getFullYear() &&
      selectedMonth.getMonth() === now.getMonth();
  };

  const setToAllTime = () => {
    setSelectedMonth(null);
  };

  const setToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Get date filters from selected month
  const getDateFilters = () => {
    if (!selectedMonth) {
      // No date filter for "All Time"
      return {};
    }

    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    // Create dates in local timezone and format as YYYY-MM-DD
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    // Format dates without timezone conversion
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  };

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
  }, [selectedMonth, summaryFilters, trendsFilters]);

  // Load customer types and product tags on mount
  useEffect(() => {
    loadCustomerTypes();
    loadProductTags();
  }, []);

  const loadCustomerTypes = async () => {
    setLoadingTypes(true);
    try {
      const types = await fetchCustomerTypes(false); // Only active types
      setCustomerTypes(types);
    } catch (err) {
      console.error('Failed to load customer types:', err);
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadProductTags = async () => {
    setLoadingTags(true);
    try {
      const { data, error } = await supabase
        .from('produced_goods_tags')
        .select('id, display_name')
        .order('display_name', { ascending: true });

      if (error) throw error;
      setProductTags(data || []);
    } catch (err) {
      console.error('Failed to load product tags:', err);
    } finally {
      setLoadingTags(false);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilters = getDateFilters();

      // Sales Summary filters (customer type only)
      const summaryFullFilters = { ...summaryFilters, ...dateFilters };

      // Sales Trends filters (customer type + product tag, NO date filter)
      const trendsFullFilters = { ...trendsFilters }; // No date filters for trends

      // No filters for Product and Customer Performance sections
      const filtersWithoutCustomerType = { ...dateFilters };

      // Outstanding payments should NOT be affected by ANY filters
      // Always show ALL outstanding payments (no date filter, no customer type filter)

      const [
        summaryData,
        customerData,
        productData,
        outstandingData,
        trendData,
        productTrendData,
        topProductsData,
        lowestProductsData,
        topCustomersData,
        outstandingCustomersData,
        distributionData,
        customerTypeDistData,
      ] = await Promise.all([
        fetchSalesSummary(summaryFullFilters), // Apply customer type filter for summary
        fetchCustomerSalesReport(filtersWithoutCustomerType), // NO customer type filter
        fetchProductSalesReport(filtersWithoutCustomerType), // NO customer type filter
        fetchOutstandingPaymentsReport(), // No filters - show ALL outstanding payments
        fetchSalesTrendData(trendsFullFilters), // Apply customer type filter for trends
        fetchProductSalesTrendData(trendsFullFilters), // Apply product tag filter for trends
        fetchTopSellingProducts(5, filtersWithoutCustomerType), // NO customer type filter
        fetchLowestSellingProducts(5, filtersWithoutCustomerType), // NO customer type filter
        fetchTopPayingCustomers(5, filtersWithoutCustomerType), // NO customer type filter
        fetchHighestOutstandingCustomers(5, filtersWithoutCustomerType), // NO customer type filter
        fetchSalesDistribution(filtersWithoutCustomerType), // NO customer type filter
        fetchCustomerTypeDistribution(filtersWithoutCustomerType), // NO customer type filter
      ]);

      setSummary(summaryData);
      setCustomerSales(customerData);
      setProductSales(productData);
      setOutstandingPayments(outstandingData);
      setSalesTrend(trendData);
      setProductSalesTrend(productTrendData);
      setTopProducts(topProductsData);
      setLowestProducts(lowestProductsData);
      setTopCustomers(topCustomersData);
      setHighestOutstanding(outstandingCustomersData);
      setDistribution(distributionData);
      setCustomerTypeDistribution(customerTypeDistData);
      setDistribution(distributionData);
    } catch (err) {
      console.error('Failed to load sales analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Chart colors
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading sales analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Sales Analytics</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">Decision-grade sales intelligence and insights</p>
        </div>

        {/* Month Navigation with All Time option - Hidden for Sales Trends tab */}
        {activeTab !== 'trends' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
            <div className="flex items-center justify-between gap-1 sm:gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2 w-full sm:w-auto shadow-sm">
              <div className="flex items-center gap-1 sm:gap-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 hidden sm:block" />
                <button
                  onClick={goToPreviousMonth}
                  className="p-1.5 sm:p-1 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <span className="font-semibold text-slate-800 min-w-[120px] text-center text-sm sm:text-base whitespace-nowrap">
                {selectedMonth
                  ? selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                  : 'All Time'}
              </span>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={goToNextMonth}
                  disabled={!selectedMonth || isCurrentMonth()}
                  className="p-1.5 sm:p-1 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {selectedMonth && (
                <ModernButton
                  variant="outline"
                  onClick={setToAllTime}
                  size="sm"
                >
                  All Time
                </ModernButton>
              )}
              {!selectedMonth && (
                <ModernButton
                  variant="outline"
                  onClick={setToCurrentMonth}
                  size="sm"
                >
                  Current Month
                </ModernButton>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto chart-scrollbar">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 sm:px-5 py-2.5 font-semibold rounded-lg transition-all duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${activeTab === 'summary'
            ? 'bg-indigo-50 text-indigo-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
          Overview Summary
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 sm:px-5 py-2.5 font-semibold rounded-lg transition-all duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${activeTab === 'products'
            ? 'bg-indigo-50 text-indigo-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
          Product Performance
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 sm:px-5 py-2.5 font-semibold rounded-lg transition-all duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${activeTab === 'customers'
            ? 'bg-indigo-50 text-indigo-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
          Customer Analytics
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`px-4 sm:px-5 py-2.5 font-semibold rounded-lg transition-all duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${activeTab === 'trends'
            ? 'bg-indigo-50 text-indigo-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
          Sales Trends
        </button>
      </div>

      {/* Sales Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Summary Filters */}
          <ModernCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Filters</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Customer Type
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={summaryFilters.customerType || ''}
                    onChange={(e) => setSummaryFilters({ ...summaryFilters, customerType: e.target.value || undefined })}
                    disabled={loadingTypes}
                  >
                    <option value="">All Customer Types</option>
                    {customerTypes.map((type) => (
                      <option key={type.id} value={type.type_key}>
                        {type.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <ModernButton
                    variant="outline"
                    onClick={() => setSummaryFilters({})}
                    size="sm"
                  >
                    Clear Filters
                  </ModernButton>
                </div>
              </div>
            </div>
          </ModernCard>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ModernCard className="group border-none shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white" padding="none">
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-emerald-50/50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
              <div className="p-4 sm:p-6 z-10 relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">Total Sales</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-100/80 flex items-center justify-center shadow-inner">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
                  {formatCurrency(summary?.totalSalesValue || 0)}
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-emerald-600 mt-1 sm:mt-2">
                  {summary?.totalOrdersCount || 0} completed orders
                </p>
              </div>
            </ModernCard>

            <ModernCard className="group border-none shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white" padding="none">
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-indigo-50/50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
              <div className="p-4 sm:p-6 z-10 relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">Paid Amount</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-100/80 flex items-center justify-center shadow-inner">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  </div>
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
                  {formatCurrency(summary?.paidAmount || 0)}
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-indigo-600 mt-1 sm:mt-2">
                  {summary?.fullPaymentCount || 0} fully paid orders
                </p>
              </div>
            </ModernCard>

            <ModernCard className="group border-none shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white" padding="none">
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-amber-50/50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
              <div className="p-4 sm:p-6 z-10 relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">Outstanding</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-100/80 flex items-center justify-center shadow-inner">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                  </div>
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
                  {formatCurrency(summary?.pendingAmount || 0)}
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-amber-600 mt-1 sm:mt-2">
                  {(summary?.pendingPaymentCount || 0) + (summary?.partialPaymentCount || 0)} orders pending
                </p>
              </div>
            </ModernCard>

            <ModernCard className="group border-none shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden bg-white" padding="none">
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-blue-50/50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
              <div className="p-4 sm:p-6 z-10 relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">Total Quantity</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-100/80 flex items-center justify-center shadow-inner">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
                  {summary?.totalOrderedQuantity.toFixed(0) || 0}
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-blue-600 mt-1 sm:mt-2">
                  Total units ordered
                </p>
              </div>
            </ModernCard>
          </div>

          {/* Outstanding Payments */}
          <ModernCard>
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Outstanding Payments</h3>
              <div className="overflow-x-auto chart-scrollbar">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-tl-lg">Customer</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Date</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Value</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Received</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-tr-lg">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {outstandingPayments
                      .slice(0, 10)
                      .map((payment) => (
                        <tr key={payment.orderId} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-4 px-5 text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{payment.customerName}</td>
                          <td className="py-4 px-5 text-sm font-medium text-slate-500">{payment.orderNumber}</td>
                          <td className="py-4 px-5 text-sm font-medium text-slate-500">{formatDate(payment.orderDate)}</td>
                          <td className="py-4 px-5 text-sm text-right font-semibold text-slate-900">
                            {formatCurrency(payment.orderedItemValue)}
                          </td>
                          <td className="py-4 px-5 text-sm text-right text-emerald-600 font-bold">
                            {formatCurrency(payment.amountReceived)}
                          </td>
                          <td className="py-4 px-5 text-sm text-right font-extrabold text-amber-600">
                            {formatCurrency(payment.balancePending)}
                          </td>
                          <td className="py-4 px-5 text-sm text-right flex justify-end">
                            <span className={`inline-flex min-w-[3rem] justify-center items-center px-2 py-1 rounded-md text-xs font-bold ${payment.daysOutstanding > 60
                              ? 'bg-red-50 text-red-600 border border-red-100/50'
                              : payment.daysOutstanding > 30
                                ? 'bg-amber-50 text-amber-600 border border-amber-100/50'
                                : 'bg-blue-50 text-blue-600 border border-blue-100/50'
                              }`}>
                              {payment.daysOutstanding}d
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {outstandingPayments.length === 0 && (
                  <div className="text-center py-12 bg-white">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <DollarSign className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No outstanding payments</p>
                  </div>
                )}
              </div>
            </div>
          </ModernCard>
        </div>
      )}

      {/* Product Performance Tab */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Top Selling Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 5 Selling Products</h3>
                <div className="space-y-3">
                  {topProducts.map((product) => (
                    <div key={product.tagId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-50/80 rounded-xl border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-sm transition-all group gap-2 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto overflow-hidden">
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm shadow-inner group-hover:scale-110 transition-transform">
                          {product.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{product.tagName}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                            {product.quantitySold.toFixed(2)} {product.unit} sold
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right pl-11 sm:pl-0">
                        <p className="font-extrabold text-slate-900 text-base sm:text-lg">{formatCurrency(product.salesValue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Products - Sales Chart</h3>
                <div className="overflow-x-auto chart-scrollbar pb-4">
                  <div className="min-w-[700px]">
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={topProducts} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="tagName" height={100} interval={0} tick={<CustomXAxisTick />} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="salesValue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ModernCard>
          </div>

          {/* Lowest Selling Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Lowest 5 Selling Products</h3>
                <div className="space-y-3">
                  {lowestProducts.map((product) => (
                    <div key={product.tagId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-50/80 rounded-xl border border-transparent hover:border-amber-100 hover:bg-white hover:shadow-sm transition-all group gap-2 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto overflow-hidden">
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 text-amber-700 font-bold text-xs sm:text-sm shadow-inner group-hover:scale-110 transition-transform">
                          {product.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-amber-600 transition-colors truncate">{product.tagName}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                            {product.quantitySold.toFixed(2)} {product.unit} sold
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right pl-11 sm:pl-0">
                        <p className="font-extrabold text-slate-900 text-base sm:text-lg">{formatCurrency(product.salesValue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Product Sales Distribution</h3>
                <div className="w-full pb-4 flex justify-center">
                  <div className="w-full max-w-[600px] min-w-[280px]">
                    <ResponsiveContainer width="100%" height={340}>
                      <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                        <Pie
                          data={productSales.slice(0, 7) as any[]}
                          dataKey="totalSalesValue"
                          nameKey="tagName"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={CustomPieLabel}
                        >
                          {productSales.slice(0, 7).map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ModernCard>
          </div>

          {/* All Products Table */}
          <ModernCard>
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">All Products Sales Report</h3>
              <div className="overflow-x-auto chart-scrollbar">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-tl-lg">Product Tag</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity Sold</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sales Value</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-tr-lg">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {productSales.map((product) => (
                      <tr key={product.tagId} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-4 px-5 text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{product.tagName}</td>
                        <td className="py-4 px-5 text-sm text-right text-slate-500 font-medium">
                          {product.quantitySold.toFixed(2)} {product.unit}
                        </td>
                        <td className="py-4 px-5 text-sm text-right font-bold text-slate-900">
                          {formatCurrency(product.totalSalesValue)}
                        </td>
                        <td className="py-4 px-5 text-sm text-right text-slate-600 font-semibold">
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs">{product.shareOfTotalSales.toFixed(1)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ModernCard>
        </div>
      )}

      {/* Customer Performance Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Top Paying Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 5 Paying Customers</h3>
                <div className="space-y-3">
                  {topCustomers.map((customer, index) => (
                    <div key={customer.customerId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-50/80 rounded-xl border border-transparent hover:border-emerald-100 hover:bg-white hover:shadow-sm transition-all group gap-2 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto overflow-hidden">
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs sm:text-sm shadow-inner group-hover:scale-110 transition-transform">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-emerald-600 transition-colors truncate">{customer.customerName}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">{customer.customerType}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:flex-col sm:items-end w-full sm:w-auto pl-11 sm:pl-0 mt-1 sm:mt-0">
                        <p className="font-extrabold text-slate-900 text-base sm:text-lg">{formatCurrency(customer.totalPaid)}</p>
                        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 bg-slate-100 rounded-md px-2 py-0.5 sm:mt-1">{customer.ordersCount} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Customers - Revenue Chart</h3>
                <div className="overflow-x-auto chart-scrollbar pb-4">
                  <div className="min-w-[700px]">
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={topCustomers} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="customerName" height={100} interval={0} tick={<CustomXAxisTick />} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="totalPaid" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ModernCard>
          </div>

          {/* Highest Outstanding Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 5 Outstanding Customers</h3>
                <div className="space-y-3">
                  {highestOutstanding.map((customer, index) => (
                    <div key={customer.customerId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-50/80 rounded-xl border border-transparent hover:border-red-100 hover:bg-white hover:shadow-sm transition-all group gap-2 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto overflow-hidden">
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-100 text-red-700 font-bold text-xs sm:text-sm shadow-inner group-hover:scale-110 transition-transform">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-red-600 transition-colors truncate">{customer.customerName}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                            Avg delay: <span className="text-amber-600 font-bold">{customer.averageDelayDays}d</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:flex-col sm:items-end w-full sm:w-auto pl-11 sm:pl-0 mt-1 sm:mt-0">
                        <p className="font-extrabold text-red-600 text-base sm:text-lg">{formatCurrency(customer.totalOutstanding)}</p>
                        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 bg-slate-100 rounded-md px-2 py-0.5 sm:mt-1">{customer.ordersCount} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Outstanding Amount by Customer</h3>
                <div className="overflow-x-auto chart-scrollbar pb-4">
                  <div className="min-w-[700px]">
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={highestOutstanding} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="customerName" height={100} interval={0} tick={<CustomXAxisTick />} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="totalOutstanding" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ModernCard>
          </div>

          {/* Customer Type Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Sales by Customer Type</h3>
                <div className="w-full pb-4 flex justify-center">
                  <div className="w-full max-w-[600px] min-w-[280px]">
                    <ResponsiveContainer width="100%" height={340}>
                      <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                        <Pie
                          data={customerTypeDistribution as any[]}
                          dataKey="totalSales"
                          nameKey="customerType"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={CustomPieLabel}
                        >
                          {customerTypeDistribution.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Type Breakdown</h3>
                <div className="space-y-3">
                  {customerTypeDistribution.map((type, index) => (
                    <div key={type.customerType} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-50/80 rounded-xl border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-sm transition-all group gap-2 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto overflow-hidden">
                        <div
                          className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 rounded-full shadow-inner ring-2 ring-white"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm sm:text-base text-slate-900 truncate">{type.customerType}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                            {type.customerCount} customers • <span className="text-slate-700">{type.orderCount} orders</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:flex-col sm:items-end w-full sm:w-auto pl-6 sm:pl-0 mt-1 sm:mt-0">
                        <p className="font-extrabold text-slate-900 text-base sm:text-lg">{formatCurrency(type.totalSales)}</p>
                        <p className="text-[11px] sm:text-xs font-bold text-slate-600 bg-slate-100 rounded-md px-2 py-0.5 sm:mt-1">{type.sharePercentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>
          </div>

          {/* Sales Concentration */}
          {distribution && (
            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Sales Concentration Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Customer Concentration</h4>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <div className="bg-emerald-50/50 p-2 sm:p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center hover:bg-emerald-50 transition-colors">
                        <span className="text-[11px] sm:text-sm font-medium text-emerald-600 mb-1">Top 1 Customer</span>
                        <span className="text-lg sm:text-2xl font-black text-emerald-700">
                          {distribution.top1CustomerShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-emerald-50/50 p-2 sm:p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center hover:bg-emerald-50 transition-colors">
                        <span className="text-[11px] sm:text-sm font-medium text-emerald-600 mb-1">Top 3 Customers</span>
                        <span className="text-lg sm:text-2xl font-black text-emerald-700">
                          {distribution.top3CustomersShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-emerald-50/50 p-2 sm:p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center hover:bg-emerald-50 transition-colors">
                        <span className="text-[11px] sm:text-sm font-medium text-emerald-600 mb-1">Top 5 Customers</span>
                        <span className="text-lg sm:text-2xl font-black text-emerald-700">
                          {distribution.top5CustomersShare.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Product Concentration</h4>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="bg-indigo-50/50 p-3 sm:p-4 rounded-xl border border-indigo-100 flex flex-col items-center justify-center text-center hover:bg-indigo-50 transition-colors">
                        <span className="text-[11px] sm:text-sm font-medium text-indigo-600 mb-1">Top 1 Product</span>
                        <span className="text-xl sm:text-2xl font-black text-indigo-700">
                          {distribution.top1ProductShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-indigo-50/50 p-3 sm:p-4 rounded-xl border border-indigo-100 flex flex-col items-center justify-center text-center hover:bg-indigo-50 transition-colors">
                        <span className="text-[11px] sm:text-sm font-medium text-indigo-600 mb-1">Top 3 Products</span>
                        <span className="text-xl sm:text-2xl font-black text-indigo-700">
                          {distribution.top3ProductsShare.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ModernCard>
          )}

          {/* All Customers Table */}
          <ModernCard>
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">All Customers Sales Report</h3>
              <div className="overflow-x-auto chart-scrollbar">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-tl-lg">Customer</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Value</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding</th>
                      <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-tr-lg">Last Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {customerSales.map((customer) => (
                      <tr key={customer.customerId} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-4 px-5 text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{customer.customerName}</td>
                        <td className="py-4 px-5 text-sm font-medium text-slate-500">
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs">{customer.customerType}</span>
                        </td>
                        <td className="py-4 px-5 text-sm text-right font-medium text-slate-500">{customer.totalOrders}</td>
                        <td className="py-4 px-5 text-sm text-right font-bold text-slate-900">
                          {formatCurrency(customer.totalOrderedValue)}
                        </td>
                        <td className="py-4 px-5 text-sm text-right">
                          <span className={`${customer.outstandingAmount > 0 ? 'text-amber-600 font-extrabold' : 'text-slate-400 font-medium'}`}>
                            {formatCurrency(customer.outstandingAmount)}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-right text-slate-500 font-medium">
                          {customer.lastOrderDate ? formatDate(customer.lastOrderDate) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ModernCard>
        </div>
      )}

      {/* Sales Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Trends Filters */}
          <ModernCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Filters</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="w-4 h-4" />
                  <span>Filter by customer type and/or product to see specific trends</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Customer Type
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={trendsFilters.customerType || ''}
                    onChange={(e) => setTrendsFilters({ ...trendsFilters, customerType: e.target.value || undefined })}
                    disabled={loadingTypes}
                  >
                    <option value="">All Customer Types</option>
                    {customerTypes.map((type) => (
                      <option key={type.id} value={type.type_key}>
                        {type.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Tag
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={trendsFilters.productTag || ''}
                    onChange={(e) => setTrendsFilters({ ...trendsFilters, productTag: e.target.value || undefined })}
                    disabled={loadingTags}
                  >
                    <option value="">All Products</option>
                    {productTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <ModernButton
                    variant="outline"
                    onClick={() => setTrendsFilters({})}
                    size="sm"
                  >
                    Clear Filters
                  </ModernButton>
                </div>
              </div>
            </div>
          </ModernCard>

          {/* Conditional Rendering: Product Sales Trend OR Month-on-Month Sales Trend */}
          {trendsFilters.productTag && productSalesTrend.length > 0 ? (
            // Show Product Sales Trend when product filter is applied
            <ModernCard>
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Product Sales & Quantity Trend</h3>
                  <div className="flex items-center gap-2 text-sm">
                    {trendsFilters.customerType && (
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                        {customerTypes.find(t => t.type_key === trendsFilters.customerType)?.display_name || trendsFilters.customerType}
                      </span>
                    )}
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                      {productTags.find(t => t.id === trendsFilters.productTag)?.display_name || 'Product'}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto chart-scrollbar pb-4">
                  <div className="min-w-[700px]">
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={productSalesTrend} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" height={60} interval={0} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} tickFormatter={(value) => { if (!value) return ''; const date = new Date(value + '-01'); return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={10} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value, name) => {
                            if (name === 'Sales Value') return formatCurrency(Number(value));
                            if (name === 'Quantity Sold') return Number(value).toFixed(2);
                            return value;
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="salesValue"
                          stroke="#8b5cf6"
                          strokeWidth={4}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          name="Sales Value"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="quantitySold"
                          stroke="#f59e0b"
                          strokeWidth={4}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          name="Quantity Sold"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ModernCard>
          ) : (
            // Show Month-on-Month Sales Trend when no product filter
            <>
              <ModernCard>
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Month-on-Month Sales Trend</h3>
                    {trendsFilters.customerType && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                          {customerTypes.find(t => t.type_key === trendsFilters.customerType)?.display_name || trendsFilters.customerType}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto chart-scrollbar pb-4">
                    <div className="min-w-[700px]">
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={salesTrend} margin={{ bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="month" height={60} interval={0} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} tickFormatter={(value) => { if (!value) return ''; const date = new Date(value + '-01'); return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={10} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value, name) => {
                              if (name === 'Sales Value') return formatCurrency(Number(value));
                              return value;
                            }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="salesValue"
                            stroke="#6366f1"
                            strokeWidth={4}
                            dot={{ r: 4, strokeWidth: 2 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            name="Sales Value"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="ordersCount"
                            stroke="#10b981"
                            strokeWidth={4}
                            dot={{ r: 4, strokeWidth: 2 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            name="Orders Count"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </ModernCard>

              {/* Orders Count by Month */}
              <ModernCard>
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Orders Count per Month</h3>
                  <div className="overflow-x-auto chart-scrollbar pb-4">
                    <div className="min-w-[700px]">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={salesTrend} margin={{ bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="month" height={60} interval={0} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} tickFormatter={(value) => { if (!value) return ''; const date = new Date(value + '-01'); return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="ordersCount" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Orders" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </ModernCard>
            </>
          )}

          {/* Trend Insights */}
          <ModernCard>
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Trend Insights</h3>
              {trendsFilters.productTag && productSalesTrend.length >= 2 ? (
                // Product-specific insights
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">
                      Latest Month ({new Date(productSalesTrend[productSalesTrend.length - 1]?.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
                      {formatCurrency(productSalesTrend[productSalesTrend.length - 1]?.salesValue || 0)}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                      {productSalesTrend[productSalesTrend.length - 1]?.quantitySold.toFixed(2) || 0} units
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">
                      Previous Month ({new Date(productSalesTrend[productSalesTrend.length - 2]?.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
                      {formatCurrency(productSalesTrend[productSalesTrend.length - 2]?.salesValue || 0)}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                      {productSalesTrend[productSalesTrend.length - 2]?.quantitySold.toFixed(2) || 0} units
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs sm:text-sm font-medium text-slate-500">Growth</p>
                      <div className="relative group">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                            <p className="font-semibold mb-1">Growth Formula:</p>
                            <p>((Latest Month - Previous) / Previous) × 100</p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className={`text-lg sm:text-2xl font-bold truncate ${((productSalesTrend[productSalesTrend.length - 1]?.salesValue || 0) -
                      (productSalesTrend[productSalesTrend.length - 2]?.salesValue || 0)) >= 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                      }`}>
                      {productSalesTrend[productSalesTrend.length - 2]?.salesValue > 0
                        ? `${(((productSalesTrend[productSalesTrend.length - 1]?.salesValue || 0) -
                          (productSalesTrend[productSalesTrend.length - 2]?.salesValue || 0)) /
                          (productSalesTrend[productSalesTrend.length - 2]?.salesValue || 1) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">Month-on-month</p>
                  </div>
                </div>
              ) : salesTrend.length >= 2 ? (
                // Overall sales insights
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">
                      Latest Month ({new Date(salesTrend[salesTrend.length - 1]?.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
                      {formatCurrency(salesTrend[salesTrend.length - 1]?.salesValue || 0)}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                      {salesTrend[salesTrend.length - 1]?.ordersCount || 0} orders
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">
                      Previous Month ({new Date(salesTrend[salesTrend.length - 2]?.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
                      {formatCurrency(salesTrend[salesTrend.length - 2]?.salesValue || 0)}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                      {salesTrend[salesTrend.length - 2]?.ordersCount || 0} orders
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs sm:text-sm font-medium text-slate-500">Growth</p>
                      <div className="relative group">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                            <p className="font-semibold mb-1">Growth Formula:</p>
                            <p>((Latest Month - Previous) / Previous) × 100</p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className={`text-lg sm:text-2xl font-bold truncate ${((salesTrend[salesTrend.length - 1]?.salesValue || 0) -
                      (salesTrend[salesTrend.length - 2]?.salesValue || 0)) >= 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                      }`}>
                      {salesTrend[salesTrend.length - 2]?.salesValue > 0
                        ? `${(((salesTrend[salesTrend.length - 1]?.salesValue || 0) -
                          (salesTrend[salesTrend.length - 2]?.salesValue || 0)) /
                          (salesTrend[salesTrend.length - 2]?.salesValue || 1) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">Month-on-month</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Not enough data to show trend insights. Need at least 2 months of data.
                </div>
              )}
            </div>
          </ModernCard>
        </div>
      )}
    </div>
  );
}
