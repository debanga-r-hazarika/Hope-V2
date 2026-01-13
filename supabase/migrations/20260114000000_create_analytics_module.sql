/*
  # Analytics Module - Unified Analytics & Intelligence
  
  This migration creates:
  1. Analytics targets table (admin-defined targets)
  2. Views for tag-based aggregation
  3. Functions for analytics calculations
  
  All analytics are tag-driven and read-only.
*/

-- ============================================
-- 1. ANALYTICS TARGETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Target definition
  target_name text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('sales_count', 'sales_revenue', 'product_sales', 'production_quantity')),
  
  -- Target value
  target_value numeric(15,2) NOT NULL CHECK (target_value > 0),
  
  -- Tag reference (for product-specific targets)
  tag_type text CHECK (tag_type IN ('raw_material', 'recurring_product', 'produced_goods')),
  tag_id uuid, -- References raw_material_tags, recurring_product_tags, or produced_goods_tags
  
  -- Time period
  period_start date NOT NULL,
  period_end date NOT NULL,
  
  -- Status
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  
  -- Metadata
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- Validation
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_analytics_targets_type ON analytics_targets(target_type);
CREATE INDEX IF NOT EXISTS idx_analytics_targets_tag ON analytics_targets(tag_type, tag_id);
CREATE INDEX IF NOT EXISTS idx_analytics_targets_period ON analytics_targets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_targets_status ON analytics_targets(status);

ALTER TABLE analytics_targets ENABLE ROW LEVEL SECURITY;

-- Only admins can manage targets
CREATE POLICY "Admins can view analytics targets"
  ON analytics_targets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create analytics targets"
  ON analytics_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update analytics targets"
  ON analytics_targets FOR UPDATE
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

CREATE POLICY "Admins can delete analytics targets"
  ON analytics_targets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_analytics_targets_updated_at
  BEFORE UPDATE ON analytics_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. SALES ANALYTICS VIEW (TAG-BASED)
-- ============================================
CREATE OR REPLACE VIEW sales_analytics_by_tag AS
WITH order_payment_totals AS (
  SELECT 
    order_id,
    SUM(amount_received) as total_payment_collected
  FROM order_payments
  GROUP BY order_id
)
SELECT
  pgt.id as tag_id,
  pgt.tag_key,
  pgt.display_name as tag_name,
  DATE_TRUNC('day', o.order_date) as date,
  COUNT(DISTINCT o.id) as order_count,
  SUM(oi.quantity) as total_quantity_sold,
  SUM(oi.line_total) as total_sales_value,
  AVG(oi.line_total / NULLIF(oi.quantity, 0)) as avg_order_value,
  -- Payment status breakdown
  COALESCE(SUM(opt.total_payment_collected), 0) as payment_collected,
  SUM(oi.line_total) - COALESCE(SUM(opt.total_payment_collected), 0) as payment_pending
FROM orders o
INNER JOIN order_items oi ON o.id = oi.order_id
INNER JOIN processed_goods pg ON oi.processed_good_id = pg.id
LEFT JOIN produced_goods_tags pgt ON pg.produced_goods_tag_id = pgt.id
LEFT JOIN order_payment_totals opt ON o.id = opt.order_id
WHERE o.status != 'CANCELLED'
  AND pgt.id IS NOT NULL
GROUP BY pgt.id, pgt.tag_key, pgt.display_name, DATE_TRUNC('day', o.order_date);

-- ============================================
-- 3. MATERIAL & PRODUCTION ANALYTICS VIEWS
-- ============================================

-- Raw Material Analytics (Tag-Based)
CREATE OR REPLACE VIEW raw_material_analytics_by_tag AS
SELECT
  rmt.id as tag_id,
  rmt.tag_key,
  rmt.display_name as tag_name,
  DATE_TRUNC('day', sm.effective_date) as date,
  -- Intake (IN movements)
  SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END) as total_intake,
  -- Consumption (CONSUMPTION movements)
  SUM(CASE WHEN sm.movement_type = 'CONSUMPTION' THEN sm.quantity ELSE 0 END) as total_consumption,
  -- Waste (WASTE movements)
  SUM(CASE WHEN sm.movement_type = 'WASTE' THEN sm.quantity ELSE 0 END) as total_waste,
  -- Waste percentage
  CASE 
    WHEN SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END) > 0 
    THEN (SUM(CASE WHEN sm.movement_type = 'WASTE' THEN sm.quantity ELSE 0 END) / 
          SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END)) * 100
    ELSE 0
  END as waste_percentage
FROM stock_movements sm
INNER JOIN raw_materials rm ON sm.item_reference = rm.id AND sm.item_type = 'raw_material'
LEFT JOIN raw_material_tags rmt ON rm.raw_material_tag_id = rmt.id
WHERE rmt.id IS NOT NULL
GROUP BY rmt.id, rmt.tag_key, rmt.display_name, DATE_TRUNC('day', sm.effective_date);

-- Recurring Product Analytics (Tag-Based)
CREATE OR REPLACE VIEW recurring_product_analytics_by_tag AS
SELECT
  rpt.id as tag_id,
  rpt.tag_key,
  rpt.display_name as tag_name,
  DATE_TRUNC('day', sm.effective_date) as date,
  -- Consumption per batch
  sm.reference_id as batch_id,
  SUM(CASE WHEN sm.movement_type = 'CONSUMPTION' THEN sm.quantity ELSE 0 END) as consumption_per_batch
FROM stock_movements sm
INNER JOIN recurring_products rp ON sm.item_reference = rp.id AND sm.item_type = 'recurring_product'
LEFT JOIN recurring_product_tags rpt ON rp.recurring_product_tag_id = rpt.id
WHERE rpt.id IS NOT NULL
  AND sm.movement_type = 'CONSUMPTION'
