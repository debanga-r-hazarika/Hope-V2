import { supabase } from './supabase';
import type {
  AnalyticsFilters,
  SalesAnalyticsByTag,
  SalesMetrics,
  RawMaterialAnalytics,
  RecurringProductAnalytics,
  ProducedGoodsAnalytics,
  IncomeAnalytics,
  ExpenseAnalytics,
  CashPosition,
  FinancialVerdict,
  Recommendation,
  AnalyticsTarget,
  TargetProgress,
  HealthStatus,
  TrendDirection,
  PressureLevel,
  InventoryRisk,
} from '../types/analytics';

// Helper function to get date range from filters
function getDateRange(filters: AnalyticsFilters): { start: string; end: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  let start: Date;
  let end: Date;
  
  switch (filters.dateRange) {
    case 'today':
      // Format: YYYY-MM-DD for today
      const todayStr = today.toISOString().split('T')[0];
      return { start: todayStr, end: todayStr };
      
    case 'month':
      // Full month: 1st to last day of current month
      // Use string formatting to avoid timezone issues
      const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start: monthStart, end: monthEnd };
      
    case 'quarter':
      const quarter = Math.floor(month / 3);
      const quarterStartMonth = quarter * 3;
      const quarterEndMonth = quarterStartMonth + 3;
      
      const quarterStart = `${year}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`;
      const quarterLastDay = new Date(year, quarterEndMonth, 0).getDate();
      const quarterEnd = `${year}-${String(quarterEndMonth).padStart(2, '0')}-${String(quarterLastDay).padStart(2, '0')}`;
      return { start: quarterStart, end: quarterEnd };
      
    case 'year':
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      return { start: yearStart, end: yearEnd };
      
    case 'custom':
      if (filters.startDate && filters.endDate) {
        return { start: filters.startDate, end: filters.endDate };
      }
      // Fallback to today if custom dates not provided
      const fallbackStr = today.toISOString().split('T')[0];
      return { start: fallbackStr, end: fallbackStr };
      
    default:
      // Default: last 30 days
      start = new Date(today);
      start.setDate(start.getDate() - 30);
      end = new Date(today);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
  }
}

// ============================================
// SALES ANALYTICS
// ============================================

