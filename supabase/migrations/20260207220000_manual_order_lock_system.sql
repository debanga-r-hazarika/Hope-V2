-- Manual Order Lock System
-- Replace automatic lock with manual lock system
-- Users can manually lock ORDER_COMPLETED orders
-- 7-day unlock window after locking
-- Full audit trail with lock/unlock log

-- 1. Drop old auto-lock function
DROP FUNCTION IF EXISTS auto_lock_completed_orders();

-- 2. Add new columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS can_unlock_until TIMESTAMPTZ;

-- 3. Create order_lock_log table for audit trail
CREATE TABLE IF NOT EXISTS order_lock_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('LOCK', 'UNLOCK')),
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlock_reason TEXT, -- Required only for UNLOCK action
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_lock_log_order_id ON order_lock_log(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lock_log_performed_at ON order_lock_log(performed_at DESC);

-- 4. Function to manually lock an order
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
  -- Check if order exists and get current status
  SELECT status, is_locked
  INTO v_order_status, v_is_locked
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Check if already locked
  IF v_is_locked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order is already locked'
    );
  END IF;

  -- Check if order is completed
  IF v_order_status != 'ORDER_COMPLETED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only completed orders can be locked'
    );
  END IF;

  -- Calculate unlock deadline (7 days from now)
  v_unlock_deadline := now() + INTERVAL '7 days';

  -- Lock the order
  UPDATE orders
  SET 
    is_locked = true,
    locked_at = now(),
    locked_by = p_user_id,
    can_unlock_until = v_unlock_deadline,
    updated_at = now()
  WHERE id = p_order_id;

  -- Log the lock action
  INSERT INTO order_lock_log (order_id, action, performed_by, performed_at)
  VALUES (p_order_id, 'LOCK', p_user_id, now());

  RETURN jsonb_build_object(
    'success', true,
    'locked_at', now(),
    'can_unlock_until', v_unlock_deadline
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to unlock an order (within 7-day window)
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
  -- Check if order exists and get lock info
  SELECT is_locked, can_unlock_until
  INTO v_is_locked, v_can_unlock_until
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Check if order is locked
  IF NOT v_is_locked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order is not locked'
    );
  END IF;

  -- Check if unlock window has expired
  IF now() > v_can_unlock_until THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unlock window has expired. Order is permanently locked.'
    );
  END IF;

  -- Check if unlock reason is provided
  IF p_unlock_reason IS NULL OR trim(p_unlock_reason) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unlock reason is required'
    );
  END IF;

  -- Unlock the order
  UPDATE orders
  SET 
    is_locked = false,
    locked_at = NULL,
    locked_by = NULL,
    can_unlock_until = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  -- Log the unlock action with reason
  INSERT INTO order_lock_log (order_id, action, performed_by, performed_at, unlock_reason)
  VALUES (p_order_id, 'UNLOCK', p_user_id, now(), p_unlock_reason);

  RETURN jsonb_build_object(
    'success', true,
    'unlocked_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to get order lock data (bypass PostgREST cache)
CREATE OR REPLACE FUNCTION get_order_lock_data(p_order_id UUID)
RETURNS TABLE (
  is_locked BOOLEAN,
  locked_at TIMESTAMPTZ,
  locked_by UUID,
  locked_by_name TEXT,
  can_unlock_until TIMESTAMPTZ
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    o.is_locked,
    o.locked_at,
    o.locked_by,
    COALESCE(u.full_name, u.email) as locked_by_name,
    o.can_unlock_until
  FROM orders o
  LEFT JOIN users u ON u.id = o.locked_by
  WHERE o.id = p_order_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to get lock history for an order
CREATE OR REPLACE FUNCTION get_order_lock_history(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  action TEXT,
  performed_by_id UUID,
  performed_by_name TEXT,
  performed_at TIMESTAMPTZ,
  unlock_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oll.id,
    oll.action,
    oll.performed_by,
    COALESCE(u.full_name, u.email) as performed_by_name,
    oll.performed_at,
    oll.unlock_reason
  FROM order_lock_log oll
  LEFT JOIN users u ON u.id = oll.performed_by
  WHERE oll.order_id = p_order_id
  ORDER BY oll.performed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RLS Policies for order_lock_log
ALTER TABLE order_lock_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read lock logs
CREATE POLICY "Users can view order lock logs"
  ON order_lock_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Only the lock/unlock functions can insert logs (SECURITY DEFINER)
CREATE POLICY "Only functions can insert lock logs"
  ON order_lock_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Prevent direct inserts, only through functions

-- 9. Add comments
COMMENT ON COLUMN orders.locked_at IS 'Timestamp when order was manually locked by user';
COMMENT ON COLUMN orders.locked_by IS 'User ID who locked the order';
COMMENT ON COLUMN orders.can_unlock_until IS 'Deadline for unlocking (7 days after lock). After this, order is permanently locked.';
COMMENT ON TABLE order_lock_log IS 'Audit trail for order lock/unlock actions';
COMMENT ON FUNCTION lock_order IS 'Manually lock an ORDER_COMPLETED order. Sets 7-day unlock window.';
COMMENT ON FUNCTION unlock_order IS 'Unlock an order within 7-day window. Requires unlock reason.';
COMMENT ON FUNCTION get_order_lock_data IS 'Get current lock data for an order (bypasses PostgREST cache)';
COMMENT ON FUNCTION get_order_lock_history IS 'Get complete lock/unlock history for an order';

