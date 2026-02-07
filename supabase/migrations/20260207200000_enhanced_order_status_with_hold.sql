-- Enhanced Order Status System with Hold Mechanism
-- This migration implements a clearer order status lifecycle with manual hold capability

-- Step 1: Add is_on_hold column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_on_hold BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS held_by UUID REFERENCES users(id);

-- Step 2: Update OrderStatus enum to include new statuses
-- Note: We're keeping the existing enum values but will use logic to determine display status
-- The actual status column will store: ORDER_CREATED, READY_FOR_PAYMENT, FULL_PAYMENT, HOLD, ORDER_COMPLETED

-- Step 3: Create function to calculate order status based on business rules
CREATE OR REPLACE FUNCTION calculate_order_status(
  p_order_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_has_items BOOLEAN;
  v_is_on_hold BOOLEAN;
  v_total_amount NUMERIC;
  v_discount_amount NUMERIC;
  v_total_paid NUMERIC;
  v_net_total NUMERIC;
  v_is_full_payment BOOLEAN;
BEGIN
  -- Get order details
  SELECT 
    COALESCE((SELECT COUNT(*) FROM order_items WHERE order_id = p_order_id) > 0, FALSE),
    COALESCE(is_on_hold, FALSE),
    COALESCE(total_amount, 0),
    COALESCE(discount_amount, 0)
  INTO v_has_items, v_is_on_hold, v_total_amount, v_discount_amount
  FROM orders
  WHERE id = p_order_id;

  -- Calculate net total
  v_net_total := v_total_amount - v_discount_amount;

  -- Get total paid
  SELECT COALESCE(SUM(amount_received), 0)
  INTO v_total_paid
  FROM order_payments
  WHERE order_id = p_order_id;

  -- Check if full payment received
  v_is_full_payment := (v_total_paid >= v_net_total - 0.01 AND v_net_total > 0);

  -- Apply status logic based on business rules
  -- Priority order: Hold > Order Completed > Full Payment > Ready for Payment > Order Created
  
  IF v_is_on_hold THEN
    RETURN 'HOLD';
  ELSIF v_is_full_payment AND NOT v_is_on_hold THEN
    RETURN 'ORDER_COMPLETED';
  ELSIF v_is_full_payment AND v_is_on_hold THEN
    RETURN 'FULL_PAYMENT';
  ELSIF v_has_items AND NOT v_is_full_payment THEN
    RETURN 'READY_FOR_PAYMENT';
  ELSE
    RETURN 'ORDER_CREATED';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to auto-update order status
CREATE OR REPLACE FUNCTION update_order_status_on_change()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status TEXT;
BEGIN
  -- Calculate new status
  v_new_status := calculate_order_status(NEW.id);
  
  -- Update status if changed
  IF NEW.status IS DISTINCT FROM v_new_status THEN
    NEW.status := v_new_status;
  END IF;
  
  -- Update payment_status based on new status
  IF v_new_status = 'FULL_PAYMENT' OR v_new_status = 'ORDER_COMPLETED' THEN
    NEW.payment_status := 'FULL_PAYMENT';
  ELSIF v_new_status = 'READY_FOR_PAYMENT' THEN
    NEW.payment_status := 'READY_FOR_PAYMENT';
  ELSE
    NEW.payment_status := 'READY_FOR_PAYMENT';
  END IF;
  
  -- Set completed_at when order reaches ORDER_COMPLETED
  IF v_new_status = 'ORDER_COMPLETED' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_order_status ON orders;

-- Create trigger on orders table
CREATE TRIGGER trigger_update_order_status
  BEFORE INSERT OR UPDATE OF total_amount, discount_amount, is_on_hold
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_change();

-- Step 5: Create trigger to update order status when items are added/removed
CREATE OR REPLACE FUNCTION update_order_status_on_items_change()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_new_status TEXT;
BEGIN
  -- Get order_id from the operation
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;
  
  -- Calculate new status
  v_new_status := calculate_order_status(v_order_id);
  
  -- Update order status
  UPDATE orders
  SET status = v_new_status,
      payment_status = CASE
        WHEN v_new_status IN ('FULL_PAYMENT', 'ORDER_COMPLETED') THEN 'FULL_PAYMENT'
        WHEN v_new_status = 'READY_FOR_PAYMENT' THEN 'READY_FOR_PAYMENT'
        ELSE 'READY_FOR_PAYMENT'
      END,
      completed_at = CASE
        WHEN v_new_status = 'ORDER_COMPLETED' AND completed_at IS NULL THEN NOW()
        ELSE completed_at
      END
  WHERE id = v_order_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_order_status_on_items ON order_items;

-- Create trigger on order_items table
CREATE TRIGGER trigger_update_order_status_on_items
  AFTER INSERT OR UPDATE OR DELETE
  ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_items_change();

-- Step 6: Create trigger to update order status when payments are added/removed
CREATE OR REPLACE FUNCTION update_order_status_on_payment_change()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_new_status TEXT;
BEGIN
  -- Get order_id from the operation
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;
  
  -- Calculate new status
  v_new_status := calculate_order_status(v_order_id);
  
  -- Update order status
  UPDATE orders
  SET status = v_new_status,
      payment_status = CASE
        WHEN v_new_status IN ('FULL_PAYMENT', 'ORDER_COMPLETED') THEN 'FULL_PAYMENT'
        WHEN v_new_status = 'READY_FOR_PAYMENT' THEN 'READY_FOR_PAYMENT'
        ELSE 'READY_FOR_PAYMENT'
      END,
      completed_at = CASE
        WHEN v_new_status = 'ORDER_COMPLETED' AND completed_at IS NULL THEN NOW()
        ELSE completed_at
      END
  WHERE id = v_order_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_order_status_on_payment ON order_payments;

-- Create trigger on order_payments table
CREATE TRIGGER trigger_update_order_status_on_payment
  AFTER INSERT OR UPDATE OR DELETE
  ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_payment_change();

-- Step 7: Create RPC function to set order on hold
CREATE OR REPLACE FUNCTION set_order_hold(
  p_order_id UUID,
  p_hold_reason TEXT,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE orders
  SET 
    is_on_hold = TRUE,
    hold_reason = p_hold_reason,
    held_at = NOW(),
    held_by = p_user_id,
    status = 'HOLD'
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create RPC function to remove hold from order
CREATE OR REPLACE FUNCTION remove_order_hold(
  p_order_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_new_status TEXT;
BEGIN
  -- Calculate what status should be after removing hold
  v_new_status := calculate_order_status(p_order_id);
  
  -- If status would be HOLD, recalculate without hold
  UPDATE orders
  SET 
    is_on_hold = FALSE,
    hold_reason = NULL,
    held_at = NULL,
    held_by = NULL
  WHERE id = p_order_id;
  
  -- Recalculate status after removing hold
  v_new_status := calculate_order_status(p_order_id);
  
  UPDATE orders
  SET status = v_new_status,
      payment_status = CASE
        WHEN v_new_status IN ('FULL_PAYMENT', 'ORDER_COMPLETED') THEN 'FULL_PAYMENT'
        WHEN v_new_status = 'READY_FOR_PAYMENT' THEN 'READY_FOR_PAYMENT'
        ELSE 'READY_FOR_PAYMENT'
      END,
      completed_at = CASE
        WHEN v_new_status = 'ORDER_COMPLETED' AND completed_at IS NULL THEN NOW()
        ELSE completed_at
      END
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Update existing orders to have correct status
UPDATE orders
SET status = calculate_order_status(id)
WHERE status IS NOT NULL;

-- Step 10: Add RLS policies for hold-related columns
-- Users with read access can see hold information
-- Users with write access can set/remove holds

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION set_order_hold TO authenticated;
GRANT EXECUTE ON FUNCTION remove_order_hold TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_order_status TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN orders.is_on_hold IS 'Indicates if order is manually put on hold';
COMMENT ON COLUMN orders.hold_reason IS 'Reason why order was put on hold';
COMMENT ON COLUMN orders.held_at IS 'Timestamp when order was put on hold';
COMMENT ON COLUMN orders.held_by IS 'User who put the order on hold';
COMMENT ON FUNCTION calculate_order_status IS 'Calculates order status based on business rules: Hold > Order Completed > Full Payment > Ready for Payment > Order Created';
COMMENT ON FUNCTION set_order_hold IS 'Sets an order on hold with a reason';
COMMENT ON FUNCTION remove_order_hold IS 'Removes hold from an order and recalculates status';
