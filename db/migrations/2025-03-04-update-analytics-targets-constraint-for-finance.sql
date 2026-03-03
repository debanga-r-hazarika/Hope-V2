-- Migration: Update analytics_targets constraint to include finance target types
-- Date: 2025-03-04
-- Description: Adds finance target types to the target_type check constraint

-- Drop the existing constraint
ALTER TABLE analytics_targets DROP CONSTRAINT IF EXISTS analytics_targets_target_type_check;

-- Add the updated constraint with all target types
ALTER TABLE analytics_targets ADD CONSTRAINT analytics_targets_target_type_check 
CHECK (target_type = ANY (ARRAY[
  -- Sales target types
  'sales_count'::text,
  'sales_revenue'::text,
  'sales_quantity'::text,
  'product_sales'::text,
  'production_quantity'::text,
  -- Inventory target types
  'stock_level'::text,
  'consumption_limit'::text,
  'waste_reduction'::text,
  'stock_turnover'::text,
  'new_stock_arrival'::text,
  -- Finance target types (NEW)
  'revenue_target'::text,
  'expense_limit'::text,
  'cash_flow_target'::text,
  'profit_margin_target'::text,
  'collection_period_target'::text,
  'expense_ratio_target'::text
]));

-- Update the comment to reflect all supported target types
COMMENT ON COLUMN analytics_targets.target_type IS 
'Type of target: 
Sales: sales_count, sales_revenue, sales_quantity, product_sales, production_quantity
Inventory: stock_level, consumption_limit, waste_reduction, stock_turnover, new_stock_arrival
Finance: revenue_target, expense_limit, cash_flow_target, profit_margin_target, collection_period_target, expense_ratio_target';
