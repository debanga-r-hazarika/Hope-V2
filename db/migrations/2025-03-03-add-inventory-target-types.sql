-- Add inventory target types to analytics_targets table
-- Existing types: sales_quantity, sales_revenue, sales_count, product_sales, production_quantity
-- New types: stock_level, consumption_limit, waste_reduction, stock_turnover

ALTER TABLE analytics_targets DROP CONSTRAINT IF EXISTS analytics_targets_target_type_check;

ALTER TABLE analytics_targets ADD CONSTRAINT analytics_targets_target_type_check
  CHECK (target_type IN (
    'sales_count',
    'sales_revenue',
    'sales_quantity',
    'product_sales',
    'production_quantity',
    'stock_level',          -- Minimum stock level to maintain
    'consumption_limit',    -- Maximum consumption allowed
    'waste_reduction',      -- Target waste percentage
    'stock_turnover'        -- Target turnover rate
  ));

-- Update tag_type constraint to include all inventory types
ALTER TABLE analytics_targets DROP CONSTRAINT IF EXISTS analytics_targets_tag_type_check;

ALTER TABLE analytics_targets ADD CONSTRAINT analytics_targets_tag_type_check
  CHECK (tag_type IN ('raw_material', 'recurring_product', 'produced_goods') OR tag_type IS NULL);

-- Add comments for new target types
COMMENT ON COLUMN analytics_targets.target_type IS
  'Type of target: sales_quantity (units sold), sales_revenue (revenue target), sales_count (order count), product_sales (product-specific), production_quantity (production target), stock_level (minimum stock to maintain), consumption_limit (max consumption allowed), waste_reduction (target waste %), stock_turnover (turnover rate)';

COMMENT ON COLUMN analytics_targets.tag_type IS
  'Type of tag: raw_material, recurring_product, or produced_goods. Used to link targets to specific inventory items.';

-- Add index for inventory-related queries
CREATE INDEX IF NOT EXISTS idx_analytics_targets_inventory_type
  ON analytics_targets(target_type, tag_type, status)
  WHERE target_type IN ('stock_level', 'consumption_limit', 'waste_reduction', 'stock_turnover');