export async function fetchSalesAnalyticsByTag(
  filters: AnalyticsFilters
): Promise<SalesAnalyticsByTag[]> {
  const { start, end } = getDateRange(filters);
  
  let query = supabase
    .from('sales_analytics_by_tag')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (filters.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as SalesAnalyticsByTag[];
}

/**
 * Fetches sales metrics for the Analytics dashboard.
 * 
 * IMPORTANT: This function queries orders directly instead of using the sales_analytics_by_tag view
 * because the view can produce negative payment_pending values when customers overpay on orders.
 * 
 * This ensures accurate metrics:
 * - Total Sales Value: Sum of all order totals (after discounts) - FILTERED BY DATE
 * - Total Orders: Count of non-cancelled orders - FILTERED BY DATE
 * - Payment Collected: Sum of all payments received - FILTERED BY DATE
 * - Payment Pending: ALL outstanding amounts across ALL orders (not filtered by date)
 */
export async function fetchSalesMetrics(filters: AnalyticsFilters): Promise<SalesMetrics> {
  const { start, end } = getDateRange(filters);
  
  // Build query for orders within the date range
  let ordersQuery = supabase
    .from('orders')
    .select('id, total_amount, discount_amount, status')
    .neq('status', 'CANCELLED');

  // Apply date filters for sales metrics
  ordersQuery = ordersQuery.gte('order_date', start);
  ordersQuery = ordersQuery.lte('order_date', end);

  const { data: orders, error: ordersError } = await ordersQuery;
  if (ordersError) throw ordersError;

  // Get order IDs for items and payments
  const orderIds = (orders || []).map(o => o.id);

  // Fetch order items to calculate total quantity
  let totalQuantitySold = 0;
  if (orderIds.length > 0) {
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('quantity')
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;

    totalQuantitySold = (orderItems || []).reduce((sum, item) => 
      sum + parseFloat(item.quantity || '0'), 0);
  }

  // Fetch payments for these orders
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

  // Calculate metrics for orders within date range
  let totalSalesValue = 0;
  let totalPaidAcrossAllOrders = 0;

  (orders || []).forEach(order => {
    const netTotal = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');
    const totalPaid = paymentsMap.get(order.id) || 0;

    totalSalesValue += netTotal;
    totalPaidAcrossAllOrders += totalPaid;
  });

  // Calculate TOTAL outstanding payments across ALL orders (not filtered by date)
  const { data: allOrders, error: allOrdersError } = await supabase
    .from('orders')
    .select('id, total_amount, discount_amount')
    .neq('status', 'CANCELLED');

  if (allOrdersError) throw allOrdersError;

  const allOrderIds = (allOrders || []).map(o => o.id);

  // Fetch all payments for all orders
  let allPaymentsMap = new Map<string, number>();
  if (allOrderIds.length > 0) {
    const { data: allPayments, error: allPaymentsError } = await supabase
      .from('order_payments')
      .select('order_id, amount_received')
      .in('order_id', allOrderIds);

    if (allPaymentsError) throw allPaymentsError;

    (allPayments || []).forEach(p => {
      const current = allPaymentsMap.get(p.order_id) || 0;
      allPaymentsMap.set(p.order_id, current + parseFloat(p.amount_received || '0'));
    });
  }

  // Calculate total outstanding across all orders
  let totalOutstandingAmount = 0;
  (allOrders || []).forEach(order => {
    const netTotal = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');
    const totalPaid = allPaymentsMap.get(order.id) || 0;
    const outstanding = Math.max(0, netTotal - totalPaid);
    totalOutstandingAmount += outstanding;
  });

  const metrics: SalesMetrics = {
    totalSalesValue,
    totalQuantitySold,
    numberOfOrders: orders?.length || 0,
    averageOrderValue: (orders?.length || 0) > 0 ? totalSalesValue / (orders?.length || 0) : 0,
    paymentCollected: totalPaidAcrossAllOrders,
    paymentPending: totalOutstandingAmount, // ALL outstanding, not just current period
  };

  return metrics;
}

// ============================================
// FINANCE METRICS
// ============================================

export async function fetchFinanceMetrics(filters: AnalyticsFilters): Promise<{
  totalIncome: number;
  totalExpenses: number;
  totalContributions: number;
  netCashFlow: number;
  expenseRatio: number;
}> {
  const { start, end } = getDateRange(filters);

  // Fetch income for the period
  const { data: incomeData, error: incomeError } = await supabase
    .from('income')
    .select('amount')
    .gte('payment_date', start)
    .lte('payment_date', end);

  if (incomeError) throw incomeError;

  // Fetch expenses for the period
  const { data: expensesData, error: expensesError } = await supabase
    .from('expenses')
    .select('amount')
    .gte('payment_date', start)
    .lte('payment_date', end);

  if (expensesError) throw expensesError;

  // Fetch contributions for the period
  const { data: contributionsData, error: contributionsError } = await supabase
    .from('contributions')
    .select('amount')
    .gte('payment_date', start)
    .lte('payment_date', end);

  if (contributionsError) throw contributionsError;

  const totalIncome = (incomeData || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const totalExpenses = (expensesData || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const totalContributions = (contributionsData || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const netCashFlow = totalIncome - totalExpenses - totalContributions;
  
  // Calculate expense ratio (expenses as % of income)
  const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

  return {
    totalIncome,
    totalExpenses,
    totalContributions,
    netCashFlow,
    expenseRatio,
  };
}

// ============================================
// MATERIAL & PRODUCTION ANALYTICS
// ============================================

export async function fetchRawMaterialAnalytics(
  filters: AnalyticsFilters
): Promise<RawMaterialAnalytics[]> {
  const { start, end } = getDateRange(filters);
  
  let query = supabase
    .from('raw_material_analytics_by_tag')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (filters.specificTagId && filters.tagType === 'raw_material') {
    query = query.eq('tag_id', filters.specificTagId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as RawMaterialAnalytics[];
}

export async function fetchRecurringProductAnalytics(
  filters: AnalyticsFilters
): Promise<RecurringProductAnalytics[]> {
  const { start, end } = getDateRange(filters);
  
  let query = supabase
    .from('recurring_product_analytics_by_tag')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (filters.specificTagId && filters.tagType === 'recurring_product') {
    query = query.eq('tag_id', filters.specificTagId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as RecurringProductAnalytics[];
}

export async function fetchProducedGoodsAnalytics(
  filters: AnalyticsFilters
): Promise<ProducedGoodsAnalytics[]> {
  const { start, end } = getDateRange(filters);
  
  let query = supabase
    .from('produced_goods_analytics_by_tag')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (filters.specificTagId && filters.tagType === 'produced_goods') {
    query = query.eq('tag_id', filters.specificTagId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as ProducedGoodsAnalytics[];
}

// ============================================
// FINANCE ANALYTICS
// ============================================

export async function fetchIncomeAnalytics(
  filters: AnalyticsFilters
): Promise<IncomeAnalytics[]> {
  const { start, end } = getDateRange(filters);
  
  let query = supabase
    .from('income_analytics_by_tag')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (filters.specificTagId && filters.tagType === 'produced_goods') {
    query = query.eq('tag_id', filters.specificTagId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as IncomeAnalytics[];
}

export async function fetchExpenseAnalytics(
  filters: AnalyticsFilters
): Promise<ExpenseAnalytics[]> {
  const { start, end } = getDateRange(filters);
  
  // Try tag-based first if raw material tag is selected
  if (filters.tagType === 'raw_material' && filters.specificTagId) {
    const { data, error } = await supabase
      .from('expense_analytics_by_tag')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .eq('tag_id', filters.specificTagId)
      .order('date', { ascending: true });

    if (error) throw error;
    return (data || []) as ExpenseAnalytics[];
  }

  // Otherwise, use overall expense analytics
  const { data, error } = await supabase
    .from('expense_analytics_overall')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (error) throw error;
  
  return (data || []).map((item: any) => ({
    date: item.date,
    total_expense: item.total_expense,
    expense_transactions: item.expense_transactions,
    expense_type: item.expense_type,
  })) as ExpenseAnalytics[];
}

export async function fetchCashPosition(
  filters: AnalyticsFilters
): Promise<CashPosition[]> {
  const { start, end } = getDateRange(filters);
  
  const { data, error } = await supabase
    .from('cash_position_daily')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as CashPosition[];
}

// ============================================
// FINANCIAL VERDICT ENGINE
// ============================================

export async function calculateFinancialVerdict(
  filters: AnalyticsFilters
): Promise<FinancialVerdict> {
  const [incomeData, expenseData, cashPosition, salesData] = await Promise.all([
    fetchIncomeAnalytics(filters),
    fetchExpenseAnalytics(filters),
    fetchCashPosition(filters),
    fetchSalesAnalyticsByTag(filters),
  ]);

  // Calculate totals
  const totalIncome = incomeData.reduce((sum, item) => sum + (item.total_income || 0), 0);
  const totalExpense = expenseData.reduce((sum, item) => sum + (item.total_expense || 0), 0);
  const netPosition = totalIncome - totalExpense;

  // Calculate trends (compare current period with previous period)
  const { start, end } = getDateRange(filters);
  const periodDays = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - periodDays);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousFilters: AnalyticsFilters = {
    ...filters,
    dateRange: 'custom',
    startDate: previousStart.toISOString().split('T')[0],
    endDate: previousEnd.toISOString().split('T')[0],
  };

  const [prevIncomeData] = await Promise.all([
    fetchIncomeAnalytics(previousFilters),
    fetchExpenseAnalytics(previousFilters),
  ]);

  const prevTotalIncome = prevIncomeData.reduce((sum, item) => sum + (item.total_income || 0), 0);

  // Revenue Trend
  const incomeChange = prevTotalIncome > 0 
    ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 
    : (totalIncome > 0 ? 100 : 0);
  const revenueTrend: TrendDirection = incomeChange > 5 ? 'growing' : incomeChange < -5 ? 'declining' : 'flat';

  // Expense Pressure
  const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  const expensePressure: PressureLevel = expenseRatio > 80 ? 'high' : expenseRatio < 50 ? 'low' : 'normal';

  // Overall Health
  let overallHealth: HealthStatus = 'stable';
  if (netPosition < 0 || expenseRatio > 90 || incomeChange < -20) {
    overallHealth = 'critical';
  } else if (netPosition < totalIncome * 0.1 || expenseRatio > 70 || incomeChange < -10) {
    overallHealth = 'warning';
  }

  // Inventory Risk (from produced goods analytics)
  const producedGoodsData = await fetchProducedGoodsAnalytics(filters);
  const avgSellThrough = producedGoodsData.length > 0
    ? producedGoodsData.reduce((sum, item) => sum + (item.sell_through_rate || 0), 0) / producedGoodsData.length
    : 0;
  
  const inventoryRisk: InventoryRisk = avgSellThrough < 30 ? 'overstock' : avgSellThrough > 80 ? 'shortage' : 'balanced';

  // Generate message
  let message = '';
  if (revenueTrend === 'growing') {
    message += `Sales increased by ${Math.abs(incomeChange).toFixed(1)}%`;
  } else if (revenueTrend === 'declining') {
    message += `Sales decreased by ${Math.abs(incomeChange).toFixed(1)}%`;
  } else {
    message += 'Sales remained relatively flat';
  }

  if (expensePressure === 'high') {
    message += `, but expenses on raw materials grew faster than income (${expenseRatio.toFixed(1)}% of income), resulting in lower net cash movement.`;
  } else if (expensePressure === 'low') {
    message += `, and expenses are well-controlled (${expenseRatio.toFixed(1)}% of income), resulting in positive cash flow.`;
  } else {
    message += `, with expenses at ${expenseRatio.toFixed(1)}% of income.`;
  }

  return {
    overallHealth,
    revenueTrend,
    expensePressure,
    inventoryRisk,
    message,
  };
}

// ============================================
// RECOMMENDATIONS ENGINE
// ============================================

export async function generateRecommendations(
  filters: AnalyticsFilters
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const seenRecommendations = new Map<string, Recommendation>();

  // Check waste percentage - aggregate by tag
  const rawMaterialData = await fetchRawMaterialAnalytics(filters);
  const wasteByTag = new Map<string, { tag_name: string; max_waste: number; date: string }>();
  
  rawMaterialData.forEach((item) => {
    if (item.waste_percentage > 15) {
      const key = item.tag_id;
      const existing = wasteByTag.get(key);
      if (!existing || item.waste_percentage > existing.max_waste) {
        wasteByTag.set(key, {
          tag_name: item.tag_name,
          max_waste: item.waste_percentage,
          date: item.date,
        });
      }
    }
  });

  wasteByTag.forEach((data, tagId) => {
    const rec: Recommendation = {
      id: `waste-${tagId}`,
      type: 'waste',
      severity: data.max_waste > 25 ? 'critical' : 'warning',
      title: 'High Waste Detected',
      message: `High waste detected in ${data.tag_name}. Waste rate: ${data.max_waste.toFixed(1)}%`,
      relatedTagId: tagId,
      relatedTagName: data.tag_name,
      date: data.date,
    };
    seenRecommendations.set(rec.id, rec);
  });

  // Check sell-through rate - aggregate by tag
  const producedGoodsData = await fetchProducedGoodsAnalytics(filters);
  const sellThroughByTag = new Map<string, { tag_name: string; min_rate: number; total_available: number; date: string }>();
  
  producedGoodsData.forEach((item) => {
    if (item.sell_through_rate < 30 && item.total_quantity_available > 0) {
      const key = item.tag_id;
      const existing = sellThroughByTag.get(key);
      if (!existing || item.sell_through_rate < existing.min_rate) {
        sellThroughByTag.set(key, {
          tag_name: item.tag_name,
          min_rate: item.sell_through_rate,
          total_available: item.total_quantity_available,
          date: item.date,
        });
      } else if (existing && item.total_quantity_available > existing.total_available) {
        // Update if more stock available (more urgent)
        sellThroughByTag.set(key, {
          tag_name: item.tag_name,
          min_rate: existing.min_rate,
          total_available: item.total_quantity_available,
          date: item.date,
        });
      }
    }
  });

  sellThroughByTag.forEach((data, tagId) => {
    const rec: Recommendation = {
      id: `sell-through-${tagId}`,
      type: 'sell_through',
      severity: data.min_rate < 15 ? 'critical' : 'warning',
      title: 'Low Sales Observed',
      message: `Low sales observed for ${data.tag_name}. Sell-through rate: ${data.min_rate.toFixed(1)}%`,
      relatedTagId: tagId,
      relatedTagName: data.tag_name,
      date: data.date,
    };
    seenRecommendations.set(rec.id, rec);
  });

  // Check expense growth vs income
  const [incomeData, expenseData] = await Promise.all([
    fetchIncomeAnalytics(filters),
    fetchExpenseAnalytics(filters),
  ]);

  const totalIncome = incomeData.reduce((sum, item) => sum + (item.total_income || 0), 0);
  const packagingExpenses = expenseData
    .filter((e) => e.expense_type === 'operational')
    .reduce((sum, item) => sum + (item.total_expense || 0), 0);

  if (packagingExpenses > 0 && totalIncome > 0) {
    const expenseRatio = (packagingExpenses / totalIncome) * 100;
    if (expenseRatio > 20) {
      const rec: Recommendation = {
        id: 'expense-growth',
        type: 'expense',
        severity: expenseRatio > 30 ? 'critical' : 'warning',
        title: 'Rising Expenses',
        message: `Packaging cost increased without proportional sales growth. Expenses are ${expenseRatio.toFixed(1)}% of income.`,
      };
      seenRecommendations.set(rec.id, rec);
    }
  }

  // Check pending payments
  const salesMetrics = await fetchSalesMetrics(filters);
  if (salesMetrics.paymentPending > 0 && salesMetrics.totalSalesValue > 0) {
    const pendingRatio = (salesMetrics.paymentPending / salesMetrics.totalSalesValue) * 100;
    if (pendingRatio > 30) {
      const rec: Recommendation = {
        id: 'pending-payments',
        type: 'payment',
        severity: pendingRatio > 50 ? 'critical' : 'warning',
        title: 'High Pending Payments',
        message: `Pending payments exceed ${pendingRatio.toFixed(1)}% of monthly income. Consider following up on outstanding invoices.`,
      };
      seenRecommendations.set(rec.id, rec);
    }
  }

  // Return deduplicated recommendations, sorted by severity (critical first)
  const finalRecommendations = Array.from(seenRecommendations.values());
  finalRecommendations.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
  });

  return finalRecommendations;
}

// ============================================
// TARGETS MANAGEMENT
// ============================================

export async function fetchAnalyticsTargets(): Promise<AnalyticsTarget[]> {
  const { data, error } = await supabase
    .from('analytics_targets')
    .select('*')
    .eq('status', 'active')
    .order('period_start', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Fetch tag names separately based on tag_type
  const tagIdsByType = {
    raw_material: [] as string[],
    recurring_product: [] as string[],
    produced_goods: [] as string[],
  };

  data.forEach((item: any) => {
    if (item.tag_id && item.tag_type) {
      if (item.tag_type === 'raw_material') {
        tagIdsByType.raw_material.push(item.tag_id);
      } else if (item.tag_type === 'recurring_product') {
        tagIdsByType.recurring_product.push(item.tag_id);
      } else if (item.tag_type === 'produced_goods') {
        tagIdsByType.produced_goods.push(item.tag_id);
      }
    }
  });

  // Fetch tags in parallel
  const [rawMaterialTags, recurringProductTags, producedGoodsTags] = await Promise.all([
    tagIdsByType.raw_material.length > 0
      ? supabase.from('raw_material_tags').select('id, display_name').in('id', tagIdsByType.raw_material)
      : Promise.resolve({ data: [], error: null }),
    tagIdsByType.recurring_product.length > 0
      ? supabase.from('recurring_product_tags').select('id, display_name').in('id', tagIdsByType.recurring_product)
      : Promise.resolve({ data: [], error: null }),
    tagIdsByType.produced_goods.length > 0
      ? supabase.from('produced_goods_tags').select('id, display_name').in('id', tagIdsByType.produced_goods)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Create tag lookup maps
  const tagMap = new Map<string, string>();
  (rawMaterialTags.data || []).forEach((tag: any) => tagMap.set(tag.id, tag.display_name));
  (recurringProductTags.data || []).forEach((tag: any) => tagMap.set(tag.id, tag.display_name));
  (producedGoodsTags.data || []).forEach((tag: any) => tagMap.set(tag.id, tag.display_name));

  return data.map((item: any) => {
    const tagName = item.tag_id ? tagMap.get(item.tag_id) : undefined;

    return {
      id: item.id,
      target_name: item.target_name,
      target_type: item.target_type,
      target_value: parseFloat(item.target_value),
      tag_type: item.tag_type,
      tag_id: item.tag_id,
      tag_name: tagName,
      period_start: item.period_start,
      period_end: item.period_end,
      status: item.status,
      description: item.description,
      created_at: item.created_at,
      created_by: item.created_by,
      updated_at: item.updated_at,
    } as AnalyticsTarget;
  });
}

export async function calculateTargetProgress(target: AnalyticsTarget): Promise<TargetProgress> {
  const filters: AnalyticsFilters = {
    dateRange: 'custom',
    startDate: target.period_start,
    endDate: target.period_end,
    viewMode: 'summary',
  };

  let achieved = 0;

  switch (target.target_type) {
    case 'sales_count':
      const salesMetrics = await fetchSalesMetrics(filters);
      achieved = salesMetrics.numberOfOrders;
      break;
    case 'sales_revenue':
      const salesData = await fetchSalesAnalyticsByTag(filters);
      achieved = salesData.reduce((sum, item) => sum + (item.total_sales_value || 0), 0);
      break;
    case 'product_sales':
      if (target.tag_id && target.tag_type === 'produced_goods') {
        filters.specificTagId = target.tag_id;
        filters.tagType = 'produced_goods';
        const productSales = await fetchSalesAnalyticsByTag(filters);
        achieved = productSales.reduce((sum, item) => sum + (item.total_quantity_sold || 0), 0);
      }
      break;
    case 'production_quantity':
      if (target.tag_id && target.tag_type === 'produced_goods') {
        filters.specificTagId = target.tag_id;
        filters.tagType = 'produced_goods';
        const productionData = await fetchProducedGoodsAnalytics(filters);
        achieved = productionData.reduce((sum, item) => sum + (item.total_quantity_produced || 0), 0);
      }
      break;
  }

  const remaining = Math.max(0, target.target_value - achieved);
  const percentage = target.target_value > 0 ? (achieved / target.target_value) * 100 : 0;

  const today = new Date();
  const endDate = new Date(target.period_end);
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // Check if on track (simple linear projection)
  const totalDays = Math.ceil((endDate.getTime() - new Date(target.period_start).getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = totalDays - daysRemaining;
  const expectedProgress = daysElapsed > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const isOnTrack = percentage >= expectedProgress - 10; // 10% tolerance

  return {
    target,
    achieved,
    remaining,
    percentage: Math.min(100, percentage),
    daysRemaining,
    isOnTrack,
  };
}

export async function fetchAllTargetProgress(): Promise<TargetProgress[]> {
  const targets = await fetchAnalyticsTargets();
  const progressPromises = targets.map((target) => calculateTargetProgress(target));
  return Promise.all(progressPromises);
}
