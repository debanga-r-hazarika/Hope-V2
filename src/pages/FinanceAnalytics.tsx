import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { DateRangePicker, type DateRange } from '../components/ui/DateRangePicker';

// ----- Default date range (this month) -----
function getDefaultDateRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
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
    calculation: '(Current period revenue minus previous period revenue) ÷ previous period revenue × 100.',
  },
  netCashFlow: {
    title: 'Net Cash Flow',
    meaning: 'This is the net amount of cash gained or lost in the selected period (money in minus money out).',
    importance: 'Positive cash flow means you have more coming in than going out; negative means the opposite. It is a key sign of short-term financial health.',
    calculation: 'Total income minus total expenses.',
  },
  operationalMargin: {
    title: 'Operational Margin',
    meaning: 'It shows how much of each rupee of revenue is left after covering operational costs (e.g. salaries, rent, admin).',
    importance: 'A higher margin means the business runs efficiently; a low or negative one suggests operational costs are too high relative to revenue.',
    calculation: '(Revenue minus operational expenses) ÷ revenue × 100.',
  },
  grossMargin: {
    title: 'Gross Margin (Simplified)',
    meaning: 'This is the profit left after deducting direct production costs (e.g. raw materials) from revenue.',
    importance: 'It indicates whether your product pricing and direct costs are in a healthy range before other expenses.',
    calculation: '(Revenue minus direct production costs) ÷ revenue × 100.',
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
  if (!metricKey) return null;
  const def = KPI_DEFINITIONS[metricKey];
  if (!def) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-900/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-100">
          <div className="bg-white px-6 pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full border bg-amber-50 border-amber-100 text-amber-600">
                <Info className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{def.title}</h3>
                <p className="text-sm text-gray-600 mb-2"><strong>What it means:</strong> {def.meaning}</p>
                <p className="text-sm text-gray-600 mb-2"><strong>Why it matters:</strong> {def.importance}</p>
                <p className="text-sm text-gray-600"><strong>How we calculate it:</strong> {def.calculation}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                ×
              </button>
            </div>
          </div>
          <div className="bg-gray-50/50 px-6 py-4 flex justify-end border-t border-gray-100">
            <ModernButton onClick={onClose} variant="primary" size="sm">Got it</ModernButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Format currency -----
const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

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

  // KPI period (used for metrics and as default for reports/charts)
  const [kpiDateRange, setKpiDateRange] = useState<DateRange>(getDefaultDateRange);
  const [metricInfoKey, setMetricInfoKey] = useState<keyof FinanceMetrics | null>(null);

  // Report-specific filters (no global filter)
  const [incomeFilters, setIncomeFilters] = useState<FinanceAnalyticsFilters & { incomeSource?: string }>({});
  const [expenseFilters, setExpenseFilters] = useState<FinanceAnalyticsFilters & { expenseCategory?: string }>({});

  const [incomeDateRange, setIncomeDateRange] = useState<DateRange>(getDefaultDateRange());
  const [expenseDateRange, setExpenseDateRange] = useState<DateRange>(getDefaultDateRange());
  const [receivablesDateRange, setReceivablesDateRange] = useState<DateRange>(getDefaultDateRange());

  const [incomeSources, setIncomeSources] = useState<string[]>([]);
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
      incomeSource: incomeFilters.incomeSource,
    };
    try {
      const [report, sources] = await Promise.all([
        fetchIncomeSummaryReport(f),
        fetchIncomeSources(),
      ]);
      setIncomeReport(report);
      setIncomeSources(sources);
    } catch (e) {
      console.error('Failed to load income report:', e);
    }
  }, [incomeDateRange, incomeFilters.incomeSource]);

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

  const renderKpiCard = (
    key: keyof FinanceMetrics,
    label: string,
    value: string | number | null,
    unit: string = '',
  ) => {
    const def = KPI_DEFINITIONS[key];
    return (
      <ModernCard key={key} className="relative" padding="md">
        <button
          type="button"
          onClick={() => setMetricInfoKey(key)}
          className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          aria-label="What is this metric?"
        >
          <Info className="w-4 h-4" />
        </button>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-900">
          {value == null ? '—' : typeof value === 'number' ? `${value}${unit}` : value}
        </p>
      </ModernCard>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 pb-12">
      <MetricInfoModal metricKey={metricInfoKey} onClose={() => setMetricInfoKey(null)} />

      {/* Header + Back */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/analytics')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Analytics
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Finance Analytics</h1>
          <p className="mt-1 text-slate-500">Income, expenses, cash flow, and decision metrics</p>
        </div>
      </div>

      {/* Vertical tabs + content */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Vertical tab list */}
        <nav className="lg:w-56 flex-shrink-0" aria-label="Finance sections">
          <div className="flex lg:flex-col gap-1 p-1 bg-slate-100 rounded-xl lg:rounded-2xl">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg lg:rounded-xl text-left font-medium transition-colors ${
                  activeTab === id
                    ? 'bg-white text-amber-700 shadow-sm border border-amber-100'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'metrics' && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-bold text-slate-900">Finance decision metrics</h2>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <DateRangePicker
                    label="Period for KPIs"
                    value={kpiDateRange}
                    onChange={setKpiDateRange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {metrics && (
                  <>
                    {renderKpiCard('revenueGrowthRate', 'Revenue growth rate', metrics.revenueGrowthRate != null ? `${metrics.revenueGrowthRate.toFixed(1)}%` : null)}
                    {renderKpiCard('netCashFlow', 'Net cash flow', metrics.netCashFlow != null ? fmt(metrics.netCashFlow) : '—')}
                    {renderKpiCard('operationalMargin', 'Operational margin', metrics.operationalMargin != null ? `${metrics.operationalMargin.toFixed(1)}%` : null)}
                    {renderKpiCard('grossMargin', 'Gross margin', metrics.grossMargin != null ? `${metrics.grossMargin.toFixed(1)}%` : null)}
                    {renderKpiCard('roi', 'ROI', metrics.roi != null ? `${metrics.roi.toFixed(1)}%` : null)}
                    {renderKpiCard('expenseToRevenueRatio', 'Expense-to-revenue', metrics.expenseToRevenueRatio != null ? metrics.expenseToRevenueRatio.toFixed(2) : null)}
                    {renderKpiCard('customerConcentrationRatio', 'Customer concentration', metrics.customerConcentrationRatio != null ? `${metrics.customerConcentrationRatio.toFixed(1)}%` : null)}
                    {renderKpiCard('receivablesRatio', 'Receivables ratio', metrics.receivablesRatio != null ? `${metrics.receivablesRatio.toFixed(1)}%` : null)}
                    {renderKpiCard('averageCollectionPeriod', 'Avg. collection (days)', metrics.averageCollectionPeriod != null ? Math.round(metrics.averageCollectionPeriod) : null)}
                    {renderKpiCard('inventoryTurnoverRatio', 'Inventory turnover', metrics.inventoryTurnoverRatio != null ? metrics.inventoryTurnoverRatio.toFixed(2) : null)}
                  </>
                )}
              </div>
            </section>
          )}

          {activeTab === 'reports' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">Finance reports</h2>

        {/* 1. Income summary */}
        <ModernCard className="mb-6" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Income summary
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <DateRangePicker label="Date range" value={incomeDateRange} onChange={setIncomeDateRange} />
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={incomeFilters.incomeSource ?? ''}
                  onChange={(e) => setIncomeFilters((p) => ({ ...p, incomeSource: e.target.value || undefined }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">All sources</option>
                  {incomeSources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {incomeReport && (
            <>
              <p className="text-2xl font-bold text-slate-900 mb-4">Total income: {fmt(incomeReport.totalIncome)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Sales</p>
                  <p className="text-xl font-semibold text-slate-900">{fmt(incomeReport.salesIncome)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Other income</p>
                  <p className="text-xl font-semibold text-slate-900">{fmt(incomeReport.otherIncome)}</p>
                </div>
              </div>
              {incomeReport.incomeBySource.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 font-medium text-slate-600">Source</th>
                        <th className="text-right py-2 font-medium text-slate-600">Amount</th>
                        <th className="text-right py-2 font-medium text-slate-600">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomeReport.incomeBySource.map((row) => (
                        <tr key={row.source} className="border-b border-slate-100">
                          <td className="py-2 text-slate-800">{row.source}</td>
                          <td className="text-right py-2 font-medium">{fmt(row.amount)}</td>
                          <td className="text-right py-2 text-slate-600">{row.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </ModernCard>

        {/* 2. Expense summary */}
        <ModernCard className="mb-6" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-600" />
              Expense summary
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <DateRangePicker label="Date range" value={expenseDateRange} onChange={setExpenseDateRange} />
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={expenseFilters.expenseCategory ?? ''}
                  onChange={(e) => setExpenseFilters((p) => ({ ...p, expenseCategory: e.target.value || undefined }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
            <>
              <p className="text-2xl font-bold text-slate-900 mb-4">Total expenses: {fmt(expenseReport.totalExpenses)}</p>
              <div className="space-y-4">
                <p className="text-sm font-medium text-slate-600">By category</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 font-medium text-slate-600">Category</th>
                        <th className="text-right py-2 font-medium text-slate-600">Amount</th>
                        <th className="text-right py-2 font-medium text-slate-600">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseReport.expensesByCategory.map((row) => (
                        <tr key={row.category} className="border-b border-slate-100">
                          <td className="py-2 text-slate-800 capitalize">{row.category.replace(/_/g, ' ')}</td>
                          <td className="text-right py-2 font-medium">{fmt(row.amount)}</td>
                          <td className="text-right py-2 text-slate-600">{row.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {expenseReport.expensesByPaymentMode.length > 0 && (
                  <>
                    <p className="text-sm font-medium text-slate-600 mt-4">By payment mode</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 font-medium text-slate-600">Payment mode</th>
                            <th className="text-right py-2 font-medium text-slate-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseReport.expensesByPaymentMode.map((row) => (
                            <tr key={row.paymentMethod} className="border-b border-slate-100">
                              <td className="py-2 text-slate-800">{row.paymentMethod}</td>
                              <td className="text-right py-2 font-medium">{fmt(row.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </ModernCard>

        {/* 3. Cash flow report (simple) */}
        <ModernCard className="mb-6" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-600" />
              Cash flow report
            </h3>
            <DateRangePicker label="Date range" value={kpiDateRange} onChange={setKpiDateRange} />
          </div>
          {cashFlowReport && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                <p className="text-sm text-slate-600">Total income</p>
                <p className="text-xl font-bold text-emerald-700">{fmt(cashFlowReport.totalIncome)}</p>
              </div>
              <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
                <p className="text-sm text-slate-600">Total expenses</p>
                <p className="text-xl font-bold text-rose-700">{fmt(cashFlowReport.totalExpenses)}</p>
              </div>
              <div className={`rounded-lg p-4 border ${
                cashFlowReport.cashFlowStatus === 'positive' ? 'bg-emerald-50 border-emerald-100' :
                cashFlowReport.cashFlowStatus === 'negative' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-200'
              }`}>
                <p className="text-sm text-slate-600">Net cash movement</p>
                <p className={`text-xl font-bold ${
                  cashFlowReport.cashFlowStatus === 'positive' ? 'text-emerald-700' :
                  cashFlowReport.cashFlowStatus === 'negative' ? 'text-rose-700' : 'text-slate-700'
                }`}>
                  {fmt(cashFlowReport.netCashFlow)}
                </p>
              </div>
            </div>
          )}
        </ModernCard>

        {/* 4. Outstanding receivables */}
        <ModernCard className="mb-6" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Outstanding receivables
            </h3>
            <DateRangePicker label="Order date range" value={receivablesDateRange} onChange={setReceivablesDateRange} />
          </div>
          <p className="text-sm text-slate-500 mb-4">Credit risk visibility and collection prioritization.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-medium text-slate-600">Customer</th>
                  <th className="text-right py-2 font-medium text-slate-600">Total order value</th>
                  <th className="text-right py-2 font-medium text-slate-600">Amount received</th>
                  <th className="text-right py-2 font-medium text-slate-600">Amount pending</th>
                  <th className="text-right py-2 font-medium text-slate-600">Days outstanding</th>
                </tr>
              </thead>
              <tbody>
                {receivables.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-500">No outstanding receivables in this period.</td></tr>
                ) : (
                  receivables.map((r) => (
                    <tr key={r.customerId} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-800">{r.customerName}</td>
                      <td className="text-right py-2">{fmt(r.totalOrderValue)}</td>
                      <td className="text-right py-2 text-emerald-600">{fmt(r.amountReceived)}</td>
                      <td className="text-right py-2 text-rose-600 font-medium">{fmt(r.amountPending)}</td>
                      <td className="text-right py-2">{r.daysOutstanding}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ModernCard>
            </section>
          )}

          {activeTab === 'analytics' && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">Finance analytics</h2>

              {/* A. Cash flow trend */}
        <ModernCard className="mb-6" padding="lg">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Cash flow trend
          </h3>
          <p className="text-sm text-slate-500 mb-4">Income vs expense over time; net cash per month. Identify cash pressure periods and stability.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="min-h-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cashFlowTrend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmt(v), '']} labelFormatter={(l) => `Month: ${l}`} />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Income" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="min-h-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={cashFlowTrend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmt(v), 'Net cash']} labelFormatter={(l) => `Month: ${l}`} />
                  <Bar dataKey="netCash" name="Net cash per month" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ModernCard>

        {/* B. Expense behavior */}
        <ModernCard className="mb-6" padding="lg">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Expense behavior
          </h3>
          <p className="text-sm text-slate-500 mb-4">High-spend areas and cost optimization opportunities.</p>
          <div className="min-h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={expenseBehavior}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} stroke="#64748b" width={72} tickFormatter={(v) => (v || '').replace(/_/g, ' ')} />
                <Tooltip formatter={(v: number) => [fmt(v), 'Amount']} />
                <Bar dataKey="amount" name="Expenses by category" fill="#be185d" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModernCard>

        {/* C. Receivables analytics */}
        <ModernCard className="mb-6" padding="lg">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Receivables analytics
          </h3>
          <p className="text-sm text-slate-500 mb-4">Outstanding amount by customer. Customers causing cash blockage and credit exposure risk.</p>
          <div className="min-h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={receivablesAnalytics}
                margin={{ top: 8, right: 8, left: 8, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="customerName" tick={{ fontSize: 10 }} stroke="#64748b" angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [fmt(v), 'Outstanding']} />
                <Bar dataKey="outstandingAmount" name="Outstanding amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModernCard>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
