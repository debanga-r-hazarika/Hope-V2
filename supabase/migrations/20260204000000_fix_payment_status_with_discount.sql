-- Fix payment status calculation to consider discount amount
-- Migration: 20260204000000_fix_payment_status_with_discount

-- Update the payment status calculation function to consider discount_amount
CREATE OR REPLACE FUNCTION calculate_order_payment_status_v2(order_uuid uuid)
RETURNS text AS $$
DECLARE
  order_total numeric;
  order_discount numeric;
  net_total numeric;
  total_paid numeric;
BEGIN
  -- Get order total and discount amount
  SELECT o.total_amount, COALESCE(o.discount_amount, 0) 
  INTO order_total, order_discount
  FROM orders o
  WHERE o.id = order_uuid;
  
  IF order_total IS NULL THEN
    RETURN 'READY_FOR_PAYMENT';
  END IF;
  
  -- Calculate net total (after discount)
  net_total := order_total - order_discount;
  
  -- Get total payments
  SELECT COALESCE(SUM(amount_received), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = order_uuid;
  
  -- Determine payment status based on net total (after discount)
  IF total_paid = 0 THEN
    RETURN 'READY_FOR_PAYMENT';
  ELSIF total_paid >= net_total THEN
    RETURN 'FULL_PAYMENT';
  ELSE
    RETURN 'PARTIAL_PAYMENT';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Also update the legacy function for backward compatibility
CREATE OR REPLACE FUNCTION calculate_order_payment_status(order_uuid uuid)
RETURNS text AS $$
DECLARE
  order_total numeric;
  order_discount numeric;
  net_total numeric;
  total_paid numeric;
BEGIN
  -- Get order total and discount amount
  SELECT o.total_amount, COALESCE(o.discount_amount, 0) 
  INTO order_total, order_discount
  FROM orders o
  WHERE o.id = order_uuid;
  
  IF order_total IS NULL THEN
    RETURN 'READY_FOR_PAYMENT';
  END IF;
  
  -- Calculate net total (after discount)
  net_total := order_total - order_discount;
  
  -- Get total payments
  SELECT COALESCE(SUM(amount_received), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = order_uuid;
  
  -- Determine payment status based on net total (after discount)
  IF total_paid = 0 THEN
    RETURN 'READY_FOR_PAYMENT';
  ELSIF total_paid >= net_total THEN
    RETURN 'FULL_PAYMENT';
  ELSE
    RETURN 'PARTIAL_PAYMENT';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Recalculate payment status for all existing orders to fix any incorrect statuses
UPDATE orders
SET payment_status = calculate_order_payment_status_v2(id)
WHERE payment_status IS NOT NULL;

-- Update any orders that should now be ORDER_COMPLETED due to the fix
UPDATE orders
SET status = 'ORDER_COMPLETED',
    completed_at = CASE
      WHEN completed_at IS NULL THEN now()
      ELSE completed_at
    END,
    updated_at = now()
WHERE status = 'DELIVERY_COMPLETED'
  AND payment_status = 'FULL_PAYMENT'
  AND status != 'ORDER_COMPLETED';