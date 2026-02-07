-- Migration: Simplify Order Statuses
-- Remove delivery-based statuses and use simple order-based statuses
-- New statuses: DRAFT, CONFIRMED, ORDER_COMPLETED, CANCELLED

-- Step 1: Update existing orders to new status system
-- READY_FOR_DELIVERY, PARTIALLY_DELIVERED, DELIVERY_COMPLETED -> CONFIRMED
UPDATE orders
SET status = 'CONFIRMED'
WHERE status IN ('READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERY_COMPLETED');

-- Step 2: Drop the old check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 3: Add new check constraint with simplified statuses
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('DRAFT', 'CONFIRMED', 'ORDER_COMPLETED', 'CANCELLED'));

-- Step 4: Update the trigger that sets ORDER_COMPLETED status
-- This trigger should set ORDER_COMPLETED when payment is full
CREATE OR REPLACE FUNCTION update_order_completion_status()
RETURNS TRIGGER AS $$
DECLARE
  order_total NUMERIC;
  order_discount NUMERIC;
  net_total NUMERIC;
  total_paid NUMERIC;
BEGIN
  -- Get order total and discount
  SELECT total_amount, COALESCE(discount_amount, 0)
  INTO order_total, order_discount
  FROM orders
  WHERE id = NEW.order_id;

  -- Calculate net total
  net_total := order_total - order_discount;

  -- Calculate total paid for this order
  SELECT COALESCE(SUM(amount_received), 0)
  INTO total_paid
  FROM order_payments
  WHERE order_id = NEW.order_id;

  -- If payment is complete and order is CONFIRMED, mark as ORDER_COMPLETED
  IF total_paid >= net_total - 0.01 AND net_total > 0 THEN
    UPDATE orders
    SET 
      status = 'ORDER_COMPLETED',
      payment_status = 'FULL_PAYMENT',
      completed_at = CASE 
        WHEN completed_at IS NULL THEN NOW() 
        ELSE completed_at 
      END
    WHERE id = NEW.order_id 
      AND status = 'CONFIRMED';
  -- If partial payment
  ELSIF total_paid > 0 AND total_paid < net_total THEN
    UPDATE orders
    SET payment_status = 'PARTIAL_PAYMENT'
    WHERE id = NEW.order_id;
  -- If no payment
  ELSE
    UPDATE orders
    SET payment_status = 'READY_FOR_PAYMENT'
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_order_completion_on_payment ON order_payments;
CREATE TRIGGER update_order_completion_on_payment
  AFTER INSERT OR UPDATE ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_completion_status();

-- Step 5: Update payment status trigger to handle payment deletions
CREATE OR REPLACE FUNCTION update_order_payment_status_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  order_total NUMERIC;
  order_discount NUMERIC;
  net_total NUMERIC;
  total_paid NUMERIC;
BEGIN
  -- Get order total and discount
  SELECT total_amount, COALESCE(discount_amount, 0)
  INTO order_total, order_discount
  FROM orders
  WHERE id = OLD.order_id;

  -- Calculate net total
  net_total := order_total - order_discount;

  -- Calculate remaining total paid for this order (after deletion)
  SELECT COALESCE(SUM(amount_received), 0)
  INTO total_paid
  FROM order_payments
  WHERE order_id = OLD.order_id;

  -- Update payment status based on remaining payments
  IF total_paid >= net_total - 0.01 AND net_total > 0 THEN
    UPDATE orders
    SET payment_status = 'FULL_PAYMENT'
    WHERE id = OLD.order_id;
  ELSIF total_paid > 0 AND total_paid < net_total THEN
    UPDATE orders
    SET 
      payment_status = 'PARTIAL_PAYMENT',
      status = CASE 
        WHEN status = 'ORDER_COMPLETED' THEN 'CONFIRMED'
        ELSE status
      END
    WHERE id = OLD.order_id;
  ELSE
    UPDATE orders
    SET 
      payment_status = 'READY_FOR_PAYMENT',
      status = CASE 
        WHEN status = 'ORDER_COMPLETED' THEN 'CONFIRMED'
        ELSE status
      END
    WHERE id = OLD.order_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment deletion
DROP TRIGGER IF EXISTS update_order_payment_status_on_delete_trigger ON order_payments;
CREATE TRIGGER update_order_payment_status_on_delete_trigger
  AFTER DELETE ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_payment_status_on_delete();

-- Step 6: Comment for documentation
COMMENT ON COLUMN orders.status IS 'Order status: DRAFT (not confirmed), CONFIRMED (confirmed and inventory deducted), ORDER_COMPLETED (payment received), CANCELLED (order cancelled)';
