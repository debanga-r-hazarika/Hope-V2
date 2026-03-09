import { supabase } from './supabase';
import type { FinanceTarget, FinanceTargetFormData, FinanceTargetProgress } from '../types/finance-targets';

// ============================================
// FETCH FINANCE TARGETS
// ============================================

export async function fetchFinanceTargets(
  status?: 'active' | 'completed' | 'cancelled'
): Promise<FinanceTarget[]> {
  let query = supabase
    .from('analytics_targets')
    .select('*')
    .in('target_type', [
      'revenue_target',
      'expense_limit',
      'cash_flow_target',
      'profit_margin_target',
      'collection_period_target',
      'expense_ratio_target'
    ])
    .order('period_start', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  console.log('[Finance Targets] Fetch result:', { data, error, count: data?.length });
  if (error) {
    console.error('[Finance Targets] Fetch error:', error);
    throw error;
  }

  return (data || []) as FinanceTarget[];
}

// ============================================
// CREATE FINANCE TARGET
// ============================================

export async function createFinanceTarget(
  formData: FinanceTargetFormData,
  userProfileId: string
): Promise<FinanceTarget> {
  const { data, error } = await supabase
    .from('analytics_targets')
    .insert({
      target_name: formData.target_name,
      target_type: formData.target_type,
      target_value: formData.target_value,
      tag_type: null, // Finance targets don't use tags
      tag_id: null,
      period_start: formData.period_start,
      period_end: formData.period_end,
      description: formData.description || null,
      status: 'active',
      created_by: userProfileId,
      updated_by: userProfileId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as FinanceTarget;
}

// ============================================
// UPDATE FINANCE TARGET
// ============================================

export async function updateFinanceTarget(
  targetId: string,
  formData: Partial<FinanceTargetFormData>,
  userProfileId: string
): Promise<FinanceTarget> {
  const updateData: any = {
    ...formData,
    updated_by: userProfileId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('analytics_targets')
    .update(updateData)
    .eq('id', targetId)
    .select()
    .single();

  if (error) throw error;
  return data as FinanceTarget;
}

// ============================================
// DELETE FINANCE TARGET
// ============================================

export async function deleteFinanceTarget(targetId: string): Promise<void> {
  const { error } = await supabase
    .from('analytics_targets')
    .delete()
    .eq('id', targetId);

  if (error) throw error;
}

// ============================================
// UPDATE TARGET STATUS
// ============================================

export async function updateFinanceTargetStatus(
  targetId: string,
  status: 'active' | 'completed' | 'cancelled',
  userProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from('analytics_targets')
    .update({
      status,
      updated_by: userProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId);

  if (error) throw error;
}

// ============================================
// CALCULATE TARGET PROGRESS
// ============================================

export async function calculateFinanceTargetProgress(
  target: FinanceTarget
): Promise<FinanceTargetProgress> {
  let currentValue = 0;
  let statusMessage = '';

  const { period_start, period_end, target_type } = target;

  if (target_type === 'revenue_target') {
    // Revenue Target: Total income in period should be >= target
    const { data: incomeData, error } = await supabase
      .from('income')
      .select('amount')
      .gte('payment_date', period_start)
      .lte('payment_date', period_end);

    if (error) throw error;

    currentValue = (incomeData || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
    
    statusMessage = currentValue >= target.target_value
      ? 'Revenue target achieved!'
      : `₹${(target.target_value - currentValue).toFixed(2)} short of target`;

  } else if (target_type === 'expense_limit') {
    // Expense Limit: Total expenses should be <= target
    const { data: expenseData, error } = await supabase
      .from('expenses')
      .select('amount')
      .gte('payment_date', period_start)
      .lte('payment_date', period_end);

    if (error) throw error;

    currentValue = (expenseData || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
    
    // Generate contextual status message based on usage percentage
    const usagePercent = (currentValue / target.target_value) * 100;
    if (currentValue > target.target_value) {
      statusMessage = `₹${(currentValue - target.target_value).toFixed(2)} over limit - EXCEEDED!`;
    } else if (usagePercent >= 90) {
      statusMessage = `${usagePercent.toFixed(1)}% of budget used - Near limit!`;
    } else if (usagePercent >= 75) {
      statusMessage = `${usagePercent.toFixed(1)}% of budget used - Monitor closely`;
    } else if (usagePercent >= 50) {
      statusMessage = `${usagePercent.toFixed(1)}% of budget used - On track`;
    } else {
      statusMessage = `${usagePercent.toFixed(1)}% of budget used - Well within limit`;
    }

  } else if (target_type === 'cash_flow_target') {
    // Cash Flow Target: Net cash flow (income - expenses) should be >= target
    const [incomeResult, expenseResult] = await Promise.all([
      supabase
        .from('income')
        .select('amount')
        .gte('payment_date', period_start)
        .lte('payment_date', period_end),
      supabase
        .from('expenses')
        .select('amount')
        .gte('payment_date', period_start)
        .lte('payment_date', period_end)
    ]);

    if (incomeResult.error) throw incomeResult.error;
    if (expenseResult.error) throw expenseResult.error;

    const totalIncome = (incomeResult.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
    const totalExpenses = (expenseResult.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
    
    currentValue = totalIncome - totalExpenses;
    
    statusMessage = currentValue >= target.target_value
      ? 'Cash flow target achieved!'
      : `₹${(target.target_value - currentValue).toFixed(2)} short of target`;

  } else if (target_type === 'profit_margin_target') {
    // Profit Margin Target: (Income - Expenses) / Income * 100 should be >= target
    const [incomeResult, expenseResult] = await Promise.all([
      supabase
        .from('income')
        .select('amount')
        .gte('payment_date', period_start)
        .lte('payment_date', period_end),
      supabase
        .from('expenses')
        .select('amount')
        .gte('payment_date', period_start)
        .lte('payment_date', period_end)
    ]);

    if (incomeResult.error) throw incomeResult.error;
    if (expenseResult.error) throw expenseResult.error;

    const totalIncome = (incomeResult.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
    const totalExpenses = (expenseResult.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
    
    currentValue = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    statusMessage = currentValue >= target.target_value
      ? 'Profit margin target achieved!'
      : `${(target.target_value - currentValue).toFixed(2)}% below target`;

  } else if (target_type === 'collection_period_target') {
    // Collection Period Target: Average days between order and payment should be <= target
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        payment_date,
        orders!inner(order_date)
      `)
      .gte('payment_date', period_start)
      .lte('payment_date', period_end);

    if (error) throw error;

    if (payments && payments.length > 0) {
      const totalDays = payments.reduce((sum, payment: any) => {
        const orderDate = new Date(payment.orders.order_date);
        const paymentDate = new Date(payment.payment_date);
        const days = Math.ceil((paymentDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);

      currentValue = totalDays / payments.length;
    } else {
      currentValue = 0;
    }
    
    statusMessage = currentValue <= target.target_value && currentValue > 0
      ? 'Collection period target achieved!'
      : currentValue === 0
        ? 'No payment data available'
        : `${(currentValue - target.target_value).toFixed(1)} days over target`;

  } else if (target_type === 'expense_ratio_target') {
    // Expense Ratio Target: Expenses / Income should be <= target
    const [incomeResult, expenseResult] = await Promise.all([
      supabase
        .from('income')
        .select('amount')
        .gte('payment_date', period_start)
        .lte('payment_date', period_end),
      supabase
        .from('expenses')
        .select('amount')
        .gte('payment_date', period_start)
        .lte('payment_date', period_end)
    ]);

    if (incomeResult.error) throw incomeResult.error;
    if (expenseResult.error) throw expenseResult.error;

    const totalIncome = (incomeResult.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
    const totalExpenses = (expenseResult.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
    
    currentValue = totalIncome > 0 ? totalExpenses / totalIncome : 0;
    
    statusMessage = currentValue <= target.target_value && totalIncome > 0
      ? 'Expense ratio target achieved!'
      : totalIncome === 0
        ? 'No income data available'
        : `${((currentValue - target.target_value) * 100).toFixed(1)}% over target`;
  }

  // Calculate progress percentage
  let progressPercentage = 0;
  
  // For targets where lower is better (expense_limit, collection_period_target, expense_ratio_target)
  const lowerIsBetter = ['expense_limit', 'collection_period_target', 'expense_ratio_target'].includes(target_type);
  
  if (lowerIsBetter) {
    // For "lower is better" targets, progress shows how much of the limit has been used
    // Example: ₹518 spent out of ₹3,000 limit = 17.3% progress
    progressPercentage = target.target_value > 0 
      ? (currentValue / target.target_value) * 100 
      : 0;
  } else {
    // For "higher is better" targets (revenue, cash flow, profit margin)
    progressPercentage = target.target_value > 0 
      ? (currentValue / target.target_value) * 100 
      : 0;
  }

  const isAchieved = lowerIsBetter
    ? currentValue <= target.target_value && currentValue >= 0
    : currentValue >= target.target_value;

  const remainingValue = Math.abs(target.target_value - currentValue);

  // Calculate days remaining (allow negative for expired)
  const today = new Date();
  const endDate = new Date(target.period_end);
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    target,
    current_value: currentValue,
    progress_percentage: progressPercentage,
    is_achieved: isAchieved,
    remaining_value: remainingValue,
    days_remaining: daysRemaining,
    status_message: statusMessage,
  };
}

// ============================================
// FETCH TARGETS WITH PROGRESS
// ============================================

export async function fetchFinanceTargetsWithProgress(
  status?: 'active' | 'completed' | 'cancelled'
): Promise<FinanceTargetProgress[]> {
  const targets = await fetchFinanceTargets(status);
  
  const progressPromises = targets.map(target => calculateFinanceTargetProgress(target));
  const progressData = await Promise.all(progressPromises);

  return progressData;
}
