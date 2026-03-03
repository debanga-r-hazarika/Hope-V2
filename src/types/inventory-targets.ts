// Inventory Targets Types

import type { InventoryType } from './inventory-analytics';

export type InventoryTargetType = 
  | 'stock_level'          // Minimum stock level to maintain
  | 'consumption_limit'    // Maximum consumption allowed in period
  | 'waste_reduction'      // Target waste percentage
  | 'stock_turnover'       // Target turnover rate
  | 'new_stock_arrival';   // Target for new inventory additions

export interface InventoryTarget {
  id: string;
  target_name: string;
  target_type: InventoryTargetType;
  target_value: number;
  tag_type: InventoryType | null;  // raw_material, recurring_product, produced_goods
  tag_id: string | null;
  tag_name?: string; // Joined from tags table
  period_start: string; // Date string YYYY-MM-DD
  period_end: string; // Date string YYYY-MM-DD
  status: 'active' | 'completed' | 'cancelled';
  description: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface InventoryTargetFormData {
  target_name: string;
  target_type: InventoryTargetType;
  target_value: number;
  tag_type: InventoryType | null;
  tag_id: string | null;
  period_start: string;
  period_end: string;
  description: string;
}

export interface InventoryTargetProgress {
  target: InventoryTarget;
  current_value: number;
  progress_percentage: number;
  is_achieved: boolean;
  remaining_value: number;
  days_remaining: number;
  status_message?: string; // Additional context about the target status
}
