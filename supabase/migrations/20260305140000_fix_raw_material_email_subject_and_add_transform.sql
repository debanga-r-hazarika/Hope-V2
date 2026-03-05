-- Fix Raw Material Lot Created email subject line (clearer, consistent)
UPDATE email_templates
SET subject = 'New Raw Material Lot: {{lot_id}} – {{name}}'
WHERE trigger_key = 'raw_material_lot_created';

-- Add email template for Raw Material Transform (Banana → Banana Peel, etc.)
INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'raw_material_transform', 'Raw material transformed', 'Raw Material Transformed: {{source_lot_id}} → {{new_lot_id}}',
$body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);padding:28px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Hatvoni Insider</div>
          <div style="color:#c4b5fd;font-size:13px;margin-top:4px;">Operations – Raw Material Transform</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 24px;">
          <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:14px;font-weight:600;color:#5b21b6;">{{event_type}}</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
            <tr>
              <td style="padding:16px 0;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:4px;">Source → New lot</div>
                <div style="font-size:16px;font-weight:700;color:#0f172a;">{{source_lot_id}} → {{new_lot_id}}</div>
                <div style="font-size:14px;color:#475569;margin-top:4px;">{{source_lot_name}} → {{new_lot_name}}</div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:12px;">Transform details</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Quantity processed (source)</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{quantity_processed}} {{source_unit}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Output quantity (new lot)</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{output_quantity}} {{output_unit}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Transform date</td><td style="padding:6px 0;text-align:right;">{{transform_date_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Transformed by</td><td style="padding:6px 0;text-align:right;">{{transformed_by_name}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Steps</td><td style="padding:6px 0;text-align:right;">{{steps_display}}</td></tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
            <tr><td style="padding:12px 0;text-align:center;">
              <a href="{{view_source_url}}" style="display:inline-block;padding:10px 20px;background:#e2e8f0;color:#334155;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">View source lot</a>
              <span style="margin:0 8px;color:#94a3b8;">·</span>
              <a href="{{view_new_lot_url}}" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">View new lot</a>
            </td></tr>
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
Source: {{source_lot_id}} ({{source_lot_name}}) → New: {{new_lot_id}} ({{new_lot_name}})
Quantity processed: {{quantity_processed}} {{source_unit}} → Output: {{output_quantity}} {{output_unit}}
Transform date: {{transform_date_formatted}} · By: {{transformed_by_name}}
Steps: {{steps_display}}
View source: {{view_source_url}}
View new lot: {{view_new_lot_url}}
— Hatvoni Insider
$text$,
true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'raw_material_transform');
