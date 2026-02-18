-- Recreate inventory_out_of_stock and inventory_low_stock views
-- These were CASCADE dropped when inventory_produced_goods_by_tag was recreated

-- ============================================
-- OUT OF STOCK VIEW
-- ============================================

CREATE OR REPLACE VIEW inventory_out_of_stock AS
SELECT 
  'raw_material' as inventory_type,
  tag_id,
  tag_key,
  tag_name,
  default_unit,
  current_balance,
  last_movement_date as last_activity_date
FROM inventory_raw_materials_by_tag
WHERE current_balance <= 0

UNION ALL

SELECT 
  'recurring_product' as inventory_type,
  tag_id,
  tag_key,
  tag_name,
  default_unit,
  current_balance,
  last_movement_date as last_activity_date
FROM inventory_recurring_products_by_tag
WHERE current_balance <= 0

UNION ALL

SELECT 
  'produced_goods' as inventory_type,
  tag_id,
  tag_key,
  tag_name,
  default_unit,
  current_balance,
  last_production_date as last_activity_date
FROM inventory_produced_goods_by_tag
WHERE current_balance <= 0;

-- ============================================
-- LOW STOCK VIEW
-- ============================================

CREATE OR REPLACE VIEW inventory_low_stock AS
WITH raw_material_low AS (
  SELECT 
    'raw_material' as inventory_type,
    inv.tag_id,
    inv.tag_key,
    inv.tag_name,
    inv.default_unit,
    inv.current_balance,
    10::numeric as threshold_quantity,
    inv.last_movement_date as last_activity_date,
    (10 - inv.current_balance) as shortage_amount
  FROM inventory_raw_materials_by_tag inv
  WHERE inv.current_balance < 10
    AND inv.current_balance > 0
),
recurring_product_low AS (
  SELECT 
    'recurring_product' as inventory_type,
    inv.tag_id,
    inv.tag_key,
    inv.tag_name,
    inv.default_unit,
    inv.current_balance,
    10::numeric as threshold_quantity,
    inv.last_movement_date as last_activity_date,
    (10 - inv.current_balance) as shortage_amount
  FROM inventory_recurring_products_by_tag inv
  WHERE inv.current_balance < 10
    AND inv.current_balance > 0
),
produced_goods_low AS (
  SELECT 
    'produced_goods' as inventory_type,
    inv.tag_id,
    inv.tag_key,
    inv.tag_name,
    inv.default_unit,
    inv.current_balance,
    10::numeric as threshold_quantity,
    inv.last_production_date as last_activity_date,
    (10 - inv.current_balance) as shortage_amount
  FROM inventory_produced_goods_by_tag inv
  WHERE inv.current_balance < 10
    AND inv.current_balance > 0
)
SELECT * FROM raw_material_low
UNION ALL
SELECT * FROM recurring_product_low
UNION ALL
SELECT * FROM produced_goods_low;

-- Add comments
COMMENT ON VIEW inventory_out_of_stock IS 'Tags with zero or negative balance across all inventory types';
COMMENT ON VIEW inventory_low_stock IS 'Tags with balance less than 10 (fixed threshold for low stock)';
