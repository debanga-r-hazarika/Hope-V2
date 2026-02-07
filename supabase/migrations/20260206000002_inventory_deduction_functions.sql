/*
  # Inventory Deduction Functions
  
  This migration creates database functions for:
  1. Inventory deduction when order items are added
  2. Inventory restoration when order items are deleted or orders cancelled
  3. Audit logging for inventory changes
  4. Order modification validation
*/

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

-- RLS Policy for inventory_changes_log (read-only for users with operations access)
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
  
  -- Order not found
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Cannot modify locked orders
  IF v_order.is_locked THEN
    RETURN false;
  END IF;
  
  -- Cannot modify orders created before migration
  IF v_order.created_before_migration THEN
    RETURN false;
  END IF;
  
  -- Cannot modify cancelled orders
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
  -- Get order details
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
  
  -- Get current available quantity
  SELECT quantity_available INTO v_available
  FROM processed_goods
  WHERE id = NEW.processed_good_id;
  
  -- Check if sufficient inventory
  IF v_available < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient inventory. Available: %, Required: %', v_available, NEW.quantity;
  END IF;
  
  -- Deduct inventory
  UPDATE processed_goods
  SET quantity_available = quantity_available - NEW.quantity
  WHERE id = NEW.processed_good_id;
  
  -- Log the change
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
  -- Get order details
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
  
  -- Calculate quantity difference
  v_quantity_diff := NEW.quantity - OLD.quantity;
  
  -- If quantity increased, deduct more inventory
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
  
  -- If quantity decreased, restore inventory
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
  
  -- If processed_good_id changed, restore old and deduct new
  IF NEW.processed_good_id != OLD.processed_good_id THEN
    -- Restore old inventory
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
    
    -- Deduct new inventory
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
  -- Get order details
  SELECT 
    created_before_migration,
    is_locked,
    status
  INTO v_order
  FROM orders
  WHERE id = OLD.order_id;
  
  -- Only apply new logic to orders created after migration
  IF v_order.created_before_migration THEN
    RETURN OLD;
  END IF;
  
  -- Restore inventory
  UPDATE processed_goods
  SET quantity_available = quantity_available + OLD.quantity
  WHERE id = OLD.processed_good_id;
  
  -- Log the change
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
  -- Only process if order is being cancelled
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    -- Only apply new logic to orders created after migration
    IF NOT NEW.created_before_migration THEN
      -- Restore inventory for all order items
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
    
    -- Delete reservations (for backward compatibility)
    DELETE FROM order_reservations WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for inventory management
CREATE TRIGGER deduct_inventory_on_order_item_insert_trigger
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION deduct_inventory_on_order_item_insert();

CREATE TRIGGER adjust_inventory_on_order_item_update_trigger
  AFTER UPDATE OF quantity, processed_good_id ON order_items
  FOR EACH ROW
  WHEN (NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.processed_good_id IS DISTINCT FROM OLD.processed_good_id)
  EXECUTE FUNCTION adjust_inventory_on_order_item_update();

CREATE TRIGGER restore_inventory_on_order_item_delete_trigger
  AFTER DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION restore_inventory_on_order_item_delete();

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
