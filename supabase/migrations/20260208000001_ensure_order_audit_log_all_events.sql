-- Ensure Order log shows: Order completed, Hold placed/removed, Order locked/unlocked, Discount applied.
-- 1. Status trigger: also log ORDER_COMPLETED when status becomes ORDER_COMPLETED
-- 2. Re-create hold/lock/unlock functions so they always write to order_audit_log

-- 1. Update status change trigger to log ORDER_COMPLETED when status becomes ORDER_COMPLETED
CREATE OR REPLACE FUNCTION trigger_log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_order_event(
      NEW.id,
      'STATUS_CHANGED',
      NEW.created_by,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      'Order status changed from ' || OLD.status || ' to ' || NEW.status
    );
    IF NEW.status = 'ORDER_COMPLETED' THEN
      PERFORM log_order_event(
        NEW.id,
        'ORDER_COMPLETED',
        NEW.created_by,
        jsonb_build_object('completed_at', NEW.completed_at),
        'Order completed (full payment received)'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. set_order_hold: ensure audit log
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

  PERFORM log_order_event(
    p_order_id,
    'HOLD_PLACED',
    p_user_id,
    jsonb_build_object('hold_reason', p_hold_reason),
    'Order placed on hold: ' || p_hold_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. remove_order_hold: ensure audit log
CREATE OR REPLACE FUNCTION remove_order_hold(
  p_order_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_new_status TEXT;
  v_held_by UUID;
BEGIN
  SELECT held_by INTO v_held_by FROM orders WHERE id = p_order_id;

  UPDATE orders
  SET 
    is_on_hold = FALSE,
    hold_reason = NULL,
    held_at = NULL,
    held_by = NULL
  WHERE id = p_order_id;

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

  PERFORM log_order_event(
    p_order_id,
    'HOLD_REMOVED',
    v_held_by,
    jsonb_build_object('new_status', v_new_status),
    'Hold removed from order'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. lock_order: ensure audit log (order_lock_log + order_audit_log)
CREATE OR REPLACE FUNCTION lock_order(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order_status TEXT;
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

  IF v_order_status != 'ORDER_COMPLETED' THEN
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

-- 5. unlock_order: ensure audit log
CREATE OR REPLACE FUNCTION unlock_order(
  p_order_id UUID,
  p_user_id UUID,
  p_unlock_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_can_unlock_until TIMESTAMPTZ;
BEGIN
  SELECT is_locked, can_unlock_until
  INTO v_is_locked, v_can_unlock_until
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF NOT v_is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is not locked');
  END IF;

  IF now() > v_can_unlock_until THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unlock window has expired. Order is permanently locked.');
  END IF;

  IF p_unlock_reason IS NULL OR trim(p_unlock_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unlock reason is required');
  END IF;

  UPDATE orders
  SET 
    is_locked = false,
    locked_at = NULL,
    locked_by = NULL,
    can_unlock_until = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_lock_log (order_id, action, performed_by, performed_at, unlock_reason)
  VALUES (p_order_id, 'UNLOCK', p_user_id, now(), p_unlock_reason);

  PERFORM log_order_event(
    p_order_id,
    'ORDER_UNLOCKED',
    p_user_id,
    jsonb_build_object('unlock_reason', p_unlock_reason),
    'Order unlocked: ' || p_unlock_reason
  );

  RETURN jsonb_build_object('success', true, 'unlocked_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
