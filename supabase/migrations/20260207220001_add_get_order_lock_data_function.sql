-- Add missing get_order_lock_data function
-- This function bypasses PostgREST cache to get fresh lock data

CREATE OR REPLACE FUNCTION get_order_lock_data(p_order_id UUID)
RETURNS TABLE (
  is_locked BOOLEAN,
  locked_at TIMESTAMPTZ,
  locked_by UUID,
  locked_by_name TEXT,
  can_unlock_until TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_order_lock_data IS 'Get current lock data for an order (bypasses PostgREST cache)';
