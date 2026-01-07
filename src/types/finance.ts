export type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card';
export type PaymentTo = 'organization_bank' | 'other_bank_account';

export interface FinanceEntry {
  id: string;
  amount: number;
  reason: string;
  transactionId: string;
  paymentTo: PaymentTo;
  paidToUser?: string | null;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  bankReference?: string | null;
  evidenceUrl?: string | null;
  description?: string | null;
  category?: string | null;
  createdAt: string;
  updatedAt: string;
  recordedBy?: string | null;
}

export interface ContributionEntry extends FinanceEntry {
  contributionType: 'investment' | 'capital' | 'loan' | 'other';
}

export interface IncomeEntry extends FinanceEntry {
  source: string;
  incomeType: 'sales' | 'service' | 'interest' | 'other';
}

export interface ExpenseEntry extends FinanceEntry {
  vendor?: string;
  expenseType: 'operational' | 'salary' | 'utilities' | 'maintenance' | 'other';
}
