import { supabase } from './supabase';
import type { ContributionEntry, IncomeEntry, ExpenseEntry } from '../types/finance';

export interface TransactionListItem {
  id: string;
  transactionId: string;
  amount: number;
  reason: string;
  date: string;
  type: 'income' | 'expense' | 'contribution';
  source?: string;
}

export interface LedgerItem {
  id: string;
  transactionId: string;
  amount: number;
  reason: string;
  date: string;
  type: 'income' | 'expense' | 'contribution';
  table: string;
}

function mapDbToIncome(row: any): IncomeEntry {
  return {
    id: row.id,
    amount: parseFloat(row.amount),
    source: row.source,
    incomeType: row.income_type,
    reason: row.reason,
    transactionId: row.transaction_id,
    paymentTo: row.payment_to,
    paidToUser: row.paid_to_user,
    paymentDate: row.payment_at || row.payment_date,
    paymentMethod: row.payment_method,
    description: row.description,
    category: row.category,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bankReference: row.bank_reference,
    evidenceUrl: row.evidence_url,
    fromSalesPayment: row.from_sales_payment || false,
    orderPaymentId: row.order_payment_id,
    orderId: row.order_id,
    orderNumber: row.order_number,
  };
}

function mapDbToExpense(row: any): ExpenseEntry {
  return {
    id: row.id,
    amount: parseFloat(row.amount),
    vendor: row.vendor,
    expenseType: row.expense_type,
    otherExpenseTypeSpecification: row.other_expense_type_specification,
    reason: row.reason,
    transactionId: row.transaction_id,
    paymentTo: row.payment_to,
    paidToUser: row.paid_to_user,
    paymentDate: row.payment_at || row.payment_date,
    paymentMethod: row.payment_method,
    description: row.description,
    category: row.category,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bankReference: row.bank_reference,
    evidenceUrl: row.evidence_url,
  };
}

function mapDbToContribution(row: any): ContributionEntry {
  return {
    id: row.id,
    amount: parseFloat(row.amount),
    contributionType: row.contribution_type,
    reason: row.reason,
    transactionId: row.transaction_id,
    paymentTo: row.payment_to,
    paidToUser: row.paid_to_user,
    paidBy: row.paid_by,
    paymentDate: row.payment_at || row.payment_date,
    paymentMethod: row.payment_method,
    description: row.description,
    category: row.category,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bankReference: row.bank_reference,
    evidenceUrl: row.evidence_url,
  };
}

async function generateTransactionId(table: 'income' | 'expenses' | 'contributions'): Promise<string> {
  const prefix = table === 'income' ? 'TXN-INC-' : table === 'expenses' ? 'TXN-EXP-' : 'TXN-CNT-';
  const { data } = await supabase.from(table).select('transaction_id').like('transaction_id', `${prefix}%`).order('transaction_id', { ascending: false }).limit(1).maybeSingle();
  if (data?.transaction_id) {
    const lastNum = parseInt(data.transaction_id.replace(prefix, ''));
    return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
  }
  return `${prefix}001`;
}

