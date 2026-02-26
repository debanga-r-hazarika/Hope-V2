import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronDown,
  DollarSign,
  TrendingUp,
  FileText,
  BarChart3,
  Info,
  Calendar,
  Filter,
  Users,
  LayoutDashboard,
  ClipboardList,
  LineChart as LineChartIcon,
  Target,
  Activity,
  Percent,
  Layers,
  Zap,
  Wallet,
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  FinanceAnalyticsFilters,
  IncomeSummaryReport,
  ExpenseSummaryReport,
  CashFlowReport,
  OutstandingReceivable,
  CashFlowTrendData,
  ExpenseBehaviorData,
  ReceivablesAnalyticsData,
  FinanceMetrics,
} from '../types/finance-analytics';
import {
  fetchIncomeSources,
  fetchIncomeSummaryReport,
  fetchExpenseSummaryReport,
  fetchCashFlowReport,
  fetchOutstandingReceivablesReport,
  fetchCashFlowTrendData,
  fetchExpenseBehaviorData,
  fetchReceivablesAnalyticsData,
  fetchFinanceMetrics,
} from '../lib/finance-analytics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
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

function toFilters(range: DateRange): FinanceAnalyticsFilters {
  return {
    startDate: range.startDate || undefined,
    endDate: range.endDate || undefined,
  };
}

// ----- KPI definitions for ⓘ (plain English, educational) -----
const KPI_DEFINITIONS: Record<
  keyof FinanceMetrics,
  { title: string; meaning: string; importance: string; calculation: string }
> = {
  revenueGrowthRate: {
    title: 'Revenue Growth Rate',
    meaning: 'This shows how fast your revenue is increasing or decreasing compared to the previous period.',
    importance: 'It helps you see if the business is growing, stable, or shrinking so you can plan ahead.',
    calculation: '(Current period revenue - previous period revenue) ÷ previous period revenue × 100.',
  },
  netCashFlow: {
    title: 'Net Cash Flow',
    meaning: 'This is the net amount of cash gained or lost in the selected period (money in minus money out).',
    importance: 'Positive cash flow means you have more coming in than going out; negative means the opposite. It is a key sign of short-term financial health.',
    calculation: 'Total income - total expenses.',
  },
  operationalMargin: {
    title: 'Operational Margin',
    meaning: 'It shows how much of each rupee of revenue is left after covering operational costs (e.g. salaries, rent, admin).',
    importance: 'A higher margin means the business runs efficiently; a low or negative one suggests operational costs are too high relative to revenue.',
    calculation: '(Revenue - operational expenses) ÷ revenue × 100.',
  },
  grossMargin: {
    title: 'Gross Margin (Simplified)',
    meaning: 'This is the profit left after deducting direct production costs (e.g. raw materials) from revenue.',
    importance: 'It indicates whether your product pricing and direct costs are in a healthy range before other expenses.',
    calculation: '(Revenue - direct production costs) ÷ revenue × 100.',
  },
  roi: {
    title: 'Return on Investment (ROI)',
    meaning: 'It measures how much profit the business generates compared to the total capital invested (e.g. contributions).',
    importance: 'It answers whether the money put into the business is earning a good return.',
    calculation: 'Net profit ÷ total invested capital × 100.',
  },
  expenseToRevenueRatio: {
    title: 'Expense-to-Revenue Ratio',
    meaning: 'This is the proportion of revenue that is spent on expenses. A value of 0.8 means 80% of revenue goes to expenses.',
    importance: 'Lower is better: it shows how much room you have for profit and savings.',
    calculation: 'Total expenses ÷ total revenue.',
  },
  customerConcentrationRatio: {
    title: 'Customer Concentration Ratio',
    meaning: 'It shows how much of your revenue comes from your top few customers (e.g. top 3).',
    importance: 'High concentration means losing one big customer could hurt a lot; diversification reduces this risk.',
    calculation: 'Revenue from top customers ÷ total revenue (often expressed as a percentage).',
  },
  receivablesRatio: {
    title: 'Receivables Ratio',
    meaning: 'This is the share of sales revenue that has not yet been collected from customers.',
    importance: 'A high ratio means more cash is stuck with customers, which can create cash flow pressure.',
    calculation: 'Outstanding receivables ÷ total sales.',
  },
  averageCollectionPeriod: {
    title: 'Average Collection Period',
    meaning: 'It is the average number of days between when an order is placed and when payment is received.',
    importance: 'Shorter is better: it shows how quickly you convert sales into actual cash.',
    calculation: 'Average number of days between order date and payment date (using all payments in the system).',
  },
  inventoryTurnoverRatio: {
    title: 'Inventory Turnover Ratio',
    meaning: 'It indicates how many times your inventory value is “used up” or sold in a period (based on cost of goods sold).',
    importance: 'Higher turnover usually means inventory is moving well; very low turnover may mean overstock or slow-moving items.',
    calculation: 'Cost of goods sold ÷ average inventory value.',
  },
};

