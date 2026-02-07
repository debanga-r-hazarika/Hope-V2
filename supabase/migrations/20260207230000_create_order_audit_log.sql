-- Comprehensive Order Audit Log System
-- Tracks all significant events in an order's lifecycle

-- 1. Create order_audit_log table
CREATE TABLE IF NOT EXISTS order_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ORDER_CREATED',
    'ITEM_ADDED',
    'ITEM_UPDATED',
    'ITEM_DELETED',
    'PAYMENT_RECEIVED',
    'PAYMENT_DELETED',
    'STATUS_CHANGED',
    'HOLD_PLACED',
    'HOLD_REMOVED',
    'ORDER_LOCKED',
    'ORDER_UNLOCKED',
    'DISCOUNT_APPLIED',
    'ORDER_COMPLETED'
  )),
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_data JSONB, -- Flexible field for event-specific data
  description TEXT, -- Human-readable description
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_order_audit_log_order_id ON order_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_order_audit_log_performed_at ON order_audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_audit_log_event_type ON order_audit_log(event_type);

-- 2. Function to log order events
CREATE OR REPLACE FUNCTION log_order_event(
  p_order_id UUID,
  p_event_type TEXT,
  p_performed_by UUID,
  p_event_data JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO order_audit_log (
    order_id,
    event_type,
    performed_by,
    event_data,
    description,
    performed_at
  ) VALUES (
    p_order_id,
    p_event_type,
    p_performed_by,
    p_event_data,
    p_description,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger to log order creation
CREATE OR REPLACE FUNCTION trigger_log_order_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_order_event(
    NEW.id,
    'ORDER_CREATED',
    NEW.created_by,
    jsonb_build_object(
      'order_number', NEW.order_number,
      'customer_id', NEW.customer_id,
      'order_date', NEW.order_date
    ),
    'Order created'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_order_creation ON orders;
CREATE TRIGGER trigger_log_order_creation
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_order_creation();

-- 4. Trigger to log status changes
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_status_change ON orders;
CREATE TRIGGER trigger_log_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trigger_log_status_change();

-- 5. Trigger to log discount application
CREATE OR REPLACE FUNCTION trigger_log_discount_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.discount_amount IS DISTINCT FROM NEW.discount_amount THEN
    PERFORM log_order_event(
      NEW.id,
      'DISCOUNT_APPLIED',
      NEW.created_by,
      jsonb_build_object(
        'old_discount', OLD.discount_amount,
        'new_discount', NEW.discount_amount,
        'total_amount', NEW.total_amount
      ),
      'Discount changed from ₹' || OLD.discount_amount || ' to ₹' || NEW.discount_amount
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_discount_change ON orders;
CREATE TRIGGER trigger_log_discount_change
  AFTER UPDATE OF discount_amount ON orders
  FOR EACH ROW
  WHEN (OLD.discount_amount IS DISTINCT FROM NEW.discount_amount)
  EXECUTE FUNCTION trigger_log_discount_change();

-- 6. Trigger to log order items
CREATE OR REPLACE FUNCTION trigger_log_order_item_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_product_info TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_product_info := NEW.product_type || ' (' || NEW.quantity || ' ' || NEW.unit || ')';
    PERFORM log_order_event(
      NEW.order_id,
      'ITEM_ADDED',
      NULL, -- Will be set by application
      jsonb_build_object(
        'product_type', NEW.product_type,
        'quantity', NEW.quantity,
        'unit', NEW.unit,
        'unit_price', NEW.unit_price,
        'line_total', NEW.line_total
      ),
      'Added item: ' || v_product_info
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_product_info := NEW.product_type || ' (' || NEW.quantity || ' ' || NEW.unit || ')';
    PERFORM log_order_event(
      NEW.order_id,
      'ITEM_UPDATED',
      NULL,
      jsonb_build_object(
        'product_type', NEW.product_type,
        'old_quantity', OLD.quantity,
        'new_quantity', NEW.quantity,
        'unit', NEW.unit,
        'unit_price', NEW.unit_price
      ),
      'Updated item: ' || v_product_info
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_product_info := OLD.product_type || ' (' || OLD.quantity || ' ' || OLD.unit || ')';
    PERFORM log_order_event(
      OLD.order_id,
      'ITEM_DELETED',
      NULL,
      jsonb_build_object(
        'product_type', OLD.product_type,
        'quantity', OLD.quantity,
        'unit', OLD.unit,
        'unit_price', OLD.unit_price
      ),
      'Removed item: ' || v_product_info
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_order_item_changes ON order_items;
CREATE TRIGGER trigger_log_order_item_changes
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_order_item_changes();

-- 7. Trigger to log payments
CREATE OR REPLACE FUNCTION trigger_log_payment_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_order_event(
      NEW.order_id,
      'PAYMENT_RECEIVED',
      NULL,
      jsonb_build_object(
        'amount', NEW.amount_received,
        'payment_mode', NEW.payment_mode,
        'payment_date', NEW.payment_at
      ),
      'Payment received: ₹' || NEW.amount_received || ' via ' || NEW.payment_mode
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_order_event(
      OLD.order_id,
      'PAYMENT_DELETED',
      NULL,
      jsonb_build_object(
        'amount', OLD.amount_received,
        'payment_mode', OLD.payment_mode
      ),
      'Payment deleted: ₹' || OLD.amount_received
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_payment_changes ON order_payments;
CREATE TRIGGER trigger_log_payment_changes
  AFTER INSERT OR DELETE ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_payment_changes();

-- 8. Update lock/unlock functions to use audit log
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

  -- Log to both tables
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

  -- Log to both tables
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

-- 9. Update hold functions to use audit log
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

-- 10. Function to get complete order audit log
CREATE OR REPLACE FUNCTION get_order_audit_log(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  performed_by_id UUID,
  performed_by_name TEXT,
  performed_at TIMESTAMPTZ,
  event_data JSONB,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oal.id,
    oal.event_type,
    oal.performed_by,
    COALESCE(u.full_name, u.email, 'System') as performed_by_name,
    oal.performed_at,
    oal.event_data,
    oal.description
  FROM order_audit_log oal
  LEFT JOIN users u ON u.id = oal.performed_by
  WHERE oal.order_id = p_order_id
  ORDER BY oal.performed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RLS Policies
ALTER TABLE order_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order audit logs"
  ON order_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only functions can insert audit logs"
  ON order_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 12. Grant permissions
GRANT EXECUTE ON FUNCTION log_order_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_audit_log TO authenticated;

-- 13. Add comments
COMMENT ON TABLE order_audit_log IS 'Comprehensive audit trail for all order events';
COMMENT ON FUNCTION log_order_event IS 'Log an order event to the audit trail';
COMMENT ON FUNCTION get_order_audit_log IS 'Get complete audit log for an order with all events';
