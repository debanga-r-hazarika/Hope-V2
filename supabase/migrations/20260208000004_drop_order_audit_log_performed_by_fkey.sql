-- Allow any user id in order_audit_log.performed_by so hold/lock never fail with FK violation.
-- The app passes auth user id; some setups use public.users. Dropping FK lets both work.
-- get_order_audit_log still LEFT JOINs public.users for display name when available.
ALTER TABLE order_audit_log
  DROP CONSTRAINT IF EXISTS order_audit_log_performed_by_fkey;

COMMENT ON COLUMN order_audit_log.performed_by IS 'User id who performed the action (no FK to allow auth or app user id)';
