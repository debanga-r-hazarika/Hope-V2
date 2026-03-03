// Sales Targets Types

export interface SalesTarget {
  id: string;
  target_name: string;
  target_type: 'sales_quantity' | 'sales_revenue';
  target_value: number;
  tag_type: 'produced_goods' | null;
  tag_id: string | null;
  tag_name?: string; // Joined from produced_goods_tags
  period_start: string; // Date string YYYY-MM-DD
  period_end: string; // Date string YYYY-MM-DD
  status: 'active' | 'completed' | 'cancelled';
  description: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface SalesTargetFormData {
  target_name: string;
  target_type: 'sales_quantity' | 'sales_revenue';
  target_value: number;
  tag_id: string | null;
  period_start: string;
  period_end: string;
  description: string;
}

export interface SalesTargetProgress {
  target: SalesTarget;
  current_value: number;
  progress_percentage: number;
  is_achieved: boolean;
  remaining_value: number;
  days_remaining: number;
}
