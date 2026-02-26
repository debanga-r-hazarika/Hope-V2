// Finance Analytics Types

export interface FinanceAnalyticsFilters {
  startDate?: string;
  endDate?: string;
  incomeSource?: string;
  expenseCategory?: string;
}

// SECTION 1: FINANCE REPORTS

export interface IncomeSummaryReport {
  totalIncome: number;
  salesIncome: number;
  otherIncome: number;
  incomeBySource: Array<{
    source: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
}

export interface ExpenseSummaryReport {
  totalExpenses: number;
  expensesByCategory: Array<{
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  expensesByPaymentMode: Array<{
    paymentMethod: string;
    amount: number;
    count: number;
  }>;
}

export interface CashFlowReport {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  cashFlowStatus: 'positive' | 'negative' | 'neutral';
}

export interface OutstandingReceivable {
  customerId: string;
  customerName: string;
  totalOrderValue: number;
  amountReceived: number;
  amountPending: number;
  daysOutstanding: number;
  ordersCount: number;
}

// SECTION 2: FINANCE ANALYTICS

export interface CashFlowTrendData {
  month: string;
  income: number;
  expenses: number;
  netCash: number;
}

export interface ExpenseBehaviorData {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface ReceivablesAnalyticsData {
  customerName: string;
  outstandingAmount: number;
  daysOutstanding: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// SECTION 3: FINANCE DECISION METRICS (KPIs)

export interface FinanceMetrics {
  revenueGrowthRate: number | null;
  netCashFlow: number;
  operationalMargin: number | null;
  grossMargin: number | null;
  roi: number | null;
  expenseToRevenueRatio: number | null;
  customerConcentrationRatio: number | null;
  receivablesRatio: number | null;
  averageCollectionPeriod: number | null;
  inventoryTurnoverRatio: number | null;
}

export interface MetricInfo {
  name: string;
  value: number | null;
  unit: string;
  meaning: string;
  importance: string;
  calculation: string;
  status?: 'good' | 'warning' | 'critical';
}
