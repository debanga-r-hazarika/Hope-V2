// Inventory Analytics Types - Part 1 of Analytics Module

export type InventoryType = 'raw_material' | 'recurring_product' | 'produced_goods';

// Current Inventory Report Types
export interface CurrentInventoryByTag {
  tag_id: string;
  tag_key: string;
  tag_name: string;
  default_unit: string;
  current_balance: number;
  item_count: number;
  last_movement_date?: string;
  last_production_date?: string;
}

// Out-of-Stock Report Types
export interface OutOfStockItem {
  inventory_type: InventoryType;
  tag_id: string;
  tag_key: string;
  tag_name: string;
  default_unit: string;
  current_balance: number;
  last_activity_date?: string;
}

// Low-Stock Threshold Configuration
export interface LowStockThreshold {
  id: string;
  inventory_type: InventoryType;
  tag_id: string;
  threshold_quantity: number;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

// Low-Stock Report Types
export interface LowStockItem {
  inventory_type: InventoryType;
  tag_id: string;
  tag_key: string;
  tag_name: string;
  default_unit: string;
  current_balance: number;
  threshold_quantity: number;
  last_activity_date?: string;
  shortage_amount: number;
}

// Consumption Summary Types
export interface ConsumptionSummary {
  tag_id: string;
  tag_key: string;
  tag_name: string;
  default_unit: string;
  consumption_date: string;
  total_consumed: number;
  total_wasted: number;
  consumption_transactions: number;
  waste_transactions: number;
}

// Inventory Analytics Filters
export interface InventoryAnalyticsFilters {
  inventoryType?: InventoryType;
  specificTagId?: string;
  startDate?: string;
  endDate?: string;
  includeZeroBalance?: boolean;
}

// Chart Data Types for Inventory
export interface InventoryChartData {
  tag_name: string;
  value: number;
  unit?: string;
  color?: string;
}

export interface ConsumptionTrendData {
  date: string;
  consumed: number;
  wasted: number;
  tag_name?: string;
}

// Aggregated Inventory Metrics
export interface InventoryMetrics {
  totalItems: number;
  totalValue: number;
  outOfStockCount: number;
  lowStockCount: number;
  averageConsumptionRate: number;
  wastePercentage: number;
}
