-- Show real user name for Order locked (and other events) when performed_by is auth user id.
-- Join auth.users as fallback so we get at least email when user is not in public.users.
CREATE OR REPLACE FUNCTION get_order_audit_log(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  performed_by_id UUID,
  performed_by_name TEXT,
  performed_at TIMESTAMPTZ,
  event_data JSONB,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oal.id,
    oal.event_type,
    oal.performed_by,
    COALESCE(
      u.full_name,
      u.email,
      au.email,
      'System'
    )::TEXT AS performed_by_name,
    oal.performed_at,
    oal.event_data,
    oal.description
  FROM order_audit_log oal
  LEFT JOIN public.users u ON u.id = oal.performed_by
  LEFT JOIN auth.users au ON au.id = oal.performed_by
  WHERE oal.order_id = p_order_id
  ORDER BY oal.performed_at DESC;
END;
$$;

COMMENT ON FUNCTION get_order_audit_log(UUID) IS 'Get order audit log; resolves performer name from public.users or auth.users.';
