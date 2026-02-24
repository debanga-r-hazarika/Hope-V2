-- Add template for daily order digest (11:30 PM IST). One email per new/updated order.
-- Placeholders: order_event_type, order_badge, order_number, order_date_formatted, customer_name, sold_by_name, notes,
-- items_table, total_amount_formatted, discount_amount_formatted, net_amount_formatted, total_paid_formatted, outstanding_amount_formatted,
-- payments_table, third_party_delivery_label, order_details_url

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'order_daily_digest', 'Daily order digest', '{{order_event_type}} – {{order_number}} – {{customer_name}}',
$body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
      <!-- Header -->
      <tr>
        <td style="background:#0f172a;padding:24px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:20px;font-weight:700;">Hatvoni Insider</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Order notification</div>
        </td>
      </tr>
      <!-- Order badge -->
      <tr>
        <td style="padding:16px 32px 0;">
          <div style="display:inline-block;background:#1e293b;color:#f8fafc;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;letter-spacing:0.05em;">{{order_badge}}</div>
        </td>
      </tr>
      <!-- Order summary -->
      <tr>
        <td style="padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
            <tr><td style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Order summary</td></tr>
            <tr><td style="font-size:15px;color:#0f172a;"><strong>Customer:</strong> {{customer_name}}</td></tr>
            <tr><td style="font-size:14px;color:#475569;"><strong>Order ID:</strong> {{order_number}}</td></tr>
            <tr><td style="font-size:14px;color:#475569;"><strong>Sold by:</strong> {{sold_by_name}}</td></tr>
            <tr><td style="font-size:14px;color:#475569;"><strong>Order date:</strong> {{order_date_formatted}}</td></tr>
            <tr><td style="font-size:14px;color:#475569;"><strong>Notes:</strong> {{notes}}</td></tr>
          </table>
          <!-- Order items -->
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Order items</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Product / Batch / Size</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Qty</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Unit price</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Total</th>
              </tr>
            </thead>
            <tbody>{{items_table}}</tbody>
          </table>
          <!-- Payment summary card -->
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Payment summary</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px;">
            <tr><td style="padding:4px 0;font-size:14px;color:#475569;">Subtotal</td><td style="padding:4px 0;text-align:right;font-size:14px;">{{total_amount_formatted}}</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#475569;">Discount</td><td style="padding:4px 0;text-align:right;font-size:14px;">{{discount_amount_formatted}}</td></tr>
            <tr><td style="padding:8px 0;font-size:15px;font-weight:700;color:#0f172a;">Net total</td><td style="padding:8px 0;text-align:right;font-size:15px;font-weight:700;">{{net_amount_formatted}}</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#059669;">Paid</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#059669;">{{total_paid_formatted}}</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#dc2626;">Outstanding</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#dc2626;">{{outstanding_amount_formatted}}</td></tr>
          </table>
          <!-- Payment history -->
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Payment history</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Date</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Amount</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Mode</th>
              </tr>
            </thead>
            <tbody>{{payments_table}}</tbody>
          </table>
          <!-- Delivery -->
          <p style="font-size:14px;color:#475569;margin-bottom:20px;"><strong>Third-party delivery enabled:</strong> {{third_party_delivery_label}}</p>
          <!-- CTA -->
          <p style="margin:24px 0 0;"><a href="{{order_details_url}}" style="display:inline-block;background:#0f172a;color:#fff;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">View Order Details</a></p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">Hatvoni Insider · Daily order digest</td>
      </tr>
    </table>
  </td></tr>
</table>
$body$,
$text${{order_event_type}} – {{order_number}} – {{customer_name}}

Order summary
Customer: {{customer_name}}
Order ID: {{order_number}}
Sold by: {{sold_by_name}}
Order date: {{order_date_formatted}}
Notes: {{notes}}

Order items: see table in HTML.

Payment summary
Subtotal: {{total_amount_formatted}}
Discount: {{discount_amount_formatted}}
Net total: {{net_amount_formatted}}
Paid: {{total_paid_formatted}}
Outstanding: {{outstanding_amount_formatted}}

Payment history: {{payments_table_plain}}

Third-party delivery: {{third_party_delivery_label}}

View order: {{order_details_url}}

— Hatvoni Insider
$text$,
true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'order_daily_digest');