GROUP BY rpt.id, rpt.tag_key, rpt.display_name, DATE_TRUNC('day', sm.effective_date), sm.reference_id;

-- Produced Goods Analytics (Tag-Based)
CREATE OR REPLACE VIEW produced_goods_analytics_by_tag AS
WITH delivered_quantities AS (
  SELECT 
    oi.processed_good_id,
    SUM(oi.quantity_delivered) as total_delivered
  FROM order_items oi
  WHERE oi.quantity_delivered > 0
  GROUP BY oi.processed_good_id
)
SELECT
  pgt.id as tag_id,
  pgt.tag_key,
  pgt.display_name as tag_name,
  DATE_TRUNC('day', pg.production_date) as date,
  -- Production metrics
  COUNT(DISTINCT pg.id) as batches_produced,
  SUM(pg.quantity_created) as total_quantity_produced,
  SUM(pg.quantity_available) as total_quantity_available,
  COALESCE(SUM(dq.total_delivered), 0) as total_quantity_sold,
  -- Sell-through rate
  CASE 
    WHEN SUM(pg.quantity_created) > 0 
    THEN (COALESCE(SUM(dq.total_delivered), 0) / SUM(pg.quantity_created)) * 100
    ELSE 0
  END as sell_through_rate
FROM processed_goods pg
LEFT JOIN produced_goods_tags pgt ON pg.produced_goods_tag_id = pgt.id
LEFT JOIN delivered_quantities dq ON pg.id = dq.processed_good_id
WHERE pgt.id IS NOT NULL
GROUP BY pgt.id, pgt.tag_key, pgt.display_name, DATE_TRUNC('day', pg.production_date);

-- ============================================
-- 4. FINANCE ANALYTICS VIEWS
-- ============================================

-- Income Analytics (Sales-Linked Only)
CREATE OR REPLACE VIEW income_analytics_by_tag AS
SELECT
  pgt.id as tag_id,
  pgt.tag_key,
  pgt.display_name as tag_name,
  DATE_TRUNC('day', i.payment_date) as date,
  SUM(i.amount) as total_income,
  COUNT(DISTINCT i.id) as income_transactions
FROM income i
INNER JOIN order_payments op ON i.order_payment_id = op.id
INNER JOIN orders o ON op.order_id = o.id
INNER JOIN order_items oi ON o.id = oi.order_id
INNER JOIN processed_goods pg ON oi.processed_good_id = pg.id
LEFT JOIN produced_goods_tags pgt ON pg.produced_goods_tag_id = pgt.id
WHERE i.income_type = 'sales'
  AND pgt.id IS NOT NULL
GROUP BY pgt.id, pgt.tag_key, pgt.display_name, DATE_TRUNC('day', i.payment_date);

-- Expense Analytics (By Raw Material Tag)
CREATE OR REPLACE VIEW expense_analytics_by_tag AS
SELECT
  rmt.id as tag_id,
  rmt.tag_key,
  rmt.display_name as tag_name,
  DATE_TRUNC('day', e.payment_date) as date,
  SUM(e.amount) as total_expense,
  COUNT(DISTINCT e.id) as expense_transactions,
  e.expense_type
FROM expenses e
LEFT JOIN raw_materials rm ON e.reason LIKE '%' || rm.name || '%' OR e.description LIKE '%' || rm.name || '%'
LEFT JOIN raw_material_tags rmt ON rm.raw_material_tag_id = rmt.id
WHERE e.expense_type = 'raw_material'
  AND rmt.id IS NOT NULL
GROUP BY rmt.id, rmt.tag_key, rmt.display_name, DATE_TRUNC('day', e.payment_date), e.expense_type;

-- Overall Expense Analytics (All Types)
CREATE OR REPLACE VIEW expense_analytics_overall AS
SELECT
  DATE_TRUNC('day', payment_date) as date,
  expense_type,
  SUM(amount) as total_expense,
  COUNT(DISTINCT id) as expense_transactions
FROM expenses
GROUP BY DATE_TRUNC('day', payment_date), expense_type;

-- Cash Position View
CREATE OR REPLACE VIEW cash_position_daily AS
SELECT
  date,
  COALESCE(SUM(income), 0) as total_income,
  COALESCE(SUM(expense), 0) as total_expense,
  COALESCE(SUM(income), 0) - COALESCE(SUM(expense), 0) as net_position
FROM (
  SELECT DATE_TRUNC('day', payment_date) as date, amount as income, 0 as expense
  FROM income
  UNION ALL
  SELECT DATE_TRUNC('day', payment_date) as date, 0 as income, amount as expense
  FROM expenses
) combined
GROUP BY date
ORDER BY date DESC;

-- ============================================
-- 5. COMMENTS
-- ============================================
COMMENT ON TABLE analytics_targets IS 'Admin-defined targets for sales, revenue, and production metrics. Used for tracking progress and performance against goals.';
COMMENT ON VIEW sales_analytics_by_tag IS 'Tag-based sales analytics aggregating orders, quantities, and payment status by produced goods tags';
COMMENT ON VIEW raw_material_analytics_by_tag IS 'Tag-based raw material analytics showing intake, consumption, and waste by tag';
COMMENT ON VIEW recurring_product_analytics_by_tag IS 'Tag-based recurring product consumption analytics by batch';
COMMENT ON VIEW produced_goods_analytics_by_tag IS 'Tag-based produced goods analytics showing production vs sales by tag';
COMMENT ON VIEW income_analytics_by_tag IS 'Tag-based income analytics from sales-linked payments only';
COMMENT ON VIEW expense_analytics_by_tag IS 'Tag-based expense analytics for raw material expenses';
COMMENT ON VIEW cash_position_daily IS 'Daily cash position showing income vs expenses and net position';
