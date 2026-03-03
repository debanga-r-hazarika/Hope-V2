-- Add new_stock_arrival target type to analytics_targets table
-- This target tracks the amount of new inventory added during a period

ALTER TABLE analytics_targets DROP CONSTRAINT IF EXISTS analytics_targets_target_type_check;

ALTER TABLE analytics_targets ADD CONSTRAINT analytics_targets_target_type_check
  CHECK (target_type IN (
    'sales_count',
    'sales_revenue',
    'sales_quantity',
    'product_sales',
    'production_quantity',
    'stock_level',
    'consumption_limit',
    'waste_reduction',
    'stock_turnover',
    'new_stock_arrival'     -- Target for new inventory additions
  ));

-- Update comment
COMMENT ON COLUMN analytics_targets.target_type IS
  'Type of target: sales_quantity (units sold), sales_revenue (revenue target), sales_count (order count), product_sales (product-specific), production_quantity (production target), stock_level (minimum stock to maintain), consumption_limit (max consumption allowed), waste_reduction (target waste %), stock_turnover (turnover rate), new_stock_arrival (new inventory additions)';

-- Update index to include new target type
DROP INDEX IF EXISTS idx_analytics_targets_inventory_type;

CREATE INDEX idx_analytics_targets_inventory_type
  ON analytics_targets(target_type, tag_type, status)
  WHERE target_type IN ('stock_level', 'consumption_limit', 'waste_reduction', 'stock_turnover', 'new_stock_arrival');
