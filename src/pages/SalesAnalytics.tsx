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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sales Analytics</h1>
          <p className="text-slate-600 mt-1">Decision-grade sales intelligence and insights</p>
        </div>

        {/* Month Navigation with All Time option - Hidden for Sales Trends tab */}
        {activeTab !== 'trends' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-4 py-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              <button
                onClick={goToPreviousMonth}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-slate-900 min-w-[120px] text-center">
                {selectedMonth 
                  ? selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                  : 'All Time'}
              </span>
              <button
                onClick={goToNextMonth}
                disabled={!selectedMonth || isCurrentMonth()}
                className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
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
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'summary'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sales Summary
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'products'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Product Performance
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'customers'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Customer Performance
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'trends'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
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
            <ModernCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Total Sales</span>
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(summary?.totalSalesValue || 0)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {summary?.totalOrdersCount || 0} completed orders
                </p>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Paid Amount</span>
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(summary?.paidAmount || 0)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {summary?.fullPaymentCount || 0} fully paid orders
                </p>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Outstanding</span>
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(summary?.pendingAmount || 0)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {(summary?.pendingPaymentCount || 0) + (summary?.partialPaymentCount || 0)} orders pending
                </p>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Total Quantity</span>
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {summary?.totalOrderedQuantity.toFixed(0) || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Units ordered
                </p>
              </div>
            </ModernCard>
          </div>

          {/* Outstanding Payments */}
          <ModernCard>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Outstanding Payments</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Order</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Order Date</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Order Value</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Received</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Balance</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingPayments
                      .slice(0, 10)
                      .map((payment) => (
                        <tr key={payment.orderId} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 text-sm text-slate-900">{payment.customerName}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{payment.orderNumber}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{formatDate(payment.orderDate)}</td>
                          <td className="py-3 px-4 text-sm text-right text-slate-900">
                            {formatCurrency(payment.orderedItemValue)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-emerald-600">
                            {formatCurrency(payment.amountReceived)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-semibold text-amber-600">
                            {formatCurrency(payment.balancePending)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              payment.daysOutstanding > 60 
                                ? 'bg-red-100 text-red-700'
                                : payment.daysOutstanding > 30
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {payment.daysOutstanding}d
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {outstandingPayments.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No outstanding payments
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
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 5 Selling Products</h3>
                <div className="space-y-3">
                  {topProducts.map((product) => (
                    <div key={product.tagId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                          {product.rank}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">{product.tagName}</p>
                          <p className="text-sm text-slate-600">
                            {product.quantitySold.toFixed(2)} {product.unit}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(product.salesValue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Products - Sales Chart</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tagName" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="salesValue" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ModernCard>
          </div>

          {/* Lowest Selling Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Lowest 5 Selling Products</h3>
                <div className="space-y-3">
                  {lowestProducts.map((product) => (
                    <div key={product.tagId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm">
                          {product.rank}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">{product.tagName}</p>
                          <p className="text-sm text-slate-600">
                            {product.quantitySold.toFixed(2)} {product.unit}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(product.salesValue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Product Sales Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={productSales.slice(0, 7)}
                      dataKey="totalSalesValue"
                      nameKey="tagName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.tagName}: ${entry.shareOfTotalSales.toFixed(1)}%`}
                    >
                      {productSales.slice(0, 7).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ModernCard>
          </div>

          {/* All Products Table */}
          <ModernCard>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">All Products Sales Report</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Product Tag</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Quantity Sold</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Sales Value</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSales.map((product) => (
                      <tr key={product.tagId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-900">{product.tagName}</td>
                        <td className="py-3 px-4 text-sm text-right text-slate-900">
                          {product.quantitySold.toFixed(2)} {product.unit}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-slate-900">
                          {formatCurrency(product.totalSalesValue)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-600">
                          {product.shareOfTotalSales.toFixed(1)}%
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
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 5 Paying Customers</h3>
                <div className="space-y-3">
                  {topCustomers.map((customer, index) => (
                    <div key={customer.customerId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">{customer.customerName}</p>
                          <p className="text-sm text-slate-600">{customer.customerType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(customer.totalPaid)}</p>
                        <p className="text-xs text-slate-600">{customer.ordersCount} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Customers - Revenue Chart</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topCustomers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="customerName" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="totalPaid" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ModernCard>
          </div>

          {/* Highest Outstanding Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 5 Outstanding Customers</h3>
                <div className="space-y-3">
                  {highestOutstanding.map((customer, index) => (
                    <div key={customer.customerId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">{customer.customerName}</p>
                          <p className="text-sm text-slate-600">
                            Avg delay: {customer.averageDelayDays} days
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600">{formatCurrency(customer.totalOutstanding)}</p>
                        <p className="text-xs text-slate-600">{customer.ordersCount} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Outstanding Amount by Customer</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={highestOutstanding}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="customerName" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="totalOutstanding" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ModernCard>
          </div>

          {/* Customer Type Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Sales by Customer Type</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={customerTypeDistribution}
                      dataKey="totalSales"
                      nameKey="customerType"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.customerType}: ${entry.sharePercentage.toFixed(1)}%`}
                    >
                      {customerTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Type Breakdown</h3>
                <div className="space-y-3">
                  {customerTypeDistribution.map((type, index) => (
                    <div key={type.customerType} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium text-slate-900">{type.customerType}</p>
                          <p className="text-sm text-slate-600">
                            {type.customerCount} customers • {type.orderCount} orders
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(type.totalSales)}</p>
                        <p className="text-xs text-slate-600">{type.sharePercentage.toFixed(1)}%</p>
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
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Sales Concentration Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-slate-700 mb-3">Customer Concentration</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Top 1 Customer</span>
                        <span className="font-semibold text-slate-900">
                          {distribution.top1CustomerShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Top 3 Customers</span>
                        <span className="font-semibold text-slate-900">
                          {distribution.top3CustomersShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Top 5 Customers</span>
                        <span className="font-semibold text-slate-900">
                          {distribution.top5CustomersShare.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-700 mb-3">Product Concentration</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Top 1 Product</span>
                        <span className="font-semibold text-slate-900">
                          {distribution.top1ProductShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Top 3 Products</span>
                        <span className="font-semibold text-slate-900">
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
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">All Customers Sales Report</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Type</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Orders</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Total Value</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Outstanding</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Last Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerSales.map((customer) => (
                      <tr key={customer.customerId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-900">{customer.customerName}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{customer.customerType}</td>
                        <td className="py-3 px-4 text-sm text-right text-slate-900">{customer.totalOrders}</td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-slate-900">
                          {formatCurrency(customer.totalOrderedValue)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className={customer.outstandingAmount > 0 ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                            {formatCurrency(customer.outstandingAmount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
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
              <div className="p-6">
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
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={productSalesTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'Sales Value') return formatCurrency(Number(value));
                        if (name === 'Quantity Sold') return Number(value).toFixed(2);
                        return value;
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="salesValue" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      name="Sales Value"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="quantitySold" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      name="Quantity Sold"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ModernCard>
          ) : (
            // Show Month-on-Month Sales Trend when no product filter
            <>
              <ModernCard>
                <div className="p-6">
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
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'Sales Value') return formatCurrency(Number(value));
                          return value;
                        }}
                      />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="salesValue" 
                        stroke="#6366f1" 
                        strokeWidth={2}
                        name="Sales Value"
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="ordersCount" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Orders Count"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ModernCard>

              {/* Orders Count by Month */}
              <ModernCard>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Orders Count per Month</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="ordersCount" fill="#10b981" name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ModernCard>
            </>
          )}

          {/* Trend Insights */}
          <ModernCard>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Trend Insights</h3>
              {trendsFilters.productTag && productSalesTrend.length >= 2 ? (
                // Product-specific insights
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">
                      Latest Month ({new Date(productSalesTrend[productSalesTrend.length - 1]?.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(productSalesTrend[productSalesTrend.length - 1]?.salesValue || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {productSalesTrend[productSalesTrend.length - 1]?.quantitySold.toFixed(2) || 0} units sold
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">
                      Previous Month ({new Date(productSalesTrend[productSalesTrend.length - 2]?.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(productSalesTrend[productSalesTrend.length - 2]?.salesValue || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {productSalesTrend[productSalesTrend.length - 2]?.quantitySold.toFixed(2) || 0} units sold
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-slate-600">Growth</p>
                      <div className="relative group">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                            <p className="font-semibold mb-1">Growth Formula:</p>
                            <p>((Latest Month Sales - Previous Month Sales) / Previous Month Sales) × 100</p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      ((productSalesTrend[productSalesTrend.length - 1]?.salesValue || 0) - 
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
                    <p className="text-xs text-slate-500 mt-1">Month-on-month</p>
                  </div>
                </div>
              ) : salesTrend.length >= 2 ? (
                // Overall sales insights
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">
                      Latest Month ({new Date(salesTrend[salesTrend.length - 1]?.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(salesTrend[salesTrend.length - 1]?.salesValue || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {salesTrend[salesTrend.length - 1]?.ordersCount || 0} orders
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">
                      Previous Month ({new Date(salesTrend[salesTrend.length - 2]?.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(salesTrend[salesTrend.length - 2]?.salesValue || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {salesTrend[salesTrend.length - 2]?.ordersCount || 0} orders
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-slate-600">Growth</p>
                      <div className="relative group">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                            <p className="font-semibold mb-1">Growth Formula:</p>
                            <p>((Latest Month Sales - Previous Month Sales) / Previous Month Sales) × 100</p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      ((salesTrend[salesTrend.length - 1]?.salesValue || 0) - 
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
                    <p className="text-xs text-slate-500 mt-1">Month-on-month</p>
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
