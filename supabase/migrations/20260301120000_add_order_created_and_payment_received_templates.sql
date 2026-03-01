-- Add order_created and order_payment_received email templates (event-based emails, no digest).
-- Same body as professional order template; subject uses {{order_event_type}} - {{order_number}} - {{customer_name}}.

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_created', 'Order created', '{{order_event_type}} - {{order_number}} - {{customer_name}}',
  (SELECT body_html FROM email_templates WHERE trigger_key = 'order_completed' LIMIT 1),
  (SELECT body_text FROM email_templates WHERE trigger_key = 'order_completed' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_created');

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_payment_received', 'Order payment received', '{{order_event_type}} - {{order_number}} - {{customer_name}}',
  (SELECT body_html FROM email_templates WHERE trigger_key = 'order_completed' LIMIT 1),
  (SELECT body_text FROM email_templates WHERE trigger_key = 'order_completed' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_payment_received');
