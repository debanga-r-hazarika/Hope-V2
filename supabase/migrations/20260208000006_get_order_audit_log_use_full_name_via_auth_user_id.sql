-- Resolve performer name from public.users by matching either id or auth_user_id,
-- so we show full_name (e.g. "Debanga Raz Hazarika") instead of email when
-- order_audit_log stores auth user id.
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
  LEFT JOIN public.users u ON u.id = oal.performed_by OR u.auth_user_id = oal.performed_by
  LEFT JOIN auth.users au ON au.id = oal.performed_by
  WHERE oal.order_id = p_order_id
  ORDER BY oal.performed_at DESC;
END;
$$;

COMMENT ON FUNCTION get_order_audit_log(UUID) IS 'Get order audit log; resolves performer full_name from public.users (by id or auth_user_id) or auth.users email.';
