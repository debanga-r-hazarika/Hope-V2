-- Migration: Implement Canonical Order Status Model
-- This migration implements the authoritative order lifecycle with separate delivery and payment statuses

-- Step 1: Add payment_status column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text;

-- Step 2: Migrate existing data FIRST (before applying constraints)
-- Map old statuses to new ones
UPDATE orders SET 
  status = CASE 
    WHEN status = 'Draft' THEN 'DRAFT'
    WHEN status = 'Confirmed' THEN 'READY_FOR_DELIVERY'
    WHEN status = 'Partially Delivered' THEN 'PARTIALLY_DELIVERED'
    WHEN status = 'Fully Delivered' THEN 'DELIVERY_COMPLETED'
    WHEN status = 'Completed' THEN 'ORDER_COMPLETED'
    WHEN status = 'Cancelled' THEN 'CANCELLED'
    -- Handle any other unexpected values
    WHEN status NOT IN ('DRAFT', 'READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERY_COMPLETED', 'ORDER_COMPLETED', 'CANCELLED') THEN 'DRAFT'
    ELSE status
  END;

-- Step 3: Drop old status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 4: Add new status constraint with canonical delivery statuses
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('DRAFT', 'READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERY_COMPLETED', 'ORDER_COMPLETED', 'CANCELLED'));

-- Step 5: Add payment_status constraint
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IS NULL OR payment_status IN ('READY_FOR_PAYMENT', 'PARTIAL_PAYMENT', 'FULL_PAYMENT'));

-- Step 6: Set default payment_status for existing orders based on payments
-- This will be calculated by the function below, but set initial state
UPDATE orders SET payment_status = 'READY_FOR_PAYMENT' 
WHERE payment_status IS NULL 
  AND status IN ('READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERY_COMPLETED');

-- Step 7: Create function to calculate payment status
CREATE OR REPLACE FUNCTION calculate_order_payment_status_v2(order_uuid uuid)
RETURNS text AS $$
DECLARE
  order_total numeric;
  total_paid numeric;
BEGIN
  -- Get order total
  SELECT total_amount INTO order_total
  FROM orders
  WHERE id = order_uuid;
  
  IF order_total IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get total payments
  SELECT COALESCE(SUM(amount_received), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = order_uuid;
  
  -- Determine payment status
  IF total_paid = 0 THEN
    RETURN 'READY_FOR_PAYMENT';
  ELSIF total_paid >= order_total THEN
    RETURN 'FULL_PAYMENT';
  ELSE
    RETURN 'PARTIAL_PAYMENT';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create function to update payment status on orders
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  new_payment_status text;
BEGIN
  -- Calculate payment status
  SELECT calculate_order_payment_status_v2(COALESCE(NEW.order_id, OLD.order_id))
  INTO new_payment_status;
  
  -- Update order payment_status
  UPDATE orders
  SET payment_status = new_payment_status,
      updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Check if order should be marked as ORDER_COMPLETED
  UPDATE orders
  SET status = 'ORDER_COMPLETED',
      updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id)
    AND status = 'DELIVERY_COMPLETED'
    AND new_payment_status = 'FULL_PAYMENT'
    AND status != 'ORDER_COMPLETED';
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger to update payment status when payments change
DROP TRIGGER IF EXISTS update_order_payment_status_on_payment ON order_payments;
CREATE TRIGGER update_order_payment_status_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_payment_status();

-- Step 10: Replace old status update function with new canonical logic
CREATE OR REPLACE FUNCTION update_order_status_v2()
RETURNS TRIGGER AS $$
DECLARE
  order_status text;
  total_items integer;
  fully_delivered_items integer;
  partially_delivered_items integer;
  current_order_status text;
