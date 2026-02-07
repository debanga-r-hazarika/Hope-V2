-- order_audit_log.performed_by referenced public.users(id) but the app passes auth.users id.
-- Change FK to auth.users(id) so lock/hold/unlock and other audit inserts succeed.
ALTER TABLE order_audit_log
  DROP CONSTRAINT IF EXISTS order_audit_log_performed_by_fkey;

ALTER TABLE order_audit_log
  ADD CONSTRAINT order_audit_log_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES auth.users(id);

COMMENT ON COLUMN order_audit_log.performed_by IS 'User who performed the action (auth.users.id from JWT)';
