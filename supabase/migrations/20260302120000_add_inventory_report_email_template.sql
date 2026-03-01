-- Inventory Report email template (manual run by admin for a date range).
-- Data comes from Inventory Analytics: current stock, out of stock, low stock, consumption, new arrivals, metrics.

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'inventory_report', 'Inventory Report', '{{report_title}} – {{period_label_formatted}}',
$body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:32px 16px;">
    <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);padding:28px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Hatvoni Insider</div>
          <div style="color:#c7d2fe;font-size:13px;margin-top:4px;">Inventory Report</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 24px;">
          <div style="background:#eef2ff;border-left:4px solid #4f46e5;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:14px;font-weight:600;color:#3730a3;">{{report_title}}</div>
            <div style="font-size:13px;color:#4f46e5;margin-top:4px;">Period: {{period_label_formatted}}</div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:12px;">Inventory metrics</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Total items (tags)</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{total_items}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Total balance (units)</td><td style="padding:6px 0;text-align:right;">{{total_value}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Out of stock count</td><td style="padding:6px 0;text-align:right;">{{out_of_stock_count}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Low stock count</td><td style="padding:6px 0;text-align:right;">{{low_stock_count}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Avg. consumption rate (period)</td><td style="padding:6px 0;text-align:right;">{{average_consumption_rate}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Waste %</td><td style="padding:6px 0;text-align:right;">{{waste_percentage}}%</td></tr>
              </table>
            </td></tr>
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Current inventory (sample)</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Type</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Tag / Item</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Balance</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Unit</th>
            </tr>
            {{current_inventory_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#b91c1c;font-weight:600;margin-bottom:8px;">Out of stock</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #fecaca;border-radius:8px;overflow:hidden;background:#fef2f2;">
            <tr style="background:#fee2e2;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#991b1b;">Item</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#991b1b;">Type</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#991b1b;">Unit</th>
            </tr>
            {{out_of_stock_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#b45309;font-weight:600;margin-bottom:8px;">Low stock</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #fed7aa;border-radius:8px;overflow:hidden;background:#fffbeb;">
            <tr style="background:#fef3c7;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#92400e;">Item</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#92400e;">Type</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#92400e;">Current</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#92400e;">Threshold</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#92400e;">Unit</th>
            </tr>
            {{low_stock_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Consumption in period</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Item</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Date</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Consumed</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Wasted</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Unit</th>
            </tr>
            {{consumption_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">New stock arrivals (period)</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Item</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Type</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Lot / Batch</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Qty</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Date</th>
            </tr>
            {{new_arrivals_table}}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Inventory Report ({{period_label_formatted}})</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
$body$,
$text$
{{report_title}} – {{period_label_formatted}}

Metrics: {{total_items}} items, total balance {{total_value}}, out of stock {{out_of_stock_count}}, low stock {{low_stock_count}}. Consumption rate {{average_consumption_rate}}, waste {{waste_percentage}}%.

— Hatvoni Insider
$text$,
true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'inventory_report');