BEGIN
  -- Get current order status
  SELECT status INTO current_order_status 
  FROM orders 
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Count items and delivery status
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE quantity_delivered >= quantity),
    COUNT(*) FILTER (WHERE quantity_delivered > 0 AND quantity_delivered < quantity)
  INTO total_items, fully_delivered_items, partially_delivered_items
  FROM order_items
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Determine delivery status based on delivery progress
  IF total_items = 0 THEN
    -- No items, stay in DRAFT
    order_status := 'DRAFT';
  ELSIF fully_delivered_items = total_items THEN
    -- All items delivered
    order_status := 'DELIVERY_COMPLETED';
  ELSIF partially_delivered_items > 0 OR fully_delivered_items > 0 THEN
    -- Some items delivered
    order_status := 'PARTIALLY_DELIVERED';
  ELSIF current_order_status = 'DRAFT' THEN
    -- Items added but not delivered yet, move to READY_FOR_DELIVERY
    order_status := 'READY_FOR_DELIVERY';
  ELSE
    -- Keep current status if it's already READY_FOR_DELIVERY or higher
    order_status := current_order_status;
  END IF;
  
  -- Don't override ORDER_COMPLETED or CANCELLED unless explicitly changed
  IF current_order_status = 'ORDER_COMPLETED' OR current_order_status = 'CANCELLED' THEN
    order_status := current_order_status;
  END IF;
  
  -- Update order status
  UPDATE orders
  SET status = order_status,
      updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Set payment_status to READY_FOR_PAYMENT when order reaches READY_FOR_DELIVERY
  IF order_status = 'READY_FOR_DELIVERY' AND current_order_status = 'DRAFT' THEN
    UPDATE orders
    SET payment_status = COALESCE(payment_status, 'READY_FOR_PAYMENT')
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  END IF;
  
  -- Check if order should be marked as ORDER_COMPLETED
  -- This happens when DELIVERY_COMPLETED + FULL_PAYMENT
  IF order_status = 'DELIVERY_COMPLETED' THEN
    DECLARE
      payment_stat text;
    BEGIN
      SELECT payment_status INTO payment_stat
      FROM orders
      WHERE id = COALESCE(NEW.order_id, OLD.order_id);
      
      IF payment_stat = 'FULL_PAYMENT' THEN
        UPDATE orders
        SET status = 'ORDER_COMPLETED',
            updated_at = now()
        WHERE id = COALESCE(NEW.order_id, OLD.order_id);
      END IF;
    END;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 11: Replace old trigger with new one
DROP TRIGGER IF EXISTS update_order_status_on_delivery ON order_items;
CREATE TRIGGER update_order_status_on_delivery_v2
  AFTER INSERT OR UPDATE OF quantity_delivered ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_v2();

-- Step 12: Update calculate_order_payment_status function to use new statuses
CREATE OR REPLACE FUNCTION calculate_order_payment_status(order_uuid uuid)
RETURNS text AS $$
DECLARE
  order_total numeric;
  total_paid numeric;
BEGIN
  -- Get order total
  SELECT total_amount INTO order_total
  FROM orders
  WHERE id = order_uuid;
  
  IF order_total IS NULL THEN
    RETURN 'READY_FOR_PAYMENT';
  END IF;
  
  -- Get total payments
  SELECT COALESCE(SUM(amount_received), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = order_uuid;
  
  -- Determine payment status (return new canonical statuses)
  IF total_paid = 0 THEN
    RETURN 'READY_FOR_PAYMENT';
  ELSIF total_paid >= order_total THEN
    RETURN 'FULL_PAYMENT';
  ELSE
    RETURN 'PARTIAL_PAYMENT';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 13: Create index on payment_status for performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status_v2 ON orders(status);

-- Step 14: Update all existing orders' payment_status
UPDATE orders
SET payment_status = calculate_order_payment_status_v2(id)
WHERE payment_status IS NULL OR payment_status NOT IN ('READY_FOR_PAYMENT', 'PARTIAL_PAYMENT', 'FULL_PAYMENT');

-- Step 15: Ensure ORDER_COMPLETED status is set correctly for existing completed orders
UPDATE orders
SET status = 'ORDER_COMPLETED'
WHERE status = 'DELIVERY_COMPLETED'
  AND payment_status = 'FULL_PAYMENT';
