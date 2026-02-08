-- Fix: "Only completed orders can be locked" when UI shows Order Completed
-- The frontend computes status client-side (full payment => ORDER_COMPLETED), but the DB
-- orders.status might still be READY_FOR_PAYMENT if triggers didn't run. Use
-- calculate_order_status() so lock is allowed when the order is logically completed.

CREATE OR REPLACE FUNCTION lock_order(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order_status TEXT;
  v_calculated_status TEXT;
  v_is_locked BOOLEAN;
  v_unlock_deadline TIMESTAMPTZ;
BEGIN
  SELECT status, is_locked
  INTO v_order_status, v_is_locked
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is already locked');
  END IF;

  -- Use stored status if already ORDER_COMPLETED; otherwise use calculated status
  -- so that full-payment orders can be locked even if DB status wasn't updated by triggers
  IF v_order_status = 'ORDER_COMPLETED' THEN
    v_calculated_status := 'ORDER_COMPLETED';
  ELSE
    v_calculated_status := calculate_order_status(p_order_id);
    IF v_calculated_status = 'ORDER_COMPLETED' THEN
      -- Sync order status so DB matches reality before locking
      UPDATE orders
      SET status = 'ORDER_COMPLETED',
          payment_status = 'FULL_PAYMENT',
          completed_at = COALESCE(completed_at, now()),
          updated_at = now()
      WHERE id = p_order_id;
    END IF;
  END IF;

  IF v_calculated_status != 'ORDER_COMPLETED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only completed orders can be locked');
  END IF;

  v_unlock_deadline := now() + INTERVAL '7 days';

  UPDATE orders
  SET 
    is_locked = true,
    locked_at = now(),
    locked_by = p_user_id,
    can_unlock_until = v_unlock_deadline,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_lock_log (order_id, action, performed_by, performed_at)
  VALUES (p_order_id, 'LOCK', p_user_id, now());

  PERFORM log_order_event(
    p_order_id,
    'ORDER_LOCKED',
    p_user_id,
    jsonb_build_object(
      'locked_at', now(),
      'can_unlock_until', v_unlock_deadline
    ),
    'Order locked (7-day unlock window)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'locked_at', now(),
    'can_unlock_until', v_unlock_deadline
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION lock_order IS 'Lock an order that is completed (full payment, not on hold). Uses calculate_order_status so orders are lockable even if stored status was not yet updated.';