// ----- Metric info modal (ⓘ) -----
function MetricInfoModal({
  metricKey,
  onClose,
}: {
  metricKey: keyof FinanceMetrics | null;
  onClose: () => void;
}) {
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (metricKey) {
      setIsRendered(true);
      // Small delay to allow element to exist before animating opacity/transform
      const t = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300); // match transition duration
      return () => clearTimeout(timer);
    }
  }, [metricKey]);

  if (!isRendered) return null;

  const def = metricKey ? KPI_DEFINITIONS[metricKey] : null;
  if (!def) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 sm:p-6 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/50 transform transition-all duration-300 ease-out flex flex-col max-h-full ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
      >
        {/* Decorative header blur */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-indigo-50 via-purple-50 to-emerald-50 opacity-80 pointer-events-none" />

        <div className="relative p-6 sm:p-8 overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 shadow-inner">
                <Info className="w-7 h-7" strokeWidth={2} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{def.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors bg-white/50 backdrop-blur-sm focus:outline-none"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 sm:space-y-5 text-base">
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100/50">
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" /> What it means
              </h4>
              <p className="text-slate-700 leading-relaxed text-sm sm:text-base">{def.meaning}</p>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
              <h4 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Why it matters
              </h4>
              <p className="text-slate-700 leading-relaxed text-sm sm:text-base">{def.importance}</p>
            </div>

            <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50">
              <h4 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" /> How we calculate it
              </h4>
              <p className="text-slate-700 font-medium font-mono text-[13px] sm:text-sm leading-relaxed">{def.calculation}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50/80 px-6 py-4 sm:px-8 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Format currency -----
const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

interface FinanceAnalyticsProps {
  accessLevel: AccessLevel;
}

type FinanceTab = 'metrics' | 'reports' | 'analytics';

const TABS: { id: FinanceTab; label: string; icon: React.ElementType }[] = [
  { id: 'metrics', label: 'Finance decision metrics', icon: LayoutDashboard },
  { id: 'reports', label: 'Finance reports', icon: ClipboardList },
  { id: 'analytics', label: 'Finance analytics', icon: LineChartIcon },
];

export function FinanceAnalytics({ accessLevel: _accessLevel }: FinanceAnalyticsProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FinanceTab>('metrics');
  const [showIncomeSources, setShowIncomeSources] = useState(false);

  // KPI period (used for metrics and as default for reports/charts)
  const [kpiDateRange, setKpiDateRange] = useState<DateRange>(getDefaultDateRange);
  const [metricInfoKey, setMetricInfoKey] = useState<keyof FinanceMetrics | null>(null);

  // Report-specific filters
  const [expenseFilters, setExpenseFilters] = useState<FinanceAnalyticsFilters & { expenseCategory?: string }>({});

  const [incomeDateRange, setIncomeDateRange] = useState<DateRange>(getDefaultDateRange());
  const [expenseDateRange, setExpenseDateRange] = useState<DateRange>(getDefaultDateRange());
  const [receivablesDateRange, setReceivablesDateRange] = useState<DateRange>(getDefaultDateRange());

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null);
  const [incomeReport, setIncomeReport] = useState<IncomeSummaryReport | null>(null);
  const [expenseReport, setExpenseReport] = useState<ExpenseSummaryReport | null>(null);
  const [cashFlowReport, setCashFlowReport] = useState<CashFlowReport | null>(null);
  const [receivables, setReceivables] = useState<OutstandingReceivable[]>([]);
  const [cashFlowTrend, setCashFlowTrend] = useState<CashFlowTrendData[]>([]);
  const [expenseBehavior, setExpenseBehavior] = useState<ExpenseBehaviorData[]>([]);
  const [receivablesAnalytics, setReceivablesAnalytics] = useState<ReceivablesAnalyticsData[]>([]);

  const kpiFilters = toFilters(kpiDateRange);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await fetchFinanceMetrics(kpiFilters);
      setMetrics(data);
    } catch (e) {
      console.error('Failed to load finance metrics:', e);
    }
  }, [kpiFilters.startDate, kpiFilters.endDate]);

  const loadIncomeReport = useCallback(async () => {
    const f: FinanceAnalyticsFilters = {
      startDate: incomeDateRange.startDate || undefined,
      endDate: incomeDateRange.endDate || undefined,
    };
    try {
      const report = await fetchIncomeSummaryReport(f);
      setIncomeReport(report);
    } catch (e) {
      console.error('Failed to load income report:', e);
    }
  }, [incomeDateRange]);

  const loadExpenseReport = useCallback(async () => {
    const f: FinanceAnalyticsFilters = {
      startDate: expenseDateRange.startDate || undefined,
      endDate: expenseDateRange.endDate || undefined,
      expenseCategory: expenseFilters.expenseCategory,
    };
    try {
      const report = await fetchExpenseSummaryReport(f);
      setExpenseReport(report);
    } catch (e) {
      console.error('Failed to load expense report:', e);
    }
  }, [expenseDateRange, expenseFilters.expenseCategory]);

  const loadCashFlowReport = useCallback(async () => {
    const f: FinanceAnalyticsFilters = {
      startDate: kpiDateRange.startDate || undefined,
      endDate: kpiDateRange.endDate || undefined,
    };
    try {
      const report = await fetchCashFlowReport(f);
      setCashFlowReport(report);
    } catch (e) {
      console.error('Failed to load cash flow report:', e);
    }
  }, [kpiDateRange.startDate, kpiDateRange.endDate]);

  const loadReceivables = useCallback(async () => {
    const f: FinanceAnalyticsFilters = {
      startDate: receivablesDateRange.startDate || undefined,
      endDate: receivablesDateRange.endDate || undefined,
    };
    try {
      const data = await fetchOutstandingReceivablesReport(f);
      setReceivables(data);
    } catch (e) {
      console.error('Failed to load receivables:', e);
    }
  }, [receivablesDateRange]);

  const loadCharts = useCallback(async () => {
    const f = kpiFilters;
    try {
      const [trend, behavior, recv] = await Promise.all([
        fetchCashFlowTrendData(f),
        fetchExpenseBehaviorData(f),
        fetchReceivablesAnalyticsData(f),
      ]);
      setCashFlowTrend(trend);
      setExpenseBehavior(behavior);
      setReceivablesAnalytics(recv);
    } catch (e) {
      console.error('Failed to load chart data:', e);
    }
  }, [kpiFilters.startDate, kpiFilters.endDate]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadMetrics(),
      loadIncomeReport(),
      loadExpenseReport(),
      loadCashFlowReport(),
      loadReceivables(),
      loadCharts(),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadMetrics(); loadCashFlowReport(); loadCharts(); }, [loadMetrics, loadCashFlowReport, loadCharts]);
  useEffect(() => { loadIncomeReport(); }, [loadIncomeReport]);
  useEffect(() => { loadExpenseReport(); }, [loadExpenseReport]);
  useEffect(() => { loadReceivables(); }, [loadReceivables]);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-slate-600 font-medium">Loading finance analytics...</p>
        </div>
      </div>
    );
  }

  const kpiStyles: Record<keyof FinanceMetrics, { icon: any; color: string; bg: string; shadow: string }> = {
    revenueGrowthRate: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100', shadow: 'shadow-emerald-100' },
    netCashFlow: { icon: DollarSign, color: 'text-sky-600', bg: 'bg-sky-100', shadow: 'shadow-sky-100' },
    operationalMargin: { icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-100', shadow: 'shadow-indigo-100' },
    grossMargin: { icon: Activity, color: 'text-purple-600', bg: 'bg-purple-100', shadow: 'shadow-purple-100' },
    roi: { icon: Zap, color: 'text-amber-600', bg: 'bg-amber-100', shadow: 'shadow-amber-100' },
    expenseToRevenueRatio: { icon: Percent, color: 'text-rose-600', bg: 'bg-rose-100', shadow: 'shadow-rose-100' },
    customerConcentrationRatio: { icon: Users, color: 'text-orange-600', bg: 'bg-orange-100', shadow: 'shadow-orange-100' },
    receivablesRatio: { icon: Wallet, color: 'text-cyan-600', bg: 'bg-cyan-100', shadow: 'shadow-cyan-100' },
    averageCollectionPeriod: { icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-100', shadow: 'shadow-teal-100' },
    inventoryTurnoverRatio: { icon: Layers, color: 'text-fuchsia-600', bg: 'bg-fuchsia-100', shadow: 'shadow-fuchsia-100' },
  };

  const renderKpiCard = (
    key: keyof FinanceMetrics,
    label: string,
    value: string | number | null,
    unit: string = '',
    index: number = 0,
  ) => {
    const style = kpiStyles[key] || { icon: Info, color: 'text-slate-600', bg: 'bg-slate-100', shadow: 'shadow-slate-100' };
    const Icon = style.icon;

    return (
      <div
        key={key}
        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
        className={`relative group overflow-hidden rounded-[1.25rem] bg-white border border-slate-100/60 shadow-sm hover:shadow-xl ${style.shadow} hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-6`}
      >
        <div className="flex justify-between items-start mb-5">
          <div className={`p-3.5 rounded-2xl ${style.bg} ${style.color} bg-opacity-60 backdrop-blur-sm border border-white/40 ring-1 ring-black/5`}>
            <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
          </div>
          <button
            type="button"
            onClick={() => setMetricInfoKey(key)}
            className="p-1.5 rounded-full text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none"
            aria-label="What is this metric?"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
        <div>
          <h4 className="text-3xl font-bold tracking-tight text-slate-900 mb-1.5 drop-shadow-sm">
            {value == null ? '—' : typeof value === 'number' ? `${value}${unit}` : value}
          </h4>
          <p className="text-sm font-semibold text-slate-500 truncate tracking-wide">{label}</p>
        </div>
        <div className={`absolute bottom-0 left-0 h-1 w-full ${style.bg.replace('100', '400')} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 pb-12">
      <MetricInfoModal metricKey={metricInfoKey} onClose={() => setMetricInfoKey(null)} />

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
              Finance Analytics
            </h1>
            <p className="text-slate-400 text-lg sm:text-xl font-light">
              Comprehensive insights into income, expenses, cash flow, and critical business decision metrics.
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

      <div className="w-full">
        {activeTab === 'metrics' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Finance Decision Metrics</h2>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <DateRangePicker
                  label="Period for KPIs"
                  value={kpiDateRange}
                  onChange={setKpiDateRange}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {metrics && (
                <>
                  {renderKpiCard('revenueGrowthRate', 'Revenue growth rate', metrics.revenueGrowthRate != null ? `${metrics.revenueGrowthRate.toFixed(1)}%` : null, '', 0)}
                  {renderKpiCard('netCashFlow', 'Net cash flow', metrics.netCashFlow != null ? fmt(metrics.netCashFlow) : '—', '', 1)}
                  {renderKpiCard('operationalMargin', 'Operational margin', metrics.operationalMargin != null ? `${metrics.operationalMargin.toFixed(1)}%` : null, '', 2)}
                  {renderKpiCard('grossMargin', 'Gross margin', metrics.grossMargin != null ? `${metrics.grossMargin.toFixed(1)}%` : null, '', 3)}
                  {renderKpiCard('roi', 'ROI', metrics.roi != null ? `${metrics.roi.toFixed(1)}%` : null, '', 4)}
                  {renderKpiCard('expenseToRevenueRatio', 'Expense-to-revenue', metrics.expenseToRevenueRatio != null ? metrics.expenseToRevenueRatio.toFixed(2) : null, '', 5)}
                  {renderKpiCard('customerConcentrationRatio', 'Customer concentration', metrics.customerConcentrationRatio != null ? `${metrics.customerConcentrationRatio.toFixed(1)}%` : null, '', 6)}
                  {renderKpiCard('receivablesRatio', 'Receivables ratio', metrics.receivablesRatio != null ? `${metrics.receivablesRatio.toFixed(1)}%` : null, '', 7)}
                  {renderKpiCard('averageCollectionPeriod', 'Avg. collection', metrics.averageCollectionPeriod != null ? Math.round(metrics.averageCollectionPeriod) : null, ' days', 8)}
                  {renderKpiCard('inventoryTurnoverRatio', 'Inventory turnover', metrics.inventoryTurnoverRatio != null ? metrics.inventoryTurnoverRatio.toFixed(2) : null, '', 9)}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Finance Reports</h2>
              </div>
            </div>

            {/* 1. Income summary */}
            <ModernCard className="shadow-sm border-0 ring-1 ring-slate-100 hover:shadow-lg transition-all duration-300" padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50">
                    <DollarSign className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  Income Summary
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <DateRangePicker label="Date range" value={incomeDateRange} onChange={setIncomeDateRange} />
                </div>
              </div>
              {incomeReport && (
                <div className="animate-in fade-in duration-500">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Income</h4>
                  <p className="text-4xl font-extrabold text-slate-900 mb-8 tracking-tight">{fmt(incomeReport.totalIncome)}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-6 border border-slate-100 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp className="w-16 h-16" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500 mb-1">Sales Revenue</p>
                      <p className="text-3xl font-bold text-slate-900">{fmt(incomeReport.salesIncome)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-6 border border-slate-100 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Activity className="w-16 h-16" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500 mb-1">Other Income</p>
                      <p className="text-3xl font-bold text-slate-900">{fmt(incomeReport.otherIncome)}</p>
                    </div>
                  </div>
                  {incomeReport.incomeBySource.length > 0 && (
                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:border-slate-200 transition-colors">
                      <button
                        onClick={() => setShowIncomeSources(!showIncomeSources)}
                        className="w-full bg-slate-50/80 hover:bg-slate-100 transition-colors flex items-center justify-between px-6 py-4 focus:outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-800">Income Sources Breakdown</span>
                          <span className="text-xs font-medium px-2 py-0.5 bg-white border border-slate-200 text-slate-500 rounded-full">
                            {incomeReport.incomeBySource.length} sources
                          </span>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showIncomeSources ? 'rotate-180' : ''}`} />
                      </button>

                      <div className={`transition-all duration-300 grid ${showIncomeSources ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-white">
                                <tr className="border-b border-t border-slate-200">
                                  <th className="text-left py-3 px-5 font-medium text-slate-600">Source</th>
                                  <th className="text-right py-3 px-5 font-medium text-slate-600">Amount</th>
                                  <th className="text-right py-3 px-5 font-medium text-slate-600">%</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-slate-100">
                                {incomeReport.incomeBySource.map((row) => (
                                  <tr key={row.source} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-2.5 px-5 text-slate-700 font-medium">{row.source}</td>
                                    <td className="text-right py-2.5 px-5 font-semibold text-slate-900">{fmt(row.amount)}</td>
                                    <td className="text-right py-2.5 px-5 text-slate-500">{row.percentage.toFixed(1)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ModernCard>

            {/* 2. Expense summary */}
            <ModernCard className="shadow-sm border-0 ring-1 ring-slate-100 hover:shadow-lg transition-all duration-300" padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/50">
                    <FileText className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  Expense Summary
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <DateRangePicker label="Date range" value={expenseDateRange} onChange={setExpenseDateRange} />
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                    <div className="pl-2">
                      <Filter className="w-4 h-4 text-slate-400" />
                    </div>
                    <select
                      value={expenseFilters.expenseCategory ?? ''}
                      onChange={(e) => setExpenseFilters((p) => ({ ...p, expenseCategory: e.target.value || undefined }))}
                      className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 cursor-pointer py-1.5"
                    >
                      <option value="">All categories</option>
                      {expenseReport?.expensesByCategory.map((c) => (
                        <option key={c.category} value={c.category}>{c.category}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {expenseReport && (
                <div className="animate-in fade-in duration-500">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Expenses</h4>
                  <p className="text-4xl font-extrabold text-slate-900 mb-8 tracking-tight">{fmt(expenseReport.totalExpenses)}</p>
                  <div className="space-y-8">
                    <p className="text-sm font-medium text-slate-600">By category</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/50">
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 font-semibold text-slate-600 rounded-tl-lg">Category</th>
                            <th className="text-right py-2 font-medium text-slate-600">Amount</th>
                            <th className="text-right py-2 font-medium text-slate-600">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseReport.expensesByCategory.map((row) => (
                            <tr key={row.category} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 text-slate-800 font-medium capitalize">{row.category.replace(/_/g, ' ')}</td>
                              <td className="text-right py-3 px-4 font-semibold text-slate-900">{fmt(row.amount)}</td>
                              <td className="text-right py-3 px-4 text-slate-500">{row.percentage.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {expenseReport.expensesByPaymentMode.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-slate-600 mt-4">By payment mode</p>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50/50">
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-3 px-4 font-semibold text-slate-600 rounded-tl-lg">Payment Mode</th>
                                <th className="text-right py-3 px-4 font-semibold text-slate-600 rounded-tr-lg">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expenseReport.expensesByPaymentMode.map((row) => (
                                <tr key={row.paymentMethod} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 text-slate-800 font-medium">{row.paymentMethod}</td>
                                  <td className="text-right py-3 px-4 font-semibold text-slate-900">{fmt(row.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </ModernCard>

            {/* 3. Cash flow report (simple) */}
            <ModernCard className="shadow-sm border-0 ring-1 ring-slate-100 hover:shadow-lg transition-all duration-300" padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100/50">
                    <TrendingUp className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  Cash Flow Statement
                </h3>
                <DateRangePicker label="Date range" value={kpiDateRange} onChange={setKpiDateRange} />
              </div>
              {cashFlowReport && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
                  <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-6 border border-emerald-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <DollarSign className="w-20 h-20" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2">Total Inflow</p>
                    <p className="text-3xl font-bold text-emerald-900 tracking-tight">{fmt(cashFlowReport.totalIncome)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-50 to-white rounded-2xl p-6 border border-rose-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <FileText className="w-20 h-20" />
                    </div>
                    <p className="text-sm font-semibold text-rose-600 uppercase tracking-wider mb-2">Total Outflow</p>
                    <p className="text-3xl font-bold text-rose-900 tracking-tight">{fmt(cashFlowReport.totalExpenses)}</p>
                  </div>
                  <div className={`rounded-2xl p-6 border shadow-sm relative overflow-hidden ${cashFlowReport.cashFlowStatus === 'positive' ? 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100' :
                    cashFlowReport.cashFlowStatus === 'negative' ? 'bg-gradient-to-br from-orange-50 to-white border-orange-100' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                    }`}>
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Activity className="w-20 h-20" />
                    </div>
                    <p className={`text-sm font-semibold uppercase tracking-wider mb-2 ${cashFlowReport.cashFlowStatus === 'positive' ? 'text-indigo-600' :
                      cashFlowReport.cashFlowStatus === 'negative' ? 'text-orange-600' : 'text-slate-600'
                      }`}>Net Cash Movement</p>
                    <p className={`text-3xl font-bold tracking-tight ${cashFlowReport.cashFlowStatus === 'positive' ? 'text-indigo-900' :
                      cashFlowReport.cashFlowStatus === 'negative' ? 'text-orange-900' : 'text-slate-900'
                      }`}>
                      {fmt(cashFlowReport.netCashFlow)}
                    </p>
                  </div>
                </div>
              )}
            </ModernCard>

            {/* 4. Outstanding receivables */}
            <ModernCard className="shadow-sm border-0 ring-1 ring-slate-100 hover:shadow-lg transition-all duration-300 mb-6" padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100/50">
                    <Users className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  Outstanding Receivables
                </h3>
                <DateRangePicker label="Order date range" value={receivablesDateRange} onChange={setReceivablesDateRange} />
              </div>
              <p className="text-sm font-medium text-slate-500 mb-6 pl-[52px]">Credit risk visibility & pending collections.</p>

              <div className="overflow-x-auto border border-slate-100 rounded-xl animate-in fade-in duration-500">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-4 px-5 font-semibold text-slate-600 rounded-tl-lg">Customer</th>
                      <th className="text-right py-4 px-5 font-semibold text-slate-600">Total order value</th>
                      <th className="text-right py-4 px-5 font-semibold text-slate-600">Amount received</th>
                      <th className="text-right py-4 px-5 font-semibold text-slate-600">Amount pending</th>
                      <th className="text-right py-4 px-5 font-semibold text-slate-600 rounded-tr-lg">Days outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receivables.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 px-5 text-center text-slate-500 font-medium bg-slate-50/30">No outstanding receivables in this period.</td></tr>
                    ) : (
                      receivables.map((r, idx) => (
                        <tr key={r.customerId} className="hover:bg-slate-50/50 transition-colors" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}>
                          <td className="py-4 px-5 font-semibold text-slate-800">{r.customerName}</td>
                          <td className="text-right py-4 px-5 font-medium">{fmt(r.totalOrderValue)}</td>
                          <td className="text-right py-4 px-5 font-semibold text-emerald-600">{fmt(r.amountReceived)}</td>
                          <td className="text-right py-4 px-5 text-rose-600 font-bold bg-rose-50/30">{fmt(r.amountPending)}</td>
                          <td className="text-right py-4 px-5 font-medium">
                            <span className={`px-2.5 py-1 rounded-full text-xs ${r.daysOutstanding > 30 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                              {r.daysOutstanding} days
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ModernCard>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <LineChartIcon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Finance Analytics</h2>
              </div>
              <div className="flex items-center gap-2">
                <DateRangePicker
                  label="Period for Analytics"
                  value={kpiDateRange}
                  onChange={setKpiDateRange}
                />
              </div>
            </div>

            {/* A. Cash flow trend */}
            <ModernCard className="shadow-sm border-0 ring-1 ring-slate-100 hover:shadow-lg transition-all duration-300" padding="lg">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50">
                    <BarChart3 className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  Cash Flow Trend
                </h3>
                <p className="text-sm font-medium text-slate-500 pl-[52px]">Comparing gross income against expenses alongside month-by-month net balances.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-700">
                <div className="min-h-[340px] bg-slate-50/50 p-6 rounded-2xl border border-slate-100/60 shadow-inner">
                  <h4 className="text-sm font-semibold text-slate-600 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Income vs Expenses Overview
                  </h4>
                  <div className="w-full overflow-x-auto pb-2">
                    <div className="min-w-[600px] lg:min-w-[100%]">
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={cashFlowTrend} margin={{ top: 8, right: 8, left: -10, bottom: 8 }}>
                          <defs>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" tickMargin={10} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 500 }}
                            formatter={(v: any) => [fmt(v as number), '']}
                            labelFormatter={(l) => `Month: ${l}`}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                          <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={3} fill="url(#colorIncome)" />
                          <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={3} fill="url(#colorExpense)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="min-h-[340px] bg-slate-50/50 p-6 rounded-2xl border border-slate-100/60 shadow-inner">
                  <h4 className="text-sm font-semibold text-slate-600 mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" /> Net Cash Baseline
                  </h4>
                  <div className="w-full overflow-x-auto pb-2">
                    <div className="min-w-[600px] lg:min-w-[100%]">
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={cashFlowTrend} margin={{ top: 8, right: 8, left: -10, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" tickMargin={10} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 500 }}
                            cursor={{ fill: '#f8fafc' }}
                            formatter={(v: any) => [fmt(v as number), 'Net cash']} labelFormatter={(l) => `Month: ${l}`}
                          />
                          <Bar dataKey="netCash" name="Net cash per month" radius={[6, 6, 0, 0]}>
                            {cashFlowTrend.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.netCash >= 0 ? '#8b5cf6' : '#f43f5e'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </ModernCard>

            {/* B. Expense behavior */}
            <ModernCard className="shadow-sm border-0 ring-1 ring-slate-100 hover:shadow-lg transition-all duration-300" padding="lg">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/50">
                    <Percent className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  Expense Behavior
                </h3>
                <p className="text-sm font-medium text-slate-500 pl-[52px]">Aggregated high-spend areas to uncover structural cost optimization opportunities.</p>
              </div>
              <div className="min-h-[320px] bg-slate-50/50 p-6 rounded-2xl border border-slate-100/60 shadow-inner animate-in zoom-in-95 duration-500">
                <div className="w-full overflow-x-auto pb-2">
                  <div className="min-w-[400px] lg:min-w-[100%]">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={expenseBehavior}
                        layout="vertical"
                        margin={{ top: 8, right: 30, left: 100, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="category" tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }} stroke="transparent" width={100} tickFormatter={(v) => (v || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} />
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', fontWeight: 600, padding: '12px 16px' }}
                          cursor={{ fill: '#e2e8f0', opacity: 0.4 }}
                          formatter={(v: any) => [fmt(v as number), 'Total Spent']}
                          labelStyle={{ color: '#64748b', fontSize: '13px', marginBottom: '8px', textTransform: 'capitalize' }}
                          labelFormatter={(v) => (v || '').replace(/_/g, ' ')}
                        />
                        <Bar dataKey="amount" name="Expenses by category" radius={[0, 6, 6, 0]}>
                          {expenseBehavior.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(340, 85%, ${Math.max(45, 75 - index * 6)}%)`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ModernCard>

            {/* C. Receivables analytics */}
            <ModernCard className="shadow-sm border-0 ring-1 ring-slate-100 hover:shadow-lg transition-all duration-300" padding="lg">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100/50">
                    <Users className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  Receivables Analytics
                </h3>
                <p className="text-sm font-medium text-slate-500 pl-[52px]">Outstanding debt segmented by customer risk mapping and credit exposure limits.</p>
              </div>
              <div className="min-h-[320px] bg-slate-50/50 p-6 rounded-2xl border border-slate-100/60 shadow-inner animate-in zoom-in-95 duration-500 delay-150">
                <div className="w-full overflow-x-auto pb-2">
                  <div className="min-w-[650px] lg:min-w-[100%]">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={receivablesAnalytics}
                        margin={{ top: 8, right: 8, left: -6, bottom: 70 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="customerName" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} stroke="#cbd5e1" angle={-45} textAnchor="end" height={70} tickMargin={8} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', fontWeight: 600, padding: '12px 16px' }}
                          cursor={{ fill: '#e2e8f0', opacity: 0.4 }}
                          formatter={(v: any) => [fmt(v as number), 'Uncollected debt']}
                          labelStyle={{ color: '#0f172a', fontSize: '14px', marginBottom: '8px', fontWeight: 700 }}
                        />
                        <Bar dataKey="outstandingAmount" name="Outstanding Amount" radius={[6, 6, 0, 0]}>
                          {receivablesAnalytics.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(230, 80%, ${Math.max(50, 80 - index * 5)}%)`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ModernCard>
          </div>
        )}
      </div>
    </div>
  );
}
