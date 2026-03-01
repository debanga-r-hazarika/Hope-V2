-- Professional email template for Production Batch Completed (processed goods created).
-- Includes full batch details: batch info, raw materials, packaging, outputs, and created processed goods.

INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'production_batch_completed', 'Production batch completed (processed goods created)', '{{event_type}} – {{batch_id}}',
$body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:32px 16px;">
    <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#4338ca 0%,#6366f1 100%);padding:28px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Hatvoni Insider</div>
          <div style="color:#c7d2fe;font-size:13px;margin-top:4px;">Operations – Production Batch Completed</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 24px;">
          <div style="background:#eef2ff;border-left:4px solid #6366f1;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:14px;font-weight:600;color:#4338ca;">{{event_type}}</div>
            <div style="font-size:13px;color:#4f46e5;margin-top:4px;">Batch {{batch_id}} · {{batch_date_formatted}}</div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:12px;">Batch details</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Batch ID</td><td style="padding:6px 0;text-align:right;font-weight:600;font-family:monospace;">{{batch_id}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Batch date</td><td style="padding:6px 0;text-align:right;">{{batch_date_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Status</td><td style="padding:6px 0;text-align:right;">{{batch_status}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">QA status</td><td style="padding:6px 0;text-align:right;">{{qa_status}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Responsible</td><td style="padding:6px 0;text-align:right;">{{responsible_user_name}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Production start</td><td style="padding:6px 0;text-align:right;">{{production_start_date_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Production end</td><td style="padding:6px 0;text-align:right;">{{production_end_date_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Notes</td><td style="padding:6px 0;text-align:right;">{{notes}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Additional information</td><td style="padding:6px 0;text-align:right;white-space:pre-wrap;">{{additional_information}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">QA reason</td><td style="padding:6px 0;text-align:right;">{{qa_reason}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Custom fields</td><td style="padding:6px 0;text-align:right;">{{custom_fields_display}}</td></tr>
              </table>
            </td></tr>
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Raw materials used</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Material</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Lot</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Quantity</th>
            </tr>
            {{raw_materials_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Packaging / consumables used</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Product</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Quantity</th>
            </tr>
            {{recurring_products_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:8px;">Batch outputs ({{outputs_count}})</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Output</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Tag</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Size</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Quantity</th>
            </tr>
            {{outputs_table}}
          </table>

          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#059669;font-weight:600;margin-bottom:8px;">Processed goods created ({{processed_goods_count}})</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;font-size:14px;border:1px solid #a7f3d0;border-radius:8px;overflow:hidden;background:#f0fdf4;">
            <tr style="background:#d1fae5;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#065f46;">Product</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#065f46;">Tag</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#065f46;">Batch ref</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#065f46;">Size</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#065f46;">Qty</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#065f46;">Production date</th>
            </tr>
            {{processed_goods_table}}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Operations</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
$body$,
$text$
{{event_type}}
Batch: {{batch_id}} · {{batch_date_formatted}}
Status: {{batch_status}} · QA: {{qa_status}} · Responsible: {{responsible_user_name}}
Production: {{production_start_date_formatted}} – {{production_end_date_formatted}}
Notes: {{notes}}
Additional: {{additional_information}}
QA reason: {{qa_reason}}

Raw materials used: (see table in HTML)
Packaging used: (see table in HTML)
Outputs: {{outputs_count}}
Processed goods created: {{processed_goods_count}}

— Hatvoni Insider
$text$,
true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'production_batch_completed');
