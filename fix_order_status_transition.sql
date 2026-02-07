-- Fix Order Status Auto-Transition
-- This script manually updates orders that should be ORDER_COMPLETED but are showing FULL_PAYMENT

-- First, let's see which orders need fixing
SELECT 
  o.id,
  o.order_number,
  o.status AS current_status,
  o.is_on_hold,
  o.total_amount,
  o.discount_amount,
  (o.total_amount - COALESCE(o.discount_amount, 0)) AS net_total,
  COALESCE(SUM(op.amount_received), 0) AS total_paid,
  CASE 
    WHEN COALESCE(SUM(op.amount_received), 0) >= (o.total_amount - COALESCE(o.discount_amount, 0)) - 0.01 
      AND (o.total_amount - COALESCE(o.discount_amount, 0)) > 0
      AND COALESCE(o.is_on_hold, FALSE) = FALSE
    THEN 'ORDER_COMPLETED'
    ELSE o.status
  END AS should_be_status
FROM orders o
LEFT JOIN order_payments op ON op.order_id = o.id
GROUP BY o.id, o.order_number, o.status, o.is_on_hold, o.total_amount, o.discount_amount
HAVING o.status != CASE 
    WHEN COALESCE(SUM(op.amount_received), 0) >= (o.total_amount - COALESCE(o.discount_amount, 0)) - 0.01 
      AND (o.total_amount - COALESCE(o.discount_amount, 0)) > 0
      AND COALESCE(o.is_on_hold, FALSE) = FALSE
    THEN 'ORDER_COMPLETED'
    ELSE o.status
  END;

-- Now fix them by recalculating status for all orders
UPDATE orders
SET status = calculate_order_status(id),
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

-- Verify the fix
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.is_on_hold,
  o.payment_status,
  (o.total_amount - COALESCE(o.discount_amount, 0)) AS net_total,
  COALESCE(SUM(op.amount_received), 0) AS total_paid
FROM orders o
LEFT JOIN order_payments op ON op.order_id = o.id
GROUP BY o.id, o.order_number, o.status, o.is_on_hold, o.payment_status, o.total_amount, o.discount_amount
ORDER BY o.created_at DESC
LIMIT 20;
