-- Professional email templates for new Raw Material Lot and Recurring Product Lot (Operations module).
-- All lot details included; no photos. Placeholders use empty string when missing.

-- Raw Material Lot Created
INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'raw_material_lot_created', 'Raw material lot created', '{{event_type}} – {{lot_id}} – {{name}}',
$body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Hatvoni Insider</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Operations – New Raw Material Lot</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 24px;">
          <div style="background:#ecfdf5;border-left:4px solid #059669;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:14px;font-weight:600;color:#047857;">{{event_type}}</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
            <tr>
              <td style="padding:16px 0;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:4px;">Lot</div>
                <div style="font-size:18px;font-weight:700;color:#0f172a;">{{lot_id}}</div>
                <div style="font-size:15px;color:#475569;margin-top:4px;">{{name}}</div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:12px;">Lot details</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Tag</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{tag_name}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Supplier</td><td style="padding:6px 0;text-align:right;">{{supplier_name}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Quantity received</td><td style="padding:6px 0;text-align:right;">{{quantity_received}} {{unit}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Quantity available</td><td style="padding:6px 0;text-align:right;">{{quantity_available}} {{unit}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Unit</td><td style="padding:6px 0;text-align:right;">{{unit}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Condition</td><td style="padding:6px 0;text-align:right;">{{condition}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Received date</td><td style="padding:6px 0;text-align:right;">{{received_date_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Storage notes</td><td style="padding:6px 0;text-align:right;">{{storage_notes}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Handover to</td><td style="padding:6px 0;text-align:right;">{{handover_to_name}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Amount paid</td><td style="padding:6px 0;text-align:right;">{{amount_paid_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Usable</td><td style="padding:6px 0;text-align:right;">{{usable_display}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Created at</td><td style="padding:6px 0;text-align:right;">{{created_at_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Created by</td><td style="padding:6px 0;text-align:right;">{{created_by_name}}</td></tr>
              </table>
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
Lot: {{lot_id}} – {{name}}
Tag: {{tag_name}} · Supplier: {{supplier_name}}
Quantity: {{quantity_received}} / {{quantity_available}} {{unit}}
Condition: {{condition}} · Received: {{received_date_formatted}}
Storage notes: {{storage_notes}} · Handover: {{handover_to_name}}
Amount paid: {{amount_paid_formatted}} · Usable: {{usable_display}}
Created: {{created_at_formatted}} by {{created_by_name}}
— Hatvoni Insider
$text$,
true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'raw_material_lot_created');

-- Recurring Product Lot Created
INSERT INTO email_templates (trigger_key, name, subject, body_html, body_text, is_system)
SELECT 'recurring_product_lot_created', 'Recurring product lot created', '{{event_type}} – {{lot_id}} – {{name}}',
$body$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#334155;">
  <tr><td style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#1e3a5f 0%,#334155 100%);padding:28px 32px;text-align:center;">
          <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Hatvoni Insider</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Operations – New Recurring Product Lot</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 24px;">
          <div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:14px;font-weight:600;color:#b45309;">{{event_type}}</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
            <tr>
              <td style="padding:16px 0;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:4px;">Lot</div>
                <div style="font-size:18px;font-weight:700;color:#0f172a;">{{lot_id}}</div>
                <div style="font-size:15px;color:#475569;margin-top:4px;">{{name}}</div>
                <div style="font-size:13px;color:#64748b;margin-top:2px;">Category: {{category}}</div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr><td style="padding:20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:12px;">Lot details</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:6px 0;color:#64748b;">Tag</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{tag_name}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Category</td><td style="padding:6px 0;text-align:right;">{{category}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Supplier</td><td style="padding:6px 0;text-align:right;">{{supplier_name}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Quantity received</td><td style="padding:6px 0;text-align:right;">{{quantity_received}} {{unit}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Quantity available</td><td style="padding:6px 0;text-align:right;">{{quantity_available}} {{unit}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Unit</td><td style="padding:6px 0;text-align:right;">{{unit}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Received date</td><td style="padding:6px 0;text-align:right;">{{received_date_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Notes</td><td style="padding:6px 0;text-align:right;">{{notes}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Handover to</td><td style="padding:6px 0;text-align:right;">{{handover_to_name}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Amount paid</td><td style="padding:6px 0;text-align:right;">{{amount_paid_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Created at</td><td style="padding:6px 0;text-align:right;">{{created_at_formatted}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Created by</td><td style="padding:6px 0;text-align:right;">{{created_by_name}}</td></tr>
              </table>
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
Lot: {{lot_id}} – {{name}} ({{category}})
Tag: {{tag_name}} · Supplier: {{supplier_name}}
Quantity: {{quantity_received}} / {{quantity_available}} {{unit}}
Received: {{received_date_formatted}} · Notes: {{notes}}
Handover: {{handover_to_name}} · Amount paid: {{amount_paid_formatted}}
Created: {{created_at_formatted}} by {{created_by_name}}
— Hatvoni Insider
$text$,
true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger_key = 'recurring_product_lot_created');