export async function fetchFinanceSummary() {
  const [contributions, ledgerIncome, expenses] = await Promise.all([
    supabase.from('contributions').select('amount'),
    supabase.from('income').select('amount'),
    supabase.from('expenses').select('amount'),
  ]);
  const totalContributions = (contributions.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const totalLedgerIncome = (ledgerIncome.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const totalExpenses = (expenses.data || []).reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  return {
    contributions: { totalAmount: totalContributions, count: contributions.data?.length || 0 },
    ledgerIncome: { totalAmount: totalLedgerIncome, count: ledgerIncome.data?.length || 0 },
    expenses: { totalAmount: totalExpenses, count: expenses.data?.length || 0 },
  };
}

export async function fetchRecentTransactions(limit: number = 10): Promise<TransactionListItem[]> {
  const [incomeResult, expensesResult] = await Promise.all([
    supabase.from('income').select('id, transaction_id, amount, reason, payment_at, source').order('payment_at', { ascending: false }).limit(limit),
    supabase.from('expenses').select('id, transaction_id, amount, reason, payment_at').order('payment_at', { ascending: false }).limit(limit),
  ]);
  const income: TransactionListItem[] = (incomeResult.data || []).map((item) => ({ id: item.id, transactionId: item.transaction_id, amount: parseFloat(item.amount), reason: item.reason, date: item.payment_at, type: 'income' as const, source: item.source }));
  const expenses: TransactionListItem[] = (expensesResult.data || []).map((item) => ({ id: item.id, transactionId: item.transaction_id, amount: parseFloat(item.amount), reason: item.reason, date: item.payment_at, type: 'expense' as const }));
  return [...income, ...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
}

export async function searchTransactions(term: string, limit: number = 15) {
  const searchPattern = `%${term}%`;
  const [contributions, income, expenses] = await Promise.all([
    supabase.from('contributions').select('id, transaction_id, amount, reason, payment_at').or(`transaction_id.ilike.${searchPattern},reason.ilike.${searchPattern}`).limit(limit),
    supabase.from('income').select('id, transaction_id, amount, reason, payment_at').or(`transaction_id.ilike.${searchPattern},reason.ilike.${searchPattern}`).limit(limit),
    supabase.from('expenses').select('id, transaction_id, amount, reason, payment_at').or(`transaction_id.ilike.${searchPattern},reason.ilike.${searchPattern}`).limit(limit),
  ]);
  const results: Array<TransactionListItem & { table: 'income' | 'expenses' | 'contributions' }> = [
    ...(contributions.data || []).map((item) => ({ id: item.id, transactionId: item.transaction_id, amount: parseFloat(item.amount), reason: item.reason, date: item.payment_at, type: 'contribution' as const, table: 'contributions' as const })),
    ...(income.data || []).map((item) => ({ id: item.id, transactionId: item.transaction_id, amount: parseFloat(item.amount), reason: item.reason, date: item.payment_at, type: 'income' as const, table: 'income' as const })),
    ...(expenses.data || []).map((item) => ({ id: item.id, transactionId: item.transaction_id, amount: parseFloat(item.amount), reason: item.reason, date: item.payment_at, type: 'expense' as const, table: 'expenses' as const })),
  ];
  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function fetchLedgerTransactions(limit: number = 300): Promise<LedgerItem[]> {
  const [contributions, income, expenses] = await Promise.all([
    supabase.from('contributions').select('id, transaction_id, amount, reason, payment_at').order('payment_at', { ascending: false }).limit(limit),
    supabase.from('income').select('id, transaction_id, amount, reason, payment_at').order('payment_at', { ascending: false }).limit(limit),
    supabase.from('expenses').select('id, transaction_id, amount, reason, payment_at').order('payment_at', { ascending: false }).limit(limit),
  ]);
  const ledger: LedgerItem[] = [
    ...(contributions.data || []).map((item) => ({ id: item.id, transactionId: item.transaction_id, amount: parseFloat(item.amount), reason: item.reason, date: item.payment_at, type: 'contribution' as const, table: 'contributions' })),
    ...(income.data || []).map((item) => ({ id: item.id, transactionId: item.transaction_id, amount: parseFloat(item.amount), reason: item.reason, date: item.payment_at, type: 'income' as const, table: 'income' })),
    ...(expenses.data || []).map((item) => ({ id: item.id, transactionId: item.transaction_id, amount: parseFloat(item.amount), reason: item.reason, date: item.payment_at, type: 'expense' as const, table: 'expenses' })),
  ];
  return ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function fetchContributions(month: number | 'all' = 'all', year: number | 'all' = 'all'): Promise<ContributionEntry[]> {
  let query = supabase.from('contributions').select('*');
  if (month !== 'all' && year !== 'all') {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    query = query.gte('payment_at', startDate).lte('payment_at', endDate);
  } else if (year !== 'all') {
    const startDate = new Date(year, 0, 1).toISOString();
    const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
    query = query.gte('payment_at', startDate).lte('payment_at', endDate);
  }
  query = query.order('payment_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapDbToContribution);
}

export async function fetchIncome(month: number | 'all' = 'all', year: number | 'all' = 'all'): Promise<IncomeEntry[]> {
  let query = supabase.from('income').select('*');
  if (month !== 'all' && year !== 'all') {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    query = query.gte('payment_at', startDate).lte('payment_at', endDate);
  } else if (year !== 'all') {
    const startDate = new Date(year, 0, 1).toISOString();
    const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
    query = query.gte('payment_at', startDate).lte('payment_at', endDate);
  }
  query = query.order('payment_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapDbToIncome);
}

export async function fetchExpenses(month: number | 'all' = 'all', year: number | 'all' = 'all'): Promise<ExpenseEntry[]> {
  let query = supabase.from('expenses').select('*');
  if (month !== 'all' && year !== 'all') {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    query = query.gte('payment_at', startDate).lte('payment_at', endDate);
  } else if (year !== 'all') {
    const startDate = new Date(year, 0, 1).toISOString();
    const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
    query = query.gte('payment_at', startDate).lte('payment_at', endDate);
  }
  query = query.order('payment_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapDbToExpense);
}

export async function createContribution(contribution: Partial<ContributionEntry>, options?: { currentUserId?: string }): Promise<ContributionEntry> {
  const transactionId = contribution.transactionId || await generateTransactionId('contributions');
  const payload: any = { amount: contribution.amount, contribution_type: contribution.contributionType, reason: contribution.reason, transaction_id: transactionId, payment_to: contribution.paymentTo, paid_to_user: contribution.paidToUser, paid_by: contribution.paidBy, payment_date: contribution.paymentDate, payment_at: contribution.paymentDate, payment_method: contribution.paymentMethod, description: contribution.description, category: contribution.category, bank_reference: contribution.bankReference, evidence_url: contribution.evidenceUrl, recorded_by: options?.currentUserId || null };
  const { data, error } = await supabase.from('contributions').insert([payload]).select().single();
  if (error) throw error;
  return mapDbToContribution(data);
}

export async function updateContribution(id: string, updates: Partial<ContributionEntry>, options?: { currentUserId?: string }): Promise<ContributionEntry> {
  const payload: any = {};
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.contributionType !== undefined) payload.contribution_type = updates.contributionType;
  if (updates.reason !== undefined) payload.reason = updates.reason;
  if (updates.transactionId !== undefined) payload.transaction_id = updates.transactionId;
  if (updates.paymentTo !== undefined) payload.payment_to = updates.paymentTo;
  if (updates.paidToUser !== undefined) payload.paid_to_user = updates.paidToUser;
  if (updates.paidBy !== undefined) payload.paid_by = updates.paidBy;
  if (updates.paymentDate !== undefined) { payload.payment_date = updates.paymentDate; payload.payment_at = updates.paymentDate; }
  if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.bankReference !== undefined) payload.bank_reference = updates.bankReference;
  if (updates.evidenceUrl !== undefined) payload.evidence_url = updates.evidenceUrl;
  if (options?.currentUserId) payload.recorded_by = options.currentUserId;
  const { data, error } = await supabase.from('contributions').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return mapDbToContribution(data);
}

export async function deleteContribution(id: string): Promise<void> {
  const { error } = await supabase.from('contributions').delete().eq('id', id);
  if (error) throw error;
}

export async function createIncome(income: Partial<IncomeEntry>, options?: { currentUserId?: string }): Promise<IncomeEntry> {
  const transactionId = income.transactionId || await generateTransactionId('income');
  const payload: any = { amount: income.amount, source: income.source, income_type: income.incomeType, reason: income.reason, transaction_id: transactionId, payment_to: income.paymentTo, paid_to_user: income.paidToUser, payment_date: income.paymentDate, payment_at: income.paymentDate, payment_method: income.paymentMethod, description: income.description, category: income.category, bank_reference: income.bankReference, evidence_url: income.evidenceUrl, recorded_by: options?.currentUserId || null };
  const { data, error } = await supabase.from('income').insert([payload]).select().single();
  if (error) throw error;
  return mapDbToIncome(data);
}

// Find income entry linked to an order payment
export async function findIncomeByOrderPayment(orderPaymentId: string): Promise<IncomeEntry | null> {
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .eq('order_payment_id', orderPaymentId)
    .maybeSingle();
  
  if (error) throw error;
  return data ? mapDbToIncome(data) : null;
}

export async function updateIncome(id: string, updates: Partial<IncomeEntry>, options?: { currentUserId?: string }): Promise<IncomeEntry> {
  // Check if this income entry is from a sales payment
  const { data: existing, error: fetchError } = await supabase
    .from('income')
    .select('from_sales_payment, order_payment_id, order_id, order_number')
    .eq('id', id)
    .single();
  
  if (fetchError) throw fetchError;
  
  if (existing?.from_sales_payment) {
    throw new Error(
      `This income entry is linked to a sales order payment and cannot be edited from the Finance module. ` +
      `Please go to the Sales module, find Order ${existing.order_number || existing.order_id} and edit the payment from there.`
    );
  }
  
  const payload: any = {};
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.source !== undefined) payload.source = updates.source;
  if (updates.incomeType !== undefined) payload.income_type = updates.incomeType;
  if (updates.reason !== undefined) payload.reason = updates.reason;
  if (updates.transactionId !== undefined) payload.transaction_id = updates.transactionId;
  if (updates.paymentTo !== undefined) payload.payment_to = updates.paymentTo;
  if (updates.paidToUser !== undefined) payload.paid_to_user = updates.paidToUser;
  if (updates.paymentDate !== undefined) { payload.payment_date = updates.paymentDate; payload.payment_at = updates.paymentDate; }
  if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.bankReference !== undefined) payload.bank_reference = updates.bankReference;
  if (updates.evidenceUrl !== undefined) payload.evidence_url = updates.evidenceUrl;
  if (options?.currentUserId) payload.recorded_by = options.currentUserId;
  const { data, error } = await supabase.from('income').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return mapDbToIncome(data);
}

export async function deleteIncome(id: string): Promise<void> {
  // Check if entry is from sales payment
  const { data: entry, error: fetchError } = await supabase
    .from('income')
    .select('from_sales_payment, order_number, order_id')
    .eq('id', id)
    .single();
  
  if (fetchError) throw fetchError;
  
  if (entry?.from_sales_payment) {
    const orderLink = entry.order_number || entry.order_id || 'the order';
    throw new Error(
      `This income entry is linked to a sales order payment and cannot be deleted from the Finance module. ` +
      `Please go to the Sales module, find Order ${orderLink} and delete the payment from there. ` +
      `This ensures data integrity between Sales and Finance modules.`
    );
  }
  
  const { error } = await supabase.from('income').delete().eq('id', id);
  if (error) throw error;
}

export async function createExpense(expense: Partial<ExpenseEntry>, options?: { currentUserId?: string }): Promise<ExpenseEntry> {
  const transactionId = expense.transactionId || await generateTransactionId('expenses');
  const payload: any = { amount: expense.amount, vendor: expense.vendor, expense_type: expense.expenseType, other_expense_type_specification: expense.otherExpenseTypeSpecification, reason: expense.reason, transaction_id: transactionId, payment_to: expense.paymentTo, paid_to_user: expense.paidToUser, payment_date: expense.paymentDate, payment_at: expense.paymentDate, payment_method: expense.paymentMethod, description: expense.description, category: expense.category, bank_reference: expense.bankReference, evidence_url: expense.evidenceUrl, recorded_by: options?.currentUserId || null };
  const { data, error } = await supabase.from('expenses').insert([payload]).select().single();
  if (error) throw error;
  return mapDbToExpense(data);
}

export async function updateExpense(id: string, updates: Partial<ExpenseEntry>, options?: { currentUserId?: string }): Promise<ExpenseEntry> {
  const payload: any = {};
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.vendor !== undefined) payload.vendor = updates.vendor;
  if (updates.expenseType !== undefined) payload.expense_type = updates.expenseType;
  if (updates.otherExpenseTypeSpecification !== undefined) payload.other_expense_type_specification = updates.otherExpenseTypeSpecification;
  if (updates.reason !== undefined) payload.reason = updates.reason;
  if (updates.transactionId !== undefined) payload.transaction_id = updates.transactionId;
  if (updates.paymentTo !== undefined) payload.payment_to = updates.paymentTo;
  if (updates.paidToUser !== undefined) payload.paid_to_user = updates.paidToUser;
  if (updates.paymentDate !== undefined) { payload.payment_date = updates.paymentDate; payload.payment_at = updates.paymentDate; }
  if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.bankReference !== undefined) payload.bank_reference = updates.bankReference;
  if (updates.evidenceUrl !== undefined) payload.evidence_url = updates.evidenceUrl;
  if (options?.currentUserId) payload.recorded_by = options.currentUserId;
  const { data, error } = await supabase.from('expenses').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return mapDbToExpense(data);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadEvidence(file: File, module: 'income' | 'expenses' | 'contributions'): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${module}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from('evidence').upload(filePath, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('evidence').getPublicUrl(filePath);
  return data.publicUrl;
}
