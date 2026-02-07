-- Fix order statuses for all orders
-- This ensures all orders have the correct status based on their current state

-- Update all orders to have correct status
UPDATE orders
SET 
  status = calculate_order_status(id),
  payment_status = CASE
    WHEN calculate_order_status(id) IN ('FULL_PAYMENT', 'ORDER_COMPLETED') THEN 'FULL_PAYMENT'
    WHEN calculate_order_status(id) = 'READY_FOR_PAYMENT' THEN 'READY_FOR_PAYMENT'
    ELSE 'READY_FOR_PAYMENT'
  END,
  completed_at = CASE
    WHEN calculate_order_status(id) = 'ORDER_COMPLETED' AND completed_at IS NULL THEN NOW()
    ELSE completed_at
  END
WHERE status != calculate_order_status(id);

-- Add comment
COMMENT ON COLUMN orders.status IS 'Current order status: ORDER_CREATED, READY_FOR_PAYMENT, HOLD, ORDER_COMPLETED. Automatically calculated by triggers.';
