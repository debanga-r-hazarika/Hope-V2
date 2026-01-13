/*
  # Dispatch & Delivery - Inventory Reduction
  
  This migration adds inventory reduction logic that:
  1. Reduces processed_goods.quantity_available ONLY when delivery is recorded
  2. Handles partial deliveries correctly
  3. Tracks delivery history for audit
  4. Ensures inventory is never reduced on order creation, only on delivery
*/

-- Create delivery_dispatches table for tracking delivery history
CREATE TABLE IF NOT EXISTS delivery_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id) ON DELETE CASCADE,
  processed_good_id uuid REFERENCES processed_goods(id) ON DELETE RESTRICT,
  quantity_delivered numeric NOT NULL CHECK (quantity_delivered > 0),
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes for delivery_dispatches
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_order ON delivery_dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_item ON delivery_dispatches(order_item_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_processed_good ON delivery_dispatches(processed_good_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_date ON delivery_dispatches(delivery_date DESC);

-- Enable RLS
ALTER TABLE delivery_dispatches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_dispatches
CREATE POLICY "Users with sales access can view delivery dispatches"
  ON delivery_dispatches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = delivery_dispatches.order_id
      AND EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level IN ('read-only', 'read-write')
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users with read-write access can insert delivery dispatches"
  ON delivery_dispatches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = delivery_dispatches.order_id
      AND EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level = 'read-write'
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to reduce inventory when delivery is recorded
CREATE OR REPLACE FUNCTION reduce_inventory_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  old_delivered numeric;
  new_delivered numeric;
  delivery_difference numeric;
  current_available numeric;
BEGIN
  -- Get old and new delivered quantities
  -- For INSERT, OLD is NULL, so use 0
  old_delivered := COALESCE(OLD.quantity_delivered, 0);
  new_delivered := COALESCE(NEW.quantity_delivered, 0);
  
  -- Calculate the difference (how much more was delivered)
  delivery_difference := new_delivered - old_delivered;
  
  -- Only proceed if delivery increased
  IF delivery_difference > 0 THEN
    -- Get current available quantity
    SELECT quantity_available INTO current_available
    FROM processed_goods
    WHERE id = NEW.processed_good_id;
    
    -- Validate we have enough inventory
    IF current_available < delivery_difference THEN
      RAISE EXCEPTION 'Insufficient inventory. Available: %, Required: %', 
        current_available, delivery_difference;
    END IF;
    
    -- Reduce the inventory by the delivery difference
    UPDATE processed_goods
    SET quantity_available = quantity_available - delivery_difference
    WHERE id = NEW.processed_good_id;
    
    -- Create delivery dispatch record for audit (only if this is an UPDATE, not initial INSERT)
    -- For INSERT, we'll create the dispatch record separately if needed
    IF OLD IS NOT NULL THEN
      INSERT INTO delivery_dispatches (
        order_id,
        order_item_id,
        processed_good_id,
        quantity_delivered,
        delivery_date,
        created_by
      )
      VALUES (
        NEW.order_id,
        NEW.id,
        NEW.processed_good_id,
        delivery_difference,
        CURRENT_DATE,
        auth.uid()
      );
    END IF;
  END IF;
  
  -- Handle case where delivery is reduced (shouldn't happen normally, but handle it)
  IF delivery_difference < 0 THEN
    -- Increase inventory back by the difference
    UPDATE processed_goods
    SET quantity_available = quantity_available + ABS(delivery_difference)
    WHERE id = NEW.processed_good_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to reduce inventory when quantity_delivered is updated
-- This is the main trigger that handles delivery updates
CREATE TRIGGER reduce_inventory_on_delivery_trigger
  AFTER UPDATE OF quantity_delivered ON order_items
  FOR EACH ROW
  WHEN (NEW.quantity_delivered IS DISTINCT FROM OLD.quantity_delivered)
  EXECUTE FUNCTION reduce_inventory_on_delivery();

-- Function to handle order cancellation - release reservations but don't restore delivered inventory
CREATE OR REPLACE FUNCTION handle_order_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  -- When order is cancelled, delete reservations (inventory was never reduced for reserved items)
  -- Note: Delivered items' inventory was already reduced, so we don't restore it
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    DELETE FROM order_reservations WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to handle order cancellation
CREATE TRIGGER handle_order_cancellation_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED')
  EXECUTE FUNCTION handle_order_cancellation();
