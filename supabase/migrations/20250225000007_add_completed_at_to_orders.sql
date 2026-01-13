-- Add completed_at timestamp to orders table
-- This tracks when an order was marked as ORDER_COMPLETED
-- Used for 48-hour timer before auto-locking

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Create index for completed_at filtering
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);

-- Update the payment status trigger to set completed_at when status becomes ORDER_COMPLETED
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
      completed_at = CASE 
        WHEN completed_at IS NULL THEN now()
        ELSE completed_at
      END,
      updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id)
    AND status = 'DELIVERY_COMPLETED'
    AND new_payment_status = 'FULL_PAYMENT'
    AND status != 'ORDER_COMPLETED';
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Update the order status trigger to set completed_at when status becomes ORDER_COMPLETED
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
            completed_at = CASE 
              WHEN completed_at IS NULL THEN now()
              ELSE completed_at
            END,
            updated_at = now()
        WHERE id = COALESCE(NEW.order_id, OLD.order_id);
      END IF;
    END;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Auto-lock orders after 48 hours of being completed
-- This function checks and locks orders that have been completed for more than 48 hours
CREATE OR REPLACE FUNCTION auto_lock_completed_orders()
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET is_locked = true,
      updated_at = now()
  WHERE status = 'ORDER_COMPLETED'
    AND completed_at IS NOT NULL
    AND completed_at < now() - INTERVAL '48 hours'
    AND is_locked = false;
END;
$$ LANGUAGE plpgsql;
