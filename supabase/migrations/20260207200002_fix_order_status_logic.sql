-- Fix Order Status Logic
-- Separate Order Status from Payment Status
-- Order Status: ORDER_CREATED, READY_FOR_PAYMENT, HOLD, ORDER_COMPLETED
-- Payment Status: READY_FOR_PAYMENT, PARTIAL_PAYMENT, FULL_PAYMENT

-- Drop old constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint with correct statuses
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('ORDER_CREATED', 'READY_FOR_PAYMENT', 'HOLD', 'ORDER_COMPLETED'));

-- Recreate calculate_order_status function with correct logic
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

  -- Order Status Logic (separate from payment status)
  -- Priority: Hold > Complete > Ready for Payment > Order Created
  
  IF v_is_on_hold THEN
    -- Order is on hold (regardless of payment or items)
    RETURN 'HOLD';
  ELSIF v_is_full_payment AND NOT v_is_on_hold THEN
    -- Full payment received and not on hold = Complete
    RETURN 'ORDER_COMPLETED';
  ELSIF v_has_items THEN
    -- Items added = Ready for Payment (regardless of payment status)
    RETURN 'READY_FOR_PAYMENT';
  ELSE
    -- No items = Order Created
    RETURN 'ORDER_CREATED';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to also update payment_status correctly
CREATE OR REPLACE FUNCTION update_order_status_on_change()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status TEXT;
  v_new_payment_status TEXT;
  v_total_paid NUMERIC;
  v_net_total NUMERIC;
BEGIN
  -- Calculate new order status
  v_new_status := calculate_order_status(NEW.id);
  
  -- Calculate payment status separately
  v_net_total := NEW.total_amount - COALESCE(NEW.discount_amount, 0);
  
  SELECT COALESCE(SUM(amount_received), 0)
  INTO v_total_paid
  FROM order_payments
  WHERE order_id = NEW.id;
  
  -- Determine payment status
  IF v_total_paid >= v_net_total - 0.01 AND v_net_total > 0 THEN
    v_new_payment_status := 'FULL_PAYMENT';
  ELSIF v_total_paid > 0 THEN
    v_new_payment_status := 'PARTIAL_PAYMENT';
  ELSE
    v_new_payment_status := 'READY_FOR_PAYMENT';
  END IF;
  
  -- Update both statuses
  NEW.status := v_new_status;
  NEW.payment_status := v_new_payment_status;
  
  -- Set completed_at when order reaches ORDER_COMPLETED
  IF v_new_status = 'ORDER_COMPLETED' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger for items changes
CREATE OR REPLACE FUNCTION update_order_status_on_items_change()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_new_status TEXT;
  v_new_payment_status TEXT;
  v_total_paid NUMERIC;
  v_net_total NUMERIC;
  v_total_amount NUMERIC;
  v_discount_amount NUMERIC;
BEGIN
  -- Get order_id
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;
  
  -- Calculate new order status
  v_new_status := calculate_order_status(v_order_id);
  
  -- Get order amounts
  SELECT total_amount, COALESCE(discount_amount, 0)
  INTO v_total_amount, v_discount_amount
  FROM orders
  WHERE id = v_order_id;
  
  v_net_total := v_total_amount - v_discount_amount;
  
  -- Get total paid
  SELECT COALESCE(SUM(amount_received), 0)
  INTO v_total_paid
  FROM order_payments
  WHERE order_id = v_order_id;
  
  -- Determine payment status
  IF v_total_paid >= v_net_total - 0.01 AND v_net_total > 0 THEN
    v_new_payment_status := 'FULL_PAYMENT';
  ELSIF v_total_paid > 0 THEN
    v_new_payment_status := 'PARTIAL_PAYMENT';
  ELSE
    v_new_payment_status := 'READY_FOR_PAYMENT';
  END IF;
  
  -- Update order
  UPDATE orders
  SET status = v_new_status,
      payment_status = v_new_payment_status,
      completed_at = CASE
        WHEN v_new_status = 'ORDER_COMPLETED' AND completed_at IS NULL THEN NOW()
        ELSE completed_at
      END
  WHERE id = v_order_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Update trigger for payment changes
CREATE OR REPLACE FUNCTION update_order_status_on_payment_change()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_new_status TEXT;
  v_new_payment_status TEXT;
  v_total_paid NUMERIC;
  v_net_total NUMERIC;
  v_total_amount NUMERIC;
  v_discount_amount NUMERIC;
BEGIN
  -- Get order_id
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;
  
  -- Calculate new order status
  v_new_status := calculate_order_status(v_order_id);
  
  -- Get order amounts
  SELECT total_amount, COALESCE(discount_amount, 0)
  INTO v_total_amount, v_discount_amount
  FROM orders
  WHERE id = v_order_id;
  
  v_net_total := v_total_amount - v_discount_amount;
  
  -- Get total paid
  SELECT COALESCE(SUM(amount_received), 0)
  INTO v_total_paid
  FROM order_payments
  WHERE order_id = v_order_id;
  
  -- Determine payment status
  IF v_total_paid >= v_net_total - 0.01 AND v_net_total > 0 THEN
    v_new_payment_status := 'FULL_PAYMENT';
  ELSIF v_total_paid > 0 THEN
    v_new_payment_status := 'PARTIAL_PAYMENT';
  ELSE
    v_new_payment_status := 'READY_FOR_PAYMENT';
  END IF;
  
  -- Update order
  UPDATE orders
  SET status = v_new_status,
      payment_status = v_new_payment_status,
      completed_at = CASE
        WHEN v_new_status = 'ORDER_COMPLETED' AND completed_at IS NULL THEN NOW()
        ELSE completed_at
      END
  WHERE id = v_order_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recalculate all existing orders
UPDATE orders
SET status = calculate_order_status(id);

-- Update payment status for all orders
UPDATE orders o
SET payment_status = CASE
  WHEN (SELECT COALESCE(SUM(amount_received), 0) FROM order_payments WHERE order_id = o.id) >= (o.total_amount - COALESCE(o.discount_amount, 0)) - 0.01 
    AND (o.total_amount - COALESCE(o.discount_amount, 0)) > 0 THEN 'FULL_PAYMENT'
  WHEN (SELECT COALESCE(SUM(amount_received), 0) FROM order_payments WHERE order_id = o.id) > 0 THEN 'PARTIAL_PAYMENT'
  ELSE 'READY_FOR_PAYMENT'
END;

-- Add comments
COMMENT ON COLUMN orders.status IS 'Order Status: ORDER_CREATED (no items), READY_FOR_PAYMENT (items added), HOLD (on hold), ORDER_COMPLETED (full payment + not on hold)';
COMMENT ON COLUMN orders.payment_status IS 'Payment Status: READY_FOR_PAYMENT (no payment), PARTIAL_PAYMENT (partial payment), FULL_PAYMENT (full payment)';
