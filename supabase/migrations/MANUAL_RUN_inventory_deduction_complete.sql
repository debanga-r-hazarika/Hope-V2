/*
  ============================================================================
  COMPLETE INVENTORY DEDUCTION MIGRATION
  ============================================================================
  
  Run this script in Supabase Dashboard > SQL Editor
  
  This migration implements:
  1. Immediate inventory deduction when order items are added
  2. Optional third-party delivery tracking
  3. Full backward compatibility with existing orders
  
  IMPORTANT: All existing orders are protected and will NOT be affected
  ============================================================================
*/

-- ============================================================================
-- PART 1: Schema Changes
-- ============================================================================

-- Add new fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS third_party_delivery_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_before_migration boolean DEFAULT false;

-- Mark all existing orders as created before migration (PROTECTS EXISTING DATA)
UPDATE orders
SET created_before_migration = true
WHERE created_before_migration = false;

-- Update order status constraint to support new status values
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'DRAFT', 'CONFIRMED', 'ORDER_COMPLETED', 'CANCELLED',
  'Draft', 'Confirmed', 'Partially Delivered', 'Fully Delivered', 
  'READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERY_COMPLETED'
));

-- Add documentation comments
COMMENT ON COLUMN orders.created_before_migration IS 
'Flag to identify orders created before inventory deduction migration. Orders with this flag set to true will not have new inventory deduction logic applied.';

COMMENT ON COLUMN orders.third_party_delivery_enabled IS 
'Flag to enable optional third-party delivery tracking for this order. When enabled, users can record delivery information without affecting inventory.';

-- ============================================================================
-- PART 2: Third-Party Delivery Tracking Tables
-- ============================================================================

-- Create third_party_deliveries table
CREATE TABLE IF NOT EXISTS third_party_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  quantity_delivered numeric CHECK (quantity_delivered >= 0),
  delivery_partner_name text,
  delivery_notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(order_id)
);

-- Create third_party_delivery_documents table
CREATE TABLE IF NOT EXISTS third_party_delivery_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  third_party_delivery_id uuid REFERENCES third_party_deliveries(id) ON DELETE CASCADE NOT NULL,
  document_url text NOT NULL,
  document_name text NOT NULL,
  document_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_third_party_deliveries_order ON third_party_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_third_party_delivery_documents_delivery ON third_party_delivery_documents(third_party_delivery_id);

-- Enable RLS
ALTER TABLE third_party_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE third_party_delivery_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for third_party_deliveries
DROP POLICY IF EXISTS "Users with sales access can view third-party deliveries" ON third_party_deliveries;
CREATE POLICY "Users with sales access can view third-party deliveries"
  ON third_party_deliveries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = third_party_deliveries.order_id
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

DROP POLICY IF EXISTS "Users with read-write access can manage third-party deliveries" ON third_party_deliveries;
CREATE POLICY "Users with read-write access can manage third-party deliveries"
  ON third_party_deliveries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = third_party_deliveries.order_id
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = third_party_deliveries.order_id
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

-- RLS Policies for third_party_delivery_documents
DROP POLICY IF EXISTS "Users with sales access can view delivery documents" ON third_party_delivery_documents;
CREATE POLICY "Users with sales access can view delivery documents"
  ON third_party_delivery_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM third_party_deliveries tpd
      JOIN orders o ON o.id = tpd.order_id
      WHERE tpd.id = third_party_delivery_documents.third_party_delivery_id
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

DROP POLICY IF EXISTS "Users with read-write access can manage delivery documents" ON third_party_delivery_documents;
CREATE POLICY "Users with read-write access can manage delivery documents"
  ON third_party_delivery_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM third_party_deliveries tpd
      JOIN orders o ON o.id = tpd.order_id
      WHERE tpd.id = third_party_delivery_documents.third_party_delivery_id
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM third_party_deliveries tpd
      JOIN orders o ON o.id = tpd.order_id
      WHERE tpd.id = third_party_delivery_documents.third_party_delivery_id
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_third_party_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_third_party_deliveries_updated_at ON third_party_deliveries;
CREATE TRIGGER update_third_party_deliveries_updated_at
  BEFORE UPDATE ON third_party_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_third_party_deliveries_updated_at();

-- Add comments
COMMENT ON TABLE third_party_deliveries IS 
'Tracks third-party delivery information for orders. This is for record-keeping only and does NOT affect inventory.';

COMMENT ON TABLE third_party_delivery_documents IS 
'Links delivery records to uploaded documents (delivery slips, proof of delivery, etc.)';

-- ============================================================================
-- PART 3: Inventory Deduction Functions and Triggers
-- ============================================================================

-- Create inventory_changes_log table for audit trail
CREATE TABLE IF NOT EXISTS inventory_changes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_good_id uuid REFERENCES processed_goods(id) ON DELETE SET NULL,
  quantity_change numeric NOT NULL,
  operation_type text NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_changes_log_processed_good ON inventory_changes_log(processed_good_id);
