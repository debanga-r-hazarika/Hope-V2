export type DateRangePreset = 'today' | 'month' | 'quarter' | 'year' | 'custom';

export type TagType = 'raw_material' | 'recurring_product' | 'produced_goods';

export type PaymentStatusFilter = 'all' | 'paid' | 'pending' | 'partial';

export type ViewMode = 'summary' | 'detailed' | 'comparative';

export interface AnalyticsFilters {
  dateRange: DateRangePreset;
  startDate?: string; // ISO date string for custom range
  endDate?: string; // ISO date string for custom range
  tagType?: TagType;
  specificTagId?: string;
  productType?: string;
  customerType?: string;
  paymentStatus?: PaymentStatusFilter;
  batchRange?: {
    start: string;
    end: string;
  };
  viewMode: ViewMode;
}

// Sales Analytics Types
export interface SalesAnalyticsByTag {
  tag_id: string;
  tag_key: string;
  tag_name: string;
  date: string;
  order_count: number;
  total_quantity_sold: number;
  total_sales_value: number;
  avg_order_value: number;
  payment_collected: number;
  payment_pending: number;
}

export interface SalesMetrics {
  totalSalesValue: number;
  totalQuantitySold: number;
  numberOfOrders: number;
  averageOrderValue: number;
  paymentCollected: number;
  paymentPending: number;
}

// Material & Production Analytics Types
export interface RawMaterialAnalytics {
  tag_id: string;
  tag_key: string;
  tag_name: string;
  date: string;
  total_intake: number;
  total_consumption: number;
  total_waste: number;
  waste_percentage: number;
}

export interface RecurringProductAnalytics {
  tag_id: string;
  tag_key: string;
  tag_name: string;
  date: string;
  batch_id?: string;
  consumption_per_batch: number;
}

export interface ProducedGoodsAnalytics {
  tag_id: string;
  tag_key: string;
  tag_name: string;
  date: string;
  batches_produced: number;
  total_quantity_produced: number;
  total_quantity_available: number;
  total_quantity_sold: number;
  sell_through_rate: number;
}

// Finance Analytics Types
export interface IncomeAnalytics {
  tag_id: string;
  tag_key: string;
  tag_name: string;
  date: string;
  total_income: number;
  income_transactions: number;
}

export interface ExpenseAnalytics {
  tag_id?: string;
  tag_key?: string;
  tag_name?: string;
  date: string;
  total_expense: number;
  expense_transactions: number;
  expense_type: string;
}

export interface CashPosition {
  date: string;
  total_income: number;
  total_expense: number;
  net_position: number;
}

// Financial Verdict Types
export type HealthStatus = 'stable' | 'warning' | 'critical';
export type TrendDirection = 'growing' | 'flat' | 'declining';
export type PressureLevel = 'high' | 'normal' | 'low';
export type InventoryRisk = 'overstock' | 'balanced' | 'shortage';

export interface FinancialVerdict {
  overallHealth: HealthStatus;
  revenueTrend: TrendDirection;
  expensePressure: PressureLevel;
  inventoryRisk: InventoryRisk;
  message: string;
}

// Recommendation Types
export interface Recommendation {
  id: string;
  type: 'waste' | 'sell_through' | 'expense' | 'income' | 'payment' | 'inventory';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  relatedTagId?: string;
  relatedTagName?: string;
  date?: string;
}

// Target Types
export type TargetType = 'sales_count' | 'sales_revenue' | 'product_sales' | 'production_quantity';

export interface AnalyticsTarget {
  id: string;
  target_name: string;
  target_type: TargetType;
  target_value: number;
  tag_type?: TagType;
  tag_id?: string;
  tag_name?: string; // For display
  period_start: string;
  period_end: string;
  status: 'active' | 'completed' | 'cancelled';
  description?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface TargetProgress {
  target: AnalyticsTarget;
  achieved: number;
  remaining: number;
  percentage: number;
  daysRemaining: number;
  isOnTrack: boolean;
}

// Chart Data Types
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TagComparisonDataPoint {
  tag_name: string;
  value: number;
  color?: string;
}
