/*
  # Inventory Reports & Analytics - Part 1 of Analytics Module
  
  This migration creates views and functions for inventory-focused analytics:
  1. Current inventory by tag (raw materials, recurring products, produced goods)
  2. Out-of-stock report
  3. Low-stock report (threshold-based)
  4. Consumption summary by tag
  
  All views are read-only and ledger-based.
*/

-- ============================================
-- 1. CURRENT INVENTORY BY TAG
-- ============================================

-- Raw Materials Current Inventory
DROP VIEW IF EXISTS inventory_raw_materials_by_tag CASCADE;

CREATE VIEW inventory_raw_materials_by_tag AS
SELECT
  rmt.id as tag_id,
  rmt.tag_key,
  rmt.display_name as tag_name,
  COALESCE(MAX(rm.unit), 'units') as default_unit,
  rm.usable,
  COALESCE(SUM(
    CASE 
      WHEN sm.movement_type = 'IN' THEN sm.quantity
      WHEN sm.movement_type = 'TRANSFER_IN' THEN sm.quantity
      WHEN sm.movement_type = 'CONSUMPTION' THEN -sm.quantity
      WHEN sm.movement_type = 'WASTE' THEN -sm.quantity
      WHEN sm.movement_type = 'TRANSFER_OUT' THEN -sm.quantity
      ELSE 0
    END
  ), 0) as current_balance,
  COUNT(DISTINCT rm.id) as item_count,
  MAX(sm.effective_date) as last_movement_date
FROM raw_material_tags rmt
LEFT JOIN raw_materials rm ON rm.raw_material_tag_id = rmt.id
LEFT JOIN stock_movements sm ON sm.item_reference = rm.id AND sm.item_type = 'raw_material'
GROUP BY rmt.id, rmt.tag_key, rmt.display_name, rm.usable;

-- Recurring Products Current Inventory
CREATE OR REPLACE VIEW inventory_recurring_products_by_tag AS
SELECT
  rpt.id as tag_id,
  rpt.tag_key,
  rpt.display_name as tag_name,
  COALESCE(MAX(rp.unit), 'units') as default_unit,
  COALESCE(SUM(
    CASE 
      WHEN sm.movement_type = 'IN' THEN sm.quantity
      WHEN sm.movement_type = 'TRANSFER_IN' THEN sm.quantity
      WHEN sm.movement_type = 'CONSUMPTION' THEN -sm.quantity
      WHEN sm.movement_type = 'WASTE' THEN -sm.quantity
      WHEN sm.movement_type = 'TRANSFER_OUT' THEN -sm.quantity
      ELSE 0
    END
  ), 0) as current_balance,
  COUNT(DISTINCT rp.id) as item_count,
  MAX(sm.effective_date) as last_movement_date
FROM recurring_product_tags rpt
LEFT JOIN recurring_products rp ON rp.recurring_product_tag_id = rpt.id
LEFT JOIN stock_movements sm ON sm.item_reference = rp.id AND sm.item_type = 'recurring_product'
GROUP BY rpt.id, rpt.tag_key, rpt.display_name;

-- Produced Goods Current Inventory
CREATE OR REPLACE VIEW inventory_produced_goods_by_tag AS
SELECT
  pgt.id as tag_id,
  pgt.tag_key,
  pgt.display_name as tag_name,
  COALESCE(MAX(pg.unit), 'units') as default_unit,
  COALESCE(SUM(pg.quantity_available), 0) as current_balance,
  COUNT(DISTINCT pg.id) as item_count,
  MAX(pg.production_date) as last_production_date
FROM produced_goods_tags pgt
LEFT JOIN processed_goods pg ON pg.produced_goods_tag_id = pgt.id
GROUP BY pgt.id, pgt.tag_key, pgt.display_name;

-- ============================================
-- 2. OUT-OF-STOCK REPORT
-- ============================================

