import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  Package,
  DollarSign,
  Info,
  LayoutDashboard,
  LineChart as LineChartIcon,
  ChevronLeft,
  Download,
  BarChart3,
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  SalesAnalyticsFilters,
  SalesSummary,
  CustomerSalesReport,
  ProductSalesReport,
  OutstandingPaymentReport,
  SalesTrendData,
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
import { pdf } from '@react-pdf/renderer';
import { SalesReportPDF } from '../components/SalesReportPDF';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { DateRangePicker, type DateRange } from '../components/ui/DateRangePicker';

// ----- Default date range (this month) -----
function getDefaultDateRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { startDate: fmt(start), endDate: fmt(end) };
}

function toFilters(range: DateRange): SalesAnalyticsFilters {
  return {
    startDate: range.startDate || undefined,
    endDate: range.endDate || undefined,
  };
}
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

type SalesTab = 'summary' | 'products' | 'customers' | 'trends';

const TABS: { id: SalesTab; label: string; icon: React.ElementType }[] = [
  { id: 'summary', label: 'Overview Summary', icon: LayoutDashboard },
  { id: 'products', label: 'Product Performance', icon: Package },
  { id: 'customers', label: 'Customer Analytics', icon: Users },
  { id: 'trends', label: 'Sales Trends', icon: LineChartIcon },
];

