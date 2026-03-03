// Finance Targets Types

export type FinanceTargetType = 
  | 'revenue_target'           // Target total revenue
  | 'expense_limit'            // Maximum expenses allowed
  | 'cash_flow_target'         // Target net cash flow
  | 'profit_margin_target'     // Target profit margin %
  | 'collection_period_target' // Target avg collection period (days)
  | 'expense_ratio_target';    // Target expense-to-revenue ratio

export interface FinanceTarget {
  id: string;
  target_name: string;
  target_type: FinanceTargetType;
  target_value: number;
  period_start: string;
  period_end: string;
  description: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  // Finance targets don't use tag_type or tag_id
  tag_type: null;
  tag_id: null;
}

export interface FinanceTargetFormData {
  target_name: string;
  target_type: FinanceTargetType;
  target_value: number;
  period_start: string;
  period_end: string;
  description?: string;
}

export interface FinanceTargetProgress {
  target: FinanceTarget;
  current_value: number;
  progress_percentage: number;
  is_achieved: boolean;
  remaining_value: number;
  days_remaining: number;
  status_message: string;
}
