-- Keep only the 5 email triggers we use: order_created, order_payment_received, order_completed, order_locked, order_hold.
-- 1. Remove trigger config for unused triggers (avoids FK issues).
-- 2. Delete unused email templates.
-- 3. Ensure order_created and order_payment_received templates exist (same body as order_completed).

-- 1. Remove config for triggers we no longer use
DELETE FROM email_trigger_config
WHERE trigger_key IN ('order_daily_digest', 'order_unlocked', 'order_hold_removed', 'sale_created');

-- 2. Delete unused templates
DELETE FROM email_templates
WHERE trigger_key IN ('order_daily_digest', 'order_unlocked', 'order_hold_removed', 'sale_created');

-- 3. Ensure order_created template exists (copy body from any existing order template)
INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_created', 'Order created', '{{order_event_type}} - {{order_number}} - {{customer_name}}',
  (SELECT body_html FROM email_templates WHERE trigger_key = 'order_completed' LIMIT 1),
  (SELECT body_text FROM email_templates WHERE trigger_key = 'order_completed' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_created')
  AND EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_completed');

-- 4. Ensure order_payment_received template exists
INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_payment_received', 'Order payment received', '{{order_event_type}} - {{order_number}} - {{customer_name}}',
  (SELECT body_html FROM email_templates WHERE trigger_key = 'order_completed' LIMIT 1),
  (SELECT body_text FROM email_templates WHERE trigger_key = 'order_completed' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_payment_received')
  AND EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_completed');
