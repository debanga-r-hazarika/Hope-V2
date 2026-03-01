-- Finance Report email template (manual run by admin for a date range).
-- Data comes from Finance Analytics: metrics, income, expenses, cash flow, receivables.

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'finance_report', 'Finance Report', '{{report_title}} – {{period_label_formatted}}',
$body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:32px 16px;">
    <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#0e7490 0%,#0891b2 100%);padding:28px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Hatvoni Insider</div>
          <div style="color:#a5f3fc;font-size:13px;margin-top:4px;">Finance Report</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 24px;">
          <div style="background:#ecfeff;border-left:4px solid #0891b2;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:14px;font-weight:600;color:#0e7490;">{{report_title}}</div>
            <div style="font-size:13px;color:#0891b2;margin-top:4px;">Period: {{period_label_formatted}}</div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:12px;">Key metrics (KPIs)</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Revenue growth rate</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{revenue_growth_rate}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Net cash flow</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{net_cash_flow}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Operational margin</td><td style="padding:6px 0;text-align:right;">{{operational_margin}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Gross margin</td><td style="padding:6px 0;text-align:right;">{{gross_margin}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">ROI</td><td style="padding:6px 0;text-align:right;">{{roi}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Expense-to-revenue ratio</td><td style="padding:6px 0;text-align:right;">{{expense_to_revenue_ratio}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Customer concentration</td><td style="padding:6px 0;text-align:right;">{{customer_concentration_ratio}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Receivables ratio</td><td style="padding:6px 0;text-align:right;">{{receivables_ratio}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Avg. collection period (days)</td><td style="padding:6px 0;text-align:right;">{{average_collection_period_days}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Inventory turnover ratio</td><td style="padding:6px 0;text-align:right;">{{inventory_turnover_ratio}}</td></tr>
              </table>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#166534;font-weight:600;margin-bottom:12px;">Cash flow summary</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Total income</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{cash_flow_total_income}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Total expenses</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{cash_flow_total_expenses}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Net cash flow</td><td style="padding:6px 0;text-align:right;font-weight:700;">{{cash_flow_net}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Status</td><td style="padding:6px 0;text-align:right;">{{cash_flow_status}}</td></tr>
              </table>
            </td></tr>
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Income summary</div>
          <p style="margin:0 0 8px;font-size:14px;">Total: {{total_income}} (Sales: {{sales_income}}, Other: {{other_income}})</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Source</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Amount</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;">Count</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">%</th>
            </tr>
            {{income_by_source_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Expenses by category</div>
          <p style="margin:0 0 8px;font-size:14px;">Total: {{total_expenses}}</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Category</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Amount</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;">Count</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">%</th>
            </tr>
            {{expenses_by_category_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Expenses by payment mode</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Payment method</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Amount</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;">Count</th>
            </tr>
            {{expenses_by_payment_mode_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#b91c1c;font-weight:600;margin-bottom:8px;">Outstanding receivables ({{receivables_count}})</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #fecaca;border-radius:8px;overflow:hidden;background:#fef2f2;">
            <tr style="background:#fee2e2;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#991b1b;">Customer</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#991b1b;">Order value</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#991b1b;">Received</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#991b1b;">Pending</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#991b1b;">Days</th>
            </tr>
            {{outstanding_receivables_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Cash flow trend (by month)</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Month</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Income</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Expenses</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Net</th>
            </tr>
            {{cash_flow_trend_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Receivables analytics (risk)</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Customer</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Outstanding</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;">Days</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Risk</th>
            </tr>
            {{receivables_analytics_table}}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Finance Report ({{period_label_formatted}})</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
$body$,
$text$
{{report_title}} – {{period_label_formatted}}

Key metrics: Revenue growth {{revenue_growth_rate}}, Net cash flow {{net_cash_flow}}, Operational margin {{operational_margin}}, Gross margin {{gross_margin}}, ROI {{roi}}, Expense/revenue {{expense_to_revenue_ratio}}, Customer concentration {{customer_concentration_ratio}}, Receivables ratio {{receivables_ratio}}, Avg collection {{average_collection_period_days}} days, Inventory turnover {{inventory_turnover_ratio}}.

Cash flow: Income {{cash_flow_total_income}}, Expenses {{cash_flow_total_expenses}}, Net {{cash_flow_net}} ({{cash_flow_status}}).

Income: {{total_income}}. Expenses: {{total_expenses}}. Outstanding receivables: {{receivables_count}}.

— Hatvoni Insider
$text$,
true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'finance_report');
