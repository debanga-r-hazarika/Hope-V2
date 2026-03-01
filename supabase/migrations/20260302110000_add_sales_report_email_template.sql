-- Sales Report email template (manual run by admin for a date range).
-- Data comes from Sales Analytics: summary, customer/product sales, outstanding payments, trends, distribution.

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'sales_report', 'Sales Report', '{{report_title}} – {{period_label_formatted}}',
$body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:32px 16px;">
    <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#0369a1 0%,#0ea5e9 100%);padding:28px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Hatvoni Insider</div>
          <div style="color:#bae6fd;font-size:13px;margin-top:4px;">Sales Report</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 24px;">
          <div style="background:#e0f2fe;border-left:4px solid #0284c7;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:14px;font-weight:600;color:#0369a1;">{{report_title}}</div>
            <div style="font-size:13px;color:#0284c7;margin-top:4px;">Period: {{period_label_formatted}}</div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:12px;">Sales summary</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Total sales value</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{total_sales_value}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Total ordered quantity</td><td style="padding:6px 0;text-align:right;">{{total_ordered_quantity}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Completed orders count</td><td style="padding:6px 0;text-align:right;">{{total_orders_count}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Paid amount</td><td style="padding:6px 0;text-align:right;">{{paid_amount}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Pending amount</td><td style="padding:6px 0;text-align:right;">{{pending_amount}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Pending / Partial / Full payment orders</td><td style="padding:6px 0;text-align:right;">{{pending_payment_count}} / {{partial_payment_count}} / {{full_payment_count}}</td></tr>
              </table>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#ecfdf5;border-radius:12px;border:1px solid #a7f3d0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#065f46;font-weight:600;margin-bottom:12px;">Concentration (share of total)</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Top 1 customer</td><td style="padding:6px 0;text-align:right;">{{top1_customer_share}}%</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Top 3 customers</td><td style="padding:6px 0;text-align:right;">{{top3_customers_share}}%</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Top 5 customers</td><td style="padding:6px 0;text-align:right;">{{top5_customers_share}}%</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Top 1 product</td><td style="padding:6px 0;text-align:right;">{{top1_product_share}}%</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Top 3 products</td><td style="padding:6px 0;text-align:right;">{{top3_products_share}}%</td></tr>
              </table>
            </td></tr>
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Customer sales (period)</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Customer</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Type</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;">Orders</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Value</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Outstanding</th>
            </tr>
            {{customer_sales_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Product / tag sales (period)</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Product</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Qty</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Unit</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Value</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">%</th>
            </tr>
            {{product_sales_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#b91c1c;font-weight:600;margin-bottom:8px;">Outstanding payments ({{outstanding_count}})</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #fecaca;border-radius:8px;overflow:hidden;background:#fef2f2;">
            <tr style="background:#fee2e2;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#991b1b;">Customer</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#991b1b;">Order</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#991b1b;">Pending</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#991b1b;">Days</th>
            </tr>
            {{outstanding_payments_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Sales trend (by month)</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Month</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Sales value</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;">Orders</th>
            </tr>
            {{sales_trend_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Customer type distribution</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Type</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Sales</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;">Orders</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;">Customers</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">%</th>
            </tr>
            {{customer_type_distribution_table}}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Sales Report ({{period_label_formatted}})</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
$body$,
$text$
{{report_title}} – {{period_label_formatted}}

Summary: Total sales {{total_sales_value}}, Orders {{total_orders_count}}, Paid {{paid_amount}}, Pending {{pending_amount}}. Concentration: Top 1 customer {{top1_customer_share}}%, Top 3 products {{top3_products_share}}%. Outstanding: {{outstanding_count}}.

— Hatvoni Insider
$text$,
true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'sales_report');
