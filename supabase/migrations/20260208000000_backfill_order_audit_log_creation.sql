-- Backfill ORDER_CREATED for orders that have no audit log entries.
-- Safe to call per order or for all; only inserts when no rows exist.

CREATE OR REPLACE FUNCTION backfill_order_audit_log(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_order_record orders%ROWTYPE;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM order_audit_log WHERE order_id = p_order_id LIMIT 1
  ) INTO v_exists;

  IF v_exists THEN
    RETURN;
  END IF;

  SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO order_audit_log (
    order_id,
    event_type,
    performed_by,
    performed_at,
    event_data,
    description
  ) VALUES (
    p_order_id,
    'ORDER_CREATED',
    v_order_record.created_by,
    COALESCE(v_order_record.created_at, now()),
    jsonb_build_object(
      'order_number', v_order_record.order_number,
      'customer_id', v_order_record.customer_id,
      'order_date', v_order_record.order_date
    ),
    'Order created'
  );
END;
$$;

COMMENT ON FUNCTION backfill_order_audit_log(UUID) IS
  'Ensures an order has at least ORDER_CREATED in audit log; no-op if log already has entries.';

GRANT EXECUTE ON FUNCTION backfill_order_audit_log(UUID) TO authenticated;
