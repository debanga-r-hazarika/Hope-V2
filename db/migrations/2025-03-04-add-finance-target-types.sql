-- Migration: Add Finance Target Types to analytics_targets table
-- Date: 2025-03-04
-- Description: Extends the analytics_targets table to support finance-specific target types

-- Add new target_type values for finance targets
-- The analytics_targets table already exists and is used by sales and inventory targets
-- We're just adding new allowed values for the target_type column

-- Finance Target Types:
-- 1. 'revenue_target' - Target total revenue for a period
-- 2. 'expense_limit' - Maximum total expenses allowed for a period
-- 3. 'cash_flow_target' - Target net cash flow (income - expenses)
-- 4. 'profit_margin_target' - Target profit margin percentage (operational or gross)
-- 5. 'collection_period_target' - Target average collection period in days
-- 6. 'expense_ratio_target' - Target expense-to-revenue ratio

-- Note: The existing analytics_targets table structure supports these new types:
-- - target_type: Will store the finance target type
-- - target_value: Will store the numeric target (revenue amount, days, percentage, etc.)
-- - tag_type: Not used for finance targets (will be NULL)
-- - tag_id: Not used for finance targets (will be NULL)
-- - period_start/period_end: Define the target period
-- - status: active, completed, cancelled
-- - created_by/updated_by: Track who manages the target

-- The table already has proper RLS policies from:
-- db/migrations/2025-03-03-add-analytics-targets-module-access-policies.sql

-- No schema changes needed - just documenting the new target types
-- The application logic will handle these new types

COMMENT ON COLUMN analytics_targets.target_type IS 
'Type of target: sales_quantity, sales_revenue (sales), stock_level, consumption_limit, waste_reduction, stock_turnover, new_stock_arrival (inventory), revenue_target, expense_limit, cash_flow_target, profit_margin_target, collection_period_target, expense_ratio_target (finance)';