CREATE INDEX IF NOT EXISTS idx_inventory_changes_log_order ON inventory_changes_log(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_changes_log_created_at ON inventory_changes_log(created_at DESC);

-- Enable RLS
ALTER TABLE inventory_changes_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy for inventory_changes_log
DROP POLICY IF EXISTS "Users with operations access can view inventory changes" ON inventory_changes_log;
CREATE POLICY "Users with operations access can view inventory changes"
  ON inventory_changes_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'sales')
      AND uma.access_level IN ('read-only', 'read-write')
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to log inventory changes
CREATE OR REPLACE FUNCTION log_inventory_change(
  p_processed_good_id uuid,
  p_quantity_change numeric,
  p_operation_type text,
  p_order_id uuid DEFAULT NULL,
  p_order_item_id uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO inventory_changes_log (
    processed_good_id,
    quantity_change,
    operation_type,
    order_id,
    order_item_id,
    created_by
  )
  VALUES (
    p_processed_good_id,
    p_quantity_change,
    p_operation_type,
    p_order_id,
    p_order_item_id,
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if order can be modified
CREATE OR REPLACE FUNCTION can_modify_order(p_order_id uuid)
RETURNS boolean AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT 
    is_locked,
    created_before_migration,
    status
  INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  IF v_order.is_locked THEN
    RETURN false;
  END IF;
  
  IF v_order.created_before_migration THEN
    RETURN false;
  END IF;
  
  IF v_order.status = 'CANCELLED' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct inventory (called when order item is added)
CREATE OR REPLACE FUNCTION deduct_inventory_on_order_item_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_order RECORD;
  v_available numeric;
BEGIN
  SELECT 
    created_before_migration,
    is_locked,
    status
  INTO v_order
  FROM orders
  WHERE id = NEW.order_id;
  
  -- Only apply new logic to orders created after migration
  IF v_order.created_before_migration THEN
    RETURN NEW;
  END IF;
  
  SELECT quantity_available INTO v_available
  FROM processed_goods
  WHERE id = NEW.processed_good_id;
  
  IF v_available < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient inventory. Available: %, Required: %', v_available, NEW.quantity;
  END IF;
  
  UPDATE processed_goods
  SET quantity_available = quantity_available - NEW.quantity
  WHERE id = NEW.processed_good_id;
  
  PERFORM log_inventory_change(
    NEW.processed_good_id,
    -NEW.quantity,
    'ORDER_ITEM_ADDED',
    NEW.order_id,
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to adjust inventory (called when order item quantity is updated)
CREATE OR REPLACE FUNCTION adjust_inventory_on_order_item_update()
RETURNS TRIGGER AS $$
DECLARE
  v_order RECORD;
  v_available numeric;
  v_quantity_diff numeric;
BEGIN
  SELECT 
    created_before_migration,
    is_locked,
    status
  INTO v_order
  FROM orders
  WHERE id = NEW.order_id;
  
  IF v_order.created_before_migration THEN
    RETURN NEW;
  END IF;
  
  v_quantity_diff := NEW.quantity - OLD.quantity;
  
  IF v_quantity_diff > 0 THEN
    SELECT quantity_available INTO v_available
    FROM processed_goods
    WHERE id = NEW.processed_good_id;
    
    IF v_available < v_quantity_diff THEN
      RAISE EXCEPTION 'Insufficient inventory. Available: %, Required: %', v_available, v_quantity_diff;
    END IF;
    
    UPDATE processed_goods
    SET quantity_available = quantity_available - v_quantity_diff
    WHERE id = NEW.processed_good_id;
    
    PERFORM log_inventory_change(
      NEW.processed_good_id,
      -v_quantity_diff,
      'ORDER_ITEM_QUANTITY_INCREASED',
      NEW.order_id,
      NEW.id
    );
  
  ELSIF v_quantity_diff < 0 THEN
    UPDATE processed_goods
    SET quantity_available = quantity_available + ABS(v_quantity_diff)
    WHERE id = NEW.processed_good_id;
    
    PERFORM log_inventory_change(
      NEW.processed_good_id,
      ABS(v_quantity_diff),
      'ORDER_ITEM_QUANTITY_DECREASED',
      NEW.order_id,
      NEW.id
    );
  END IF;
  
  IF NEW.processed_good_id != OLD.processed_good_id THEN
    UPDATE processed_goods
    SET quantity_available = quantity_available + OLD.quantity
    WHERE id = OLD.processed_good_id;
    
    PERFORM log_inventory_change(
      OLD.processed_good_id,
      OLD.quantity,
      'ORDER_ITEM_PRODUCT_CHANGED_RESTORE',
      NEW.order_id,
      NEW.id
    );
    
    SELECT quantity_available INTO v_available
    FROM processed_goods
    WHERE id = NEW.processed_good_id;
    
    IF v_available < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient inventory for new product. Available: %, Required: %', v_available, NEW.quantity;
    END IF;
    
    UPDATE processed_goods
    SET quantity_available = quantity_available - NEW.quantity
    WHERE id = NEW.processed_good_id;
    
    PERFORM log_inventory_change(
      NEW.processed_good_id,
      -NEW.quantity,
      'ORDER_ITEM_PRODUCT_CHANGED_DEDUCT',
      NEW.order_id,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore inventory (called when order item is deleted)
CREATE OR REPLACE FUNCTION restore_inventory_on_order_item_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT 
    created_before_migration,
    is_locked,
    status
  INTO v_order
  FROM orders
  WHERE id = OLD.order_id;
  
  IF v_order.created_before_migration THEN
    RETURN OLD;
  END IF;
  
  UPDATE processed_goods
  SET quantity_available = quantity_available + OLD.quantity
  WHERE id = OLD.processed_good_id;
  
  PERFORM log_inventory_change(
    OLD.processed_good_id,
    OLD.quantity,
    'ORDER_ITEM_DELETED',
    OLD.order_id,
    OLD.id
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore all inventory when order is cancelled
CREATE OR REPLACE FUNCTION restore_inventory_on_order_cancel()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    IF NOT NEW.created_before_migration THEN
      FOR v_item IN 
        SELECT id, processed_good_id, quantity
        FROM order_items
        WHERE order_id = NEW.id
      LOOP
        UPDATE processed_goods
        SET quantity_available = quantity_available + v_item.quantity
        WHERE id = v_item.processed_good_id;
        
        PERFORM log_inventory_change(
          v_item.processed_good_id,
          v_item.quantity,
          'ORDER_CANCELLED',
          NEW.id,
          v_item.id
        );
      END LOOP;
    END IF;
    
    DELETE FROM order_reservations WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for inventory management
DROP TRIGGER IF EXISTS deduct_inventory_on_order_item_insert_trigger ON order_items;
CREATE TRIGGER deduct_inventory_on_order_item_insert_trigger
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION deduct_inventory_on_order_item_insert();

DROP TRIGGER IF EXISTS adjust_inventory_on_order_item_update_trigger ON order_items;
CREATE TRIGGER adjust_inventory_on_order_item_update_trigger
  AFTER UPDATE OF quantity, processed_good_id ON order_items
  FOR EACH ROW
  WHEN (NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.processed_good_id IS DISTINCT FROM OLD.processed_good_id)
  EXECUTE FUNCTION adjust_inventory_on_order_item_update();

DROP TRIGGER IF EXISTS restore_inventory_on_order_item_delete_trigger ON order_items;
CREATE TRIGGER restore_inventory_on_order_item_delete_trigger
  AFTER DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION restore_inventory_on_order_item_delete();

DROP TRIGGER IF EXISTS restore_inventory_on_order_cancel_trigger ON orders;
CREATE TRIGGER restore_inventory_on_order_cancel_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED')
  EXECUTE FUNCTION restore_inventory_on_order_cancel();

-- Add comments
COMMENT ON TABLE inventory_changes_log IS 
'Audit log for all inventory changes related to orders. Tracks when inventory is deducted or restored.';

COMMENT ON FUNCTION can_modify_order IS 
'Checks if an order can be modified based on its lock status, migration flag, and current status.';

COMMENT ON FUNCTION log_inventory_change IS 
'Logs inventory changes to the audit trail for tracking and debugging purposes.';

-- ============================================================================
-- PART 4: Disable Old Delivery-Based Inventory Triggers
-- ============================================================================

-- Drop the old inventory deduction trigger
DROP TRIGGER IF EXISTS reduce_inventory_on_delivery_trigger ON order_items;

-- Drop the old delivery-based order status update triggers
DROP TRIGGER IF EXISTS update_order_status_on_delivery ON order_items;
DROP TRIGGER IF EXISTS update_order_status_on_delivery_v2 ON order_items;

-- Mark old function as deprecated
COMMENT ON FUNCTION reduce_inventory_on_delivery IS 
'DEPRECATED: This function is no longer triggered. Inventory is now deducted when order items are added, not when delivered. Kept for backward compatibility only.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '1. Added third_party_delivery_enabled and created_before_migration fields to orders';
  RAISE NOTICE '2. Created third_party_deliveries and third_party_delivery_documents tables';
  RAISE NOTICE '3. Created inventory_changes_log table for audit trail';
  RAISE NOTICE '4. Created inventory deduction triggers for new orders';
  RAISE NOTICE '5. Disabled old delivery-based inventory triggers';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: All existing orders are protected (created_before_migration = true)';
  RAISE NOTICE 'New orders will have inventory deducted immediately when items are added';
  RAISE NOTICE '============================================================================';
END $$;
