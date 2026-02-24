-- Professional, modern email template for all sales/order triggers.
-- No-op if no rows match. Run after 20260221100000_add_sales_triggers_transactional_email.sql (and base transactional email tables).
-- Placeholders: {{event_message}}, {{order_number}}, {{order_date_formatted}}, {{customer_name}},
-- {{customer_phone}}, {{customer_address}}, {{customer_type}}, {{contact_person}}, {{status}}, {{payment_status}},
-- {{items_table}}, {{total_amount_formatted}}, {{discount_amount_formatted}}, {{net_amount_formatted}},
-- {{total_paid_formatted}}, {{sold_by_name}}, {{completed_at_formatted}}, {{locked_at_formatted}},
-- {{locked_by_name}}, {{hold_reason}}, {{held_at_formatted}}, {{held_by_name}}, {{unlock_reason}}, {{notes}}.

UPDATE email_templates
SET
  subject = CASE trigger_key
    WHEN 'sale_created' THEN 'New sale #{{order_number}} – {{customer_name}}'
    WHEN 'order_completed' THEN 'Order #{{order_number}} completed – {{customer_name}}'
    WHEN 'order_locked' THEN 'Order #{{order_number}} locked – {{customer_name}}'
    WHEN 'order_unlocked' THEN 'Order #{{order_number}} unlocked – {{customer_name}}'
    WHEN 'order_hold' THEN 'Order #{{order_number}} put on hold – {{customer_name}}'
    WHEN 'order_hold_removed' THEN 'Order #{{order_number}} hold removed – {{customer_name}}'
    ELSE subject
  END,
  body_html = $body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Hatvoni Insider</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Order notification</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 24px;">
          <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:14px;font-weight:600;color:#1e40af;">{{event_message}}</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
            <tr>
              <td style="padding:16px 0;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:4px;">Order</div>
                <div style="font-size:18px;font-weight:700;color:#0f172a;">#{{order_number}}</div>
                <div style="font-size:13px;color:#64748b;margin-top:4px;">{{order_date_formatted}} · {{status}} · {{payment_status}}</div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Customer</div>
              <div style="font-size:16px;font-weight:700;color:#0f172a;">{{customer_name}}</div>
              <div style="font-size:13px;color:#475569;margin-top:6px;">
                {{customer_type}}<span style="color:#cbd5e1;"> · </span>{{customer_phone}}
              </div>
              <div style="font-size:13px;color:#475569;margin-top:4px;">{{customer_address}}</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px;">Contact: {{contact_person}}</div>
            </td></tr>
          </table>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:12px;">Order items</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:12px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Product</th>
                <th style="padding:12px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Qty</th>
                <th style="padding:12px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Unit price</th>
                <th style="padding:12px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Total</th>
              </tr>
            </thead>
            <tbody>{{items_table}}</tbody>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
            <tr><td style="padding:8px 0;text-align:right;font-size:14px;color:#64748b;">Subtotal</td><td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;">{{total_amount_formatted}}</td></tr>
            <tr><td style="padding:8px 0;text-align:right;font-size:14px;color:#64748b;">Discount</td><td style="padding:8px 0;text-align:right;font-size:14px;">{{discount_amount_formatted}}</td></tr>
            <tr><td style="padding:12px 0;text-align:right;font-size:16px;font-weight:700;color:#0f172a;">Net amount</td><td style="padding:12px 0;text-align:right;font-size:16px;font-weight:700;color:#0f172a;">{{net_amount_formatted}}</td></tr>
            <tr><td style="padding:8px 0;text-align:right;font-size:14px;color:#64748b;">Total paid</td><td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;color:#059669;">{{total_paid_formatted}}</td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;">
            <tr><td style="padding:16px 20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Sales &amp; status</div>
              <div style="font-size:13px;color:#475569;">Sold by: <strong>{{sold_by_name}}</strong></div>
              <div style="font-size:13px;color:#475569;margin-top:4px;">Completed: {{completed_at_formatted}}</div>
              <div style="font-size:13px;color:#475569;margin-top:4px;">Locked: {{locked_at_formatted}} by {{locked_by_name}}</div>
              <div style="font-size:13px;color:#475569;margin-top:4px;">Hold: {{hold_reason}} – {{held_at_formatted}} by {{held_by_name}}</div>
              <div style="font-size:13px;color:#475569;margin-top:4px;">Unlock reason: {{unlock_reason}}</div>
              <div style="font-size:13px;color:#475569;margin-top:6px;">Notes: {{notes}}</div>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Order notifications</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
$body$,
  body_text = $text${{event_message}}

Order #{{order_number}} · {{order_date_formatted}}
Status: {{status}} · Payment: {{payment_status}}

Customer: {{customer_name}}
Type: {{customer_type}} · Phone: {{customer_phone}}
Address: {{customer_address}}
Contact: {{contact_person}}

Items:
{{items_list}}

Subtotal: {{total_amount_formatted}}
Discount: {{discount_amount_formatted}}
Net amount: {{net_amount_formatted}}
Total paid: {{total_paid_formatted}}

Sold by: {{sold_by_name}}
Completed: {{completed_at_formatted}}
Locked: {{locked_at_formatted}} by {{locked_by_name}}
Hold: {{hold_reason}} – {{held_at_formatted}} by {{held_by_name}}
Unlock reason: {{unlock_reason}}
Notes: {{notes}}

— Hatvoni Insider$text$
WHERE trigger_key IN ('sale_created', 'order_completed', 'order_locked', 'order_unlocked', 'order_hold', 'order_hold_removed');
