import { supabase } from './supabase';
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

// ============================================
// SECTION 1: FINANCE REPORTS
// ============================================

/** Fetch distinct income source values for filter dropdowns (read-only). */
export async function fetchIncomeSources(): Promise<string[]> {
  const { data, error } = await supabase
    .from('income')
    .select('source')
    .not('source', 'is', null);
  if (error) throw error;
  const set = new Set<string>();
  (data || []).forEach((row: { source?: string }) => {
    if (row.source && row.source.trim()) set.add(row.source.trim());
  });
  return Array.from(set).sort();
}

export async function fetchIncomeSummaryReport(
  filters?: FinanceAnalyticsFilters
): Promise<IncomeSummaryReport> {
  let query = supabase
    .from('income')
    .select('amount, source, income_type, payment_at');

  if (filters?.startDate) {
    query = query.gte('payment_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('payment_at', filters.endDate);
  }
  if (filters?.incomeSource) {
    query = query.eq('source', filters.incomeSource);
  }

  const { data, error } = await query;
  if (error) throw error;

  const incomeEntries = data || [];
  const totalIncome = incomeEntries.reduce((sum, entry) => sum + parseFloat(entry.amount || '0'), 0);

  // Calculate sales vs other income
  const salesIncome = incomeEntries
    .filter(e => e.income_type === 'sales')
    .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
  const otherIncome = totalIncome - salesIncome;

  // Group by source
  const sourceMap = new Map<string, { amount: number; count: number }>();
  incomeEntries.forEach(entry => {
    const source = entry.source || 'Unknown';
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { amount: 0, count: 0 });
    }
    const stats = sourceMap.get(source)!;
    stats.amount += parseFloat(entry.amount || '0');
    stats.count += 1;
  });

  const incomeBySource = Array.from(sourceMap.entries())
    .map(([source, stats]) => ({
      source,
      amount: stats.amount,
      count: stats.count,
      percentage: totalIncome > 0 ? (stats.amount / totalIncome) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalIncome,
    salesIncome,
    otherIncome,
    incomeBySource,
  };
}

export async function fetchExpenseSummaryReport(
  filters?: FinanceAnalyticsFilters
): Promise<ExpenseSummaryReport> {
  let query = supabase
    .from('expenses')
    .select('amount, expense_type, payment_method, payment_at');

  if (filters?.startDate) {
    query = query.gte('payment_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('payment_at', filters.endDate);
  }
  if (filters?.expenseCategory) {
    query = query.eq('expense_type', filters.expenseCategory);
  }

  const { data, error } = await query;
  if (error) throw error;

  const expenseEntries = data || [];
  const totalExpenses = expenseEntries.reduce((sum, entry) => sum + parseFloat(entry.amount || '0'), 0);

  // Group by category
  const categoryMap = new Map<string, { amount: number; count: number }>();
  expenseEntries.forEach(entry => {
    const category = entry.expense_type || 'other';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { amount: 0, count: 0 });
    }
    const stats = categoryMap.get(category)!;
    stats.amount += parseFloat(entry.amount || '0');
    stats.count += 1;
  });

  const expensesByCategory = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      amount: stats.amount,
      count: stats.count,
      percentage: totalExpenses > 0 ? (stats.amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Group by payment mode
  const paymentMap = new Map<string, { amount: number; count: number }>();
  expenseEntries.forEach(entry => {
    const method = entry.payment_method || 'unknown';
    if (!paymentMap.has(method)) {
      paymentMap.set(method, { amount: 0, count: 0 });
    }
    const stats = paymentMap.get(method)!;
    stats.amount += parseFloat(entry.amount || '0');
    stats.count += 1;
  });

  const expensesByPaymentMode = Array.from(paymentMap.entries())
    .map(([paymentMethod, stats]) => ({
      paymentMethod,
      amount: stats.amount,
      count: stats.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalExpenses,
    expensesByCategory,
    expensesByPaymentMode,
  };
}

export async function fetchCashFlowReport(
  filters?: FinanceAnalyticsFilters
): Promise<CashFlowReport> {
  const [incomeReport, expenseReport] = await Promise.all([
    fetchIncomeSummaryReport(filters),
    fetchExpenseSummaryReport(filters),
  ]);

  const netCashFlow = incomeReport.totalIncome - expenseReport.totalExpenses;
  const cashFlowStatus = netCashFlow > 0 ? 'positive' : netCashFlow < 0 ? 'negative' : 'neutral';

  return {
    totalIncome: incomeReport.totalIncome,
    totalExpenses: expenseReport.totalExpenses,
    netCashFlow,
    cashFlowStatus,
  };
}

export async function fetchOutstandingReceivablesReport(
  filters?: FinanceAnalyticsFilters
): Promise<OutstandingReceivable[]> {
  // Fetch orders with outstanding payments
  let query = supabase
    .from('orders')
    .select(`
      id,
      customer_id,
      order_date,
      total_amount,
      discount_amount,
      status,
      payment_status,
      customers!inner(id, name)
    `)
    .neq('status', 'CANCELLED')
    .in('payment_status', ['READY_FOR_PAYMENT', 'PARTIAL_PAYMENT']);

  if (filters?.startDate) {
    query = query.gte('order_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('order_date', filters.endDate);
  }

  const { data: orders, error: ordersError } = await query;
  if (ordersError) throw ordersError;

  const orderIds = (orders || []).map(o => o.id);

  // Fetch payments
  let paymentsMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from('order_payments')
      .select('order_id, amount_received')
      .in('order_id', orderIds);

    if (paymentsError) throw paymentsError;

    (payments || []).forEach(p => {
      const current = paymentsMap.get(p.order_id) || 0;
      paymentsMap.set(p.order_id, current + parseFloat(p.amount_received || '0'));
    });
  }

  // Group by customer
  const customerMap = new Map<string, {
    customerName: string;
    totalOrderValue: number;
    amountReceived: number;
    ordersCount: number;
    oldestOrderDate: string;
  }>();

  (orders || []).forEach((order: any) => {
    const customerId = order.customer_id;
    const netTotal = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');
    const paid = paymentsMap.get(order.id) || 0;

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customerName: order.customers?.name || 'Unknown',
        totalOrderValue: 0,
        amountReceived: 0,
        ordersCount: 0,
        oldestOrderDate: order.order_date,
      });
    }

    const stats = customerMap.get(customerId)!;
    stats.totalOrderValue += netTotal;
    stats.amountReceived += paid;
    stats.ordersCount += 1;

    if (order.order_date < stats.oldestOrderDate) {
      stats.oldestOrderDate = order.order_date;
    }
  });

  // Calculate days outstanding and convert to array
  const now = new Date();
  return Array.from(customerMap.entries())
    .map(([customerId, stats]) => {
      const oldestDate = new Date(stats.oldestOrderDate);
      const daysOutstanding = Math.floor((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        customerId,
        customerName: stats.customerName,
        totalOrderValue: stats.totalOrderValue,
        amountReceived: stats.amountReceived,
        amountPending: Math.max(0, stats.totalOrderValue - stats.amountReceived),
        daysOutstanding,
        ordersCount: stats.ordersCount,
      };
    })
    .filter(r => r.amountPending > 0)
    .sort((a, b) => b.amountPending - a.amountPending);
}

// ============================================
// SECTION 2: FINANCE ANALYTICS
// ============================================

export async function fetchCashFlowTrendData(
  filters?: FinanceAnalyticsFilters
): Promise<CashFlowTrendData[]> {
  // Fetch income
  let incomeQuery = supabase
    .from('income')
    .select('amount, payment_at');

  if (filters?.startDate) {
    incomeQuery = incomeQuery.gte('payment_at', filters.startDate);
  }
  if (filters?.endDate) {
    incomeQuery = incomeQuery.lte('payment_at', filters.endDate);
  }

  // Fetch expenses
  let expenseQuery = supabase
    .from('expenses')
    .select('amount, payment_at');

  if (filters?.startDate) {
    expenseQuery = expenseQuery.gte('payment_at', filters.startDate);
  }
  if (filters?.endDate) {
    expenseQuery = expenseQuery.lte('payment_at', filters.endDate);
  }

  const [incomeResult, expenseResult] = await Promise.all([
    incomeQuery,
    expenseQuery,
  ]);

  if (incomeResult.error) throw incomeResult.error;
  if (expenseResult.error) throw expenseResult.error;

  // Group by month
  const monthMap = new Map<string, { income: number; expenses: number }>();

  (incomeResult.data || []).forEach(entry => {
    const month = entry.payment_at.substring(0, 7); // YYYY-MM
    if (!monthMap.has(month)) {
      monthMap.set(month, { income: 0, expenses: 0 });
    }
    monthMap.get(month)!.income += parseFloat(entry.amount || '0');
  });

  (expenseResult.data || []).forEach(entry => {
    const month = entry.payment_at.substring(0, 7); // YYYY-MM
    if (!monthMap.has(month)) {
      monthMap.set(month, { income: 0, expenses: 0 });
    }
    monthMap.get(month)!.expenses += parseFloat(entry.amount || '0');
  });

  // Convert to array and calculate net cash
  return Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
      netCash: data.income - data.expenses,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function fetchExpenseBehaviorData(
  filters?: FinanceAnalyticsFilters
): Promise<ExpenseBehaviorData[]> {
  const expenseReport = await fetchExpenseSummaryReport(filters);
  
  return expenseReport.expensesByCategory.map(cat => ({
    category: cat.category,
    amount: cat.amount,
    count: cat.count,
    percentage: cat.percentage,
  }));
}

export async function fetchReceivablesAnalyticsData(
  filters?: FinanceAnalyticsFilters
): Promise<ReceivablesAnalyticsData[]> {
  const receivables = await fetchOutstandingReceivablesReport(filters);

  return receivables.map(r => {
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (r.daysOutstanding > 60) {
      riskLevel = 'high';
    } else if (r.daysOutstanding > 30) {
      riskLevel = 'medium';
    }

    return {
      customerName: r.customerName,
      outstandingAmount: r.amountPending,
      daysOutstanding: r.daysOutstanding,
      riskLevel,
    };
  });
}

// ============================================
// SECTION 3: FINANCE DECISION METRICS (KPIs)
// ============================================

export async function fetchFinanceMetrics(
  filters?: FinanceAnalyticsFilters
): Promise<FinanceMetrics> {
  // Get current period data
  const currentCashFlow = await fetchCashFlowReport(filters);
  const currentExpenses = await fetchExpenseSummaryReport(filters);

  // Fetch current period SALES revenue from orders (consistent with Sales Analytics)
  let ordersQuery = supabase
    .from('orders')
    .select('total_amount, discount_amount, order_date')
    .neq('status', 'CANCELLED');

  if (filters?.startDate) {
    ordersQuery = ordersQuery.gte('order_date', filters.startDate);
  }
  if (filters?.endDate) {
    ordersQuery = ordersQuery.lte('order_date', filters.endDate);
  }

  const { data: currentOrders } = await ordersQuery;
  const currentSalesRevenue = (currentOrders || []).reduce((sum, order) => {
    return sum + (parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0'));
  }, 0);

  // Fetch OTHER income (non-sales) from income table
  let otherIncomeQuery = supabase
    .from('income')
    .select('amount, payment_at')
    .neq('income_type', 'sales'); // Exclude sales, get service, interest, other

  if (filters?.startDate) {
    otherIncomeQuery = otherIncomeQuery.gte('payment_at', filters.startDate);
  }
  if (filters?.endDate) {
    otherIncomeQuery = otherIncomeQuery.lte('payment_at', filters.endDate);
  }

  const { data: otherIncomeData } = await otherIncomeQuery;
  const currentOtherIncome = (otherIncomeData || []).reduce((sum, entry) => {
    return sum + parseFloat(entry.amount || '0');
  }, 0);

  // Total revenue = Sales + Other Income
  const currentRevenue = currentSalesRevenue + currentOtherIncome;

  // Calculate previous period for growth rate
  let previousPeriodRevenue: number | null = null;
  if (filters?.startDate && filters?.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const periodDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
    
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);

    // Previous period sales from orders
    let prevOrdersQuery = supabase
      .from('orders')
      .select('total_amount, discount_amount')
      .neq('status', 'CANCELLED')
      .gte('order_date', prevStart.toISOString().split('T')[0])
      .lte('order_date', prevEnd.toISOString().split('T')[0]);

    const { data: prevOrders } = await prevOrdersQuery;
    const prevSalesRevenue = (prevOrders || []).reduce((sum, order) => {
      return sum + (parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0'));
    }, 0);

    // Previous period other income
    let prevOtherIncomeQuery = supabase
      .from('income')
      .select('amount')
      .neq('income_type', 'sales')
      .gte('payment_at', prevStart.toISOString().split('T')[0])
      .lte('payment_at', prevEnd.toISOString().split('T')[0]);

    const { data: prevOtherIncomeData } = await prevOtherIncomeQuery;
    const prevOtherIncome = (prevOtherIncomeData || []).reduce((sum, entry) => {
      return sum + parseFloat(entry.amount || '0');
    }, 0);

    previousPeriodRevenue = prevSalesRevenue + prevOtherIncome;
  }

  // 1. Revenue Growth Rate
  const revenueGrowthRate = previousPeriodRevenue && previousPeriodRevenue > 0
    ? ((currentRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
    : null;

  // 2. Net Cash Flow
  const netCashFlow = currentCashFlow.netCashFlow;

  // 3. Operational Margin
  const operationalExpenses = currentExpenses.expensesByCategory
    .filter(c => c.category === 'operational')
    .reduce((sum, c) => sum + c.amount, 0);
  const operationalMargin = currentRevenue > 0
    ? ((currentRevenue - operationalExpenses) / currentRevenue) * 100
    : null;

  // 4. Gross Margin (using raw_material as direct production costs)
  const directCosts = currentExpenses.expensesByCategory
    .filter(c => c.category === 'raw_material')
    .reduce((sum, c) => sum + c.amount, 0);
  const grossMargin = currentRevenue > 0
    ? ((currentRevenue - directCosts) / currentRevenue) * 100
    : null;

  // 5. ROI (Return on Investment)
  const { data: contributions } = await supabase
    .from('contributions')
    .select('amount');
  const totalInvestedCapital = (contributions || []).reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0);
  const netProfit = currentRevenue - currentExpenses.totalExpenses;
  const roi = totalInvestedCapital > 0
    ? (netProfit / totalInvestedCapital) * 100
    : null;

  // 6. Expense-to-Revenue Ratio
  const expenseToRevenueRatio = currentRevenue > 0
    ? currentExpenses.totalExpenses / currentRevenue
    : null;

  // 7. Customer Concentration Ratio (top 3 customers)
  let customerOrdersQuery = supabase
    .from('orders')
    .select('customer_id, total_amount, discount_amount, status, order_date')
    .neq('status', 'CANCELLED');

  // Apply date filters if provided
  if (filters?.startDate) {
    customerOrdersQuery = customerOrdersQuery.gte('order_date', filters.startDate);
  }
  if (filters?.endDate) {
    customerOrdersQuery = customerOrdersQuery.lte('order_date', filters.endDate);
  }

  const { data: customerOrders } = await customerOrdersQuery;

  const customerSalesMap = new Map<string, number>();
  (customerOrders || []).forEach(order => {
    const netAmount = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');
    const current = customerSalesMap.get(order.customer_id) || 0;
    customerSalesMap.set(order.customer_id, current + netAmount);
  });

  const sortedCustomers = Array.from(customerSalesMap.values()).sort((a, b) => b - a);
  const top3Revenue = sortedCustomers.slice(0, 3).reduce((sum, val) => sum + val, 0);
  const totalRevenue = sortedCustomers.reduce((sum, val) => sum + val, 0);
  const customerConcentrationRatio = totalRevenue > 0
    ? (top3Revenue / totalRevenue) * 100
    : null;

  // 8. Receivables Ratio
  const receivables = await fetchOutstandingReceivablesReport(filters);
  const totalOutstanding = receivables.reduce((sum, r) => sum + r.amountPending, 0);
  const totalSales = receivables.reduce((sum, r) => sum + r.totalOrderValue, 0);
  const receivablesRatio = totalSales > 0
    ? (totalOutstanding / totalSales) * 100
    : null;

  // 9. Average Collection Period
  let paymentsQuery = supabase
    .from('order_payments')
    .select(`
      payment_date,
      orders!inner(order_date)
    `);

  // Apply date filters to payment_date if provided
  if (filters?.startDate) {
    paymentsQuery = paymentsQuery.gte('payment_date', filters.startDate);
  }
  if (filters?.endDate) {
    paymentsQuery = paymentsQuery.lte('payment_date', filters.endDate);
  }

  const { data: payments } = await paymentsQuery;

  let totalDays = 0;
  let paymentCount = 0;
  (payments || []).forEach((payment: any) => {
    if (payment.payment_date && payment.orders?.order_date) {
      const orderDate = new Date(payment.orders.order_date);
      const paymentDate = new Date(payment.payment_date);
      const days = Math.floor((paymentDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      if (days >= 0) {
        totalDays += days;
        paymentCount += 1;
      }
    }
  });
  const averageCollectionPeriod = paymentCount > 0 ? totalDays / paymentCount : null;

  // 10. Inventory Turnover Ratio
  // COGS = raw material expenses
  const cogs = directCosts;
  
  // Get average inventory value (simplified: current inventory value)
  const { data: rawMaterials } = await supabase
    .from('raw_materials')
    .select('quantity, unit_price');
  
  const inventoryValue = (rawMaterials || []).reduce((sum, item) => {
    return sum + (parseFloat(item.quantity || '0') * parseFloat(item.unit_price || '0'));
  }, 0);

  const inventoryTurnoverRatio = inventoryValue > 0 ? cogs / inventoryValue : null;

  return {
    revenueGrowthRate,
    netCashFlow,
    operationalMargin,
    grossMargin,
    roi,
    expenseToRevenueRatio,
    customerConcentrationRatio,
    receivablesRatio,
    averageCollectionPeriod,
    inventoryTurnoverRatio,
  };
}
