-- Seed email_templates for sales/order lifecycle triggers.
-- Requires: transactional email tables (e.g. from 20260221000000_create_transactional_email_tables.sql) to exist.
-- Admins can then map each trigger to a template and distribution list in Admin → Transactional Email → Triggers.

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_completed', 'Order completed', 'Order {{order_number}} completed – {{customer_name}}',
  '<p>Order <strong>{{order_number}}</strong> has been completed.</p><p>Customer: {{customer_name}}</p><p>Net amount: {{net_amount}}</p><p>Completed at: {{completed_at}}</p><p>Sold by: {{sold_by_name}}</p><p>{{items_summary}}</p>',
  'Order {{order_number}} completed. Customer: {{customer_name}}. Net amount: {{net_amount}}. Sold by: {{sold_by_name}}. {{items_summary}}',
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_completed');

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_locked', 'Order locked', 'Order {{order_number}} locked – {{customer_name}}',
  '<p>Order <strong>{{order_number}}</strong> has been locked.</p><p>Customer: {{customer_name}}</p><p>Locked at: {{locked_at}}</p><p>Locked by: {{locked_by_name}}</p><p>Net amount: {{net_amount}}</p>',
  'Order {{order_number}} locked. Customer: {{customer_name}}. Locked at: {{locked_at}} by {{locked_by_name}}. Net amount: {{net_amount}}.',
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_locked');

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_unlocked', 'Order unlocked', 'Order {{order_number}} unlocked – {{customer_name}}',
  '<p>Order <strong>{{order_number}}</strong> has been unlocked.</p><p>Customer: {{customer_name}}</p><p>Unlock reason: {{unlock_reason}}</p><p>Net amount: {{net_amount}}</p>',
  'Order {{order_number}} unlocked. Customer: {{customer_name}}. Reason: {{unlock_reason}}. Net amount: {{net_amount}}.',
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_unlocked');

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_hold', 'Order put on hold', 'Order {{order_number}} put on hold – {{customer_name}}',
  '<p>Order <strong>{{order_number}}</strong> has been put on hold.</p><p>Customer: {{customer_name}}</p><p>Reason: {{hold_reason}}</p><p>Held at: {{held_at}}</p><p>Held by: {{held_by_name}}</p><p>Net amount: {{net_amount}}</p>',
  'Order {{order_number}} on hold. Customer: {{customer_name}}. Reason: {{hold_reason}}. Held by: {{held_by_name}}. Net amount: {{net_amount}}.',
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_hold');

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_hold_removed', 'Order hold removed', 'Order {{order_number}} hold removed – {{customer_name}}',
  '<p>Hold has been removed from order <strong>{{order_number}}</strong>.</p><p>Customer: {{customer_name}}</p><p>Net amount: {{net_amount}}</p>',
  'Order {{order_number}} hold removed. Customer: {{customer_name}}. Net amount: {{net_amount}}.',
  true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_hold_removed');