-- Tags with zero balance across all inventory types
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
-- 3. LOW-STOCK CONFIGURATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_low_stock_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tag reference
  inventory_type text NOT NULL CHECK (inventory_type IN ('raw_material', 'recurring_product', 'produced_goods')),
  tag_id uuid NOT NULL,
  
  -- Threshold configuration
  threshold_quantity numeric NOT NULL CHECK (threshold_quantity >= 0),
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- Ensure one threshold per tag
  UNIQUE(inventory_type, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_low_stock_thresholds_tag ON inventory_low_stock_thresholds(inventory_type, tag_id);

ALTER TABLE inventory_low_stock_thresholds ENABLE ROW LEVEL SECURITY;

-- Admin-only access for threshold configuration
CREATE POLICY "Admins can view low stock thresholds"
  ON inventory_low_stock_thresholds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create low stock thresholds"
  ON inventory_low_stock_thresholds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update low stock thresholds"
  ON inventory_low_stock_thresholds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete low stock thresholds"
  ON inventory_low_stock_thresholds FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_inventory_low_stock_thresholds_updated_at
  BEFORE UPDATE ON inventory_low_stock_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. LOW-STOCK REPORT
-- ============================================

-- Tags below fixed threshold of 10
-- Simple rule: Any tag with balance < 10 is considered low stock
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

-- ============================================
-- 5. CONSUMPTION SUMMARY BY TAG
-- ============================================

-- Raw Materials Consumption Summary
CREATE OR REPLACE VIEW inventory_consumption_raw_materials AS
SELECT
  rmt.id as tag_id,
  rmt.tag_key,
  rmt.display_name as tag_name,
  COALESCE(MAX(rm.unit), 'units') as default_unit,
  DATE_TRUNC('day', sm.effective_date) as consumption_date,
  SUM(CASE WHEN sm.movement_type = 'CONSUMPTION' THEN sm.quantity ELSE 0 END) as total_consumed,
  SUM(CASE WHEN sm.movement_type = 'WASTE' THEN sm.quantity ELSE 0 END) as total_wasted,
  COUNT(DISTINCT sm.id) FILTER (WHERE sm.movement_type = 'CONSUMPTION') as consumption_transactions,
  COUNT(DISTINCT sm.id) FILTER (WHERE sm.movement_type = 'WASTE') as waste_transactions
FROM raw_material_tags rmt
LEFT JOIN raw_materials rm ON rm.raw_material_tag_id = rmt.id
LEFT JOIN stock_movements sm ON sm.item_reference = rm.id AND sm.item_type = 'raw_material'
WHERE sm.movement_type IN ('CONSUMPTION', 'WASTE')
GROUP BY rmt.id, rmt.tag_key, rmt.display_name, DATE_TRUNC('day', sm.effective_date);

-- Recurring Products Consumption Summary
CREATE OR REPLACE VIEW inventory_consumption_recurring_products AS
SELECT
  rpt.id as tag_id,
  rpt.tag_key,
  rpt.display_name as tag_name,
  COALESCE(MAX(rp.unit), 'units') as default_unit,
  DATE_TRUNC('day', sm.effective_date) as consumption_date,
  SUM(CASE WHEN sm.movement_type = 'CONSUMPTION' THEN sm.quantity ELSE 0 END) as total_consumed,
  SUM(CASE WHEN sm.movement_type = 'WASTE' THEN sm.quantity ELSE 0 END) as total_wasted,
  COUNT(DISTINCT sm.id) FILTER (WHERE sm.movement_type = 'CONSUMPTION') as consumption_transactions,
  COUNT(DISTINCT sm.id) FILTER (WHERE sm.movement_type = 'WASTE') as waste_transactions
FROM recurring_product_tags rpt
LEFT JOIN recurring_products rp ON rp.recurring_product_tag_id = rpt.id
LEFT JOIN stock_movements sm ON sm.item_reference = rp.id AND sm.item_type = 'recurring_product'
WHERE sm.movement_type IN ('CONSUMPTION', 'WASTE')
GROUP BY rpt.id, rpt.tag_key, rpt.display_name, DATE_TRUNC('day', sm.effective_date);

-- Produced Goods Consumption Summary (Sales/Deliveries)
CREATE OR REPLACE VIEW inventory_consumption_produced_goods AS
SELECT
  pgt.id as tag_id,
  pgt.tag_key,
  pgt.display_name as tag_name,
  COALESCE(MAX(pg.unit), 'units') as default_unit,
  DATE_TRUNC('day', o.order_date) as consumption_date,
  SUM(oi.quantity) as total_consumed,
  0 as total_wasted,
  COUNT(DISTINCT oi.id) as consumption_transactions,
  0 as waste_transactions
FROM produced_goods_tags pgt
LEFT JOIN processed_goods pg ON pg.produced_goods_tag_id = pgt.id
LEFT JOIN order_items oi ON oi.processed_good_id = pg.id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.status != 'CANCELLED'
GROUP BY pgt.id, pgt.tag_key, pgt.display_name, DATE_TRUNC('day', o.order_date);

-- ============================================
-- 6. COMMENTS
-- ============================================

COMMENT ON VIEW inventory_raw_materials_by_tag IS 'Current inventory balance for raw materials grouped by tag, calculated from stock_movements ledger';
COMMENT ON VIEW inventory_recurring_products_by_tag IS 'Current inventory balance for recurring products grouped by tag, calculated from stock_movements ledger';
COMMENT ON VIEW inventory_produced_goods_by_tag IS 'Current inventory balance for produced goods grouped by tag, calculated from processed_goods.quantity_available';
COMMENT ON VIEW inventory_out_of_stock IS 'Tags with zero or negative balance across all inventory types';
COMMENT ON TABLE inventory_low_stock_thresholds IS 'Admin-configured thresholds for low stock alerts per tag (deprecated - using fixed threshold of 10)';
COMMENT ON VIEW inventory_low_stock IS 'Tags with balance less than 10 (fixed threshold for low stock)';
COMMENT ON VIEW inventory_consumption_raw_materials IS 'Daily consumption and waste summary for raw materials by tag';
COMMENT ON VIEW inventory_consumption_recurring_products IS 'Daily consumption and waste summary for recurring products by tag';
COMMENT ON VIEW inventory_consumption_produced_goods IS 'Daily sales/delivery summary for produced goods by tag';


-- ============================================
-- 7. SCHEMA CACHE RELOAD
-- ============================================

-- Note: After modifying views, PostgREST schema cache should be reloaded
-- This can be done with: NOTIFY pgrst, 'reload schema';
-- Or by restarting the PostgREST service

-- Important: The inventory_raw_materials_by_tag view groups by 'usable' field,
-- which means each tag may appear multiple times (once for usable=true, once for usable=false).
-- This is intentional to support the usable/unusable raw materials feature.
