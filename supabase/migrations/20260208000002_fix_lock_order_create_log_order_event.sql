-- log_order_event is called by lock_order but was missing. Create it so Lock Order works.
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

GRANT EXECUTE ON FUNCTION log_order_event(UUID, TEXT, UUID, JSONB, TEXT) TO authenticated;
COMMENT ON FUNCTION log_order_event IS 'Log an order event to the audit trail';