export function SalesAnalytics({ accessLevel: _accessLevel }: SalesAnalyticsProps) {
  const navigate = useNavigate();

  // State management
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SalesTab>('summary');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Date range states (independent per section)
  const [summaryDateRange, setSummaryDateRange] = useState<DateRange>(getDefaultDateRange());
  const [productsDateRange, setProductsDateRange] = useState<DateRange>(getDefaultDateRange());
  const [customersDateRange, setCustomersDateRange] = useState<DateRange>(getDefaultDateRange());

  // Section-specific filters
  const [summaryFilters, setSummaryFilters] = useState<{ customerType?: string }>({});
  const [trendsFilters, setTrendsFilters] = useState<{ customerType?: string; productTag?: string }>({});
  const [selectedTrendMonth, setSelectedTrendMonth] = useState<string>('');

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

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
  }, [summaryDateRange, productsDateRange, customersDateRange, summaryFilters, trendsFilters]);

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
      // Mapping the DateRanges for filtering
      const summaryDates = toFilters(summaryDateRange);
      const productDates = toFilters(productsDateRange);
      const customerDates = toFilters(customersDateRange);

      const summaryFullFilters = { ...summaryFilters, ...summaryDates };
      const trendsFullFilters = { ...trendsFilters }; // No date filters directly mapped here traditionally

      // Outstanding payments usually ignore temporal boundaries unless specific. Since we want
      // independent filters across modules, let's keep things as they were previously architected.

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
        fetchSalesSummary(summaryFullFilters),
        fetchCustomerSalesReport({ ...customerDates }),
        fetchProductSalesReport({ ...productDates }),
        fetchOutstandingPaymentsReport(), // Always global historically
        fetchSalesTrendData(trendsFullFilters),
        fetchProductSalesTrendData(trendsFullFilters),
        fetchTopSellingProducts(5, { ...productDates }),
        fetchLowestSellingProducts(5, { ...productDates }),
        fetchTopPayingCustomers(5, { ...customerDates }),
        fetchHighestOutstandingCustomers(5, { ...customerDates }),
        fetchSalesDistribution({ ...productDates }),
        fetchCustomerTypeDistribution({ ...customerDates }),
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

  // Generate PDF Report
  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const periodLabel = summaryDateRange.startDate && summaryDateRange.endDate
        ? `${formatDate(summaryDateRange.startDate)} - ${formatDate(summaryDateRange.endDate)}`
        : 'All Time';

      const blob = await pdf(
        <SalesReportPDF
          summary={summary!}
          customerSales={customerSales}
          productSales={productSales}
          outstandingPayments={outstandingPayments}
          salesTrend={salesTrend}
          periodLabel={periodLabel}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
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

  const isProductTrend = Boolean(trendsFilters.productTag && productSalesTrend.length > 0);
  const activeTrendData = isProductTrend ? productSalesTrend : salesTrend;
  let trendLatestIndex = Math.max(0, activeTrendData.length - 1);
  if (selectedTrendMonth) {
    const idx = activeTrendData.findIndex((d: any) => d.month === selectedTrendMonth);
    if (idx !== -1) {
      trendLatestIndex = idx;
    }
  }
  const trendLatestData = activeTrendData[trendLatestIndex] as any;
  const trendPreviousData = activeTrendData.length > 0 && trendLatestIndex > 0 ? activeTrendData[trendLatestIndex - 1] as any : undefined;

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
      {/* Decorative Header with Tabs inside */}
      <div className="relative rounded-[2rem] bg-slate-900 p-8 sm:p-10 text-white shadow-2xl overflow-hidden mb-8 border border-slate-800">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-30 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-indigo-600 blur-[100px]"></div>
          <div className="absolute top-20 -right-10 w-64 h-64 rounded-full bg-violet-600 blur-[80px]"></div>
          <div className="absolute -bottom-20 left-1/3 w-96 h-96 rounded-full bg-emerald-600 blur-[100px]"></div>
        </div>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-8 py-2">
          <div className="flex-1 max-w-2xl">
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="group flex items-center gap-2 text-slate-400 hover:text-white font-medium mb-6 transition-colors w-fit"
            >
              <div className="p-1.5 rounded-full bg-slate-800 group-hover:bg-slate-700 transition-colors border border-slate-700">
                <ChevronLeft className="w-4 h-4" />
              </div>
              <span className="text-sm tracking-wide">Back to Analytics</span>
            </button>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-slate-300">
              Sales Analytics
            </h1>
            <p className="text-slate-400 text-lg sm:text-xl font-light">
              Decision-grade sales intelligence and performance insights.
            </p>
          </div>

          <div className="bg-slate-800/80 backdrop-blur-xl rounded-[1.25rem] p-1.5 flex overflow-x-auto scrollbar-hide gap-1.5 border border-slate-700/80 w-full xl:w-auto shadow-inner mt-6 xl:mt-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap ${activeTab === id
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 border border-transparent'
                  }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${activeTab === id ? 'text-indigo-100' : 'text-slate-500'}`} />
                {label}
              </button>
            ))}
          </div>
        </div>
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
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date Range
                  </label>
                  <DateRangePicker
                    value={summaryDateRange}
                    onChange={setSummaryDateRange}
                  />
                </div>
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Customer Type
                  </label>
                  <select
                    className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
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
                <div className="w-full md:w-auto flex items-end gap-2">
                  <ModernButton
                    variant="outline"
                    onClick={() => setSummaryFilters({})}
                    className="min-h-[42px] w-full md:w-auto px-6 font-semibold rounded-xl"
                  >
                    Clear Filters
                  </ModernButton>
                  <button
                    type="button"
                    onClick={handleGeneratePDF}
                    disabled={isGeneratingPDF}
                    className="flex w-full md:w-auto items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Export Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </ModernCard>

          {/* No Data Notice */}
          {summary && summary.totalOrdersCount === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">No sales data for this period</p>
                <p className="text-sm text-amber-700 mt-1">
                  There are no completed orders for the selected date range. Try selecting a different period or check back later.
                </p>
              </div>
            </div>
          )}

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
          {/* Products Filters */}
          <ModernCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Filters</h3>
              </div>
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date Range
                  </label>
                  <DateRangePicker
                    value={productsDateRange}
                    onChange={setProductsDateRange}
                  />
                </div>
              </div>
            </div>
          </ModernCard>

          {/* Top Selling Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 5 Selling Products</h3>
                {topProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">No product sales data</p>
                    <p className="text-sm text-slate-400 mt-1">No sales found for the selected period</p>
                  </div>
                ) : (
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
                )}
              </div>
            </ModernCard>

            <ModernCard>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Products - Sales Chart</h3>
                {topProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center" style={{ height: 380 }}>
                    <BarChart3 className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">No chart data available</p>
                    <p className="text-sm text-slate-400 mt-1">Sales data will appear here when available</p>
                  </div>
                ) : (
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
                )}
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
          {/* Customers Filters */}
          <ModernCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Filters</h3>
              </div>
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date Range
                  </label>
                  <DateRangePicker
                    value={customersDateRange}
                    onChange={setCustomersDateRange}
                  />
                </div>
              </div>
            </div>
          </ModernCard>

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
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Customer Type
                  </label>
                  <select
                    className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
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
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Tag
                  </label>
                  <select
                    className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
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
                <div className="w-full md:w-auto flex items-end">
                  <ModernButton
                    variant="outline"
                    onClick={() => setTrendsFilters({})}
                    className="min-h-[42px] w-full md:w-auto px-6 font-semibold rounded-xl"
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Trend Insights</h3>
                {activeTrendData.length > 0 && (
                  <select
                    value={selectedTrendMonth || activeTrendData[activeTrendData.length - 1].month}
                    onChange={(e) => setSelectedTrendMonth(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white min-w-[150px]"
                  >
                    {[...activeTrendData].reverse().map(d => (
                      <option key={d.month} value={d.month}>
                        {new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {trendLatestData && trendPreviousData ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">
                      Selected Month ({new Date(trendLatestData.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
                      {formatCurrency(trendLatestData.salesValue || 0)}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                      {isProductTrend ? `${trendLatestData.quantitySold.toFixed(2)} units` : `${trendLatestData.ordersCount} orders`}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">
                      Previous Month ({new Date(trendPreviousData.month + '-01').toLocaleDateString('en-US', { month: 'short' })})
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
                      {formatCurrency(trendPreviousData.salesValue || 0)}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                      {isProductTrend ? `${trendPreviousData.quantitySold.toFixed(2)} units` : `${trendPreviousData.ordersCount} orders`}
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
                            <p>((Selected - Previous) / Previous) × 100</p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className={`text-lg sm:text-2xl font-bold truncate ${(trendLatestData.salesValue - trendPreviousData.salesValue) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {trendPreviousData.salesValue > 0
                        ? `${(((trendLatestData.salesValue - trendPreviousData.salesValue) / trendPreviousData.salesValue) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">Month-on-month</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Not enough data to show trend insights for the selected period. Need at least 2 consecutive months of data.
                </div>
              )}
            </div>
          </ModernCard>
        </div>
      )}
    </div>
  );
}
