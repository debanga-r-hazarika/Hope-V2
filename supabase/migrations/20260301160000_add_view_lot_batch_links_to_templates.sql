-- Add "Click here to view the lot" / "Click here to view the batch" section to email templates.
-- Placeholders: {{view_lot_url}}, {{view_batch_url}} (provided by payload builders).

-- Raw Material Lot: add click-to-view section before footer
UPDATE email_templates
SET body_html = REPLACE(
  body_html,
  E'      </tr>\n      <tr>\n        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">\n          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Operations</div>\n        </td>\n      </tr>\n    </table>\n  </td></tr>\n</table>',
  E'      </tr>\n      <tr>\n        <td style="padding:16px 32px 24px;text-align:center;">\n          <a href="{{view_lot_url}}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Click here to view the lot</a>\n        </td>\n      </tr>\n      <tr>\n        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">\n          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Operations</div>\n        </td>\n      </tr>\n    </table>\n  </td></tr>\n</table>'
)
WHERE trigger_key = 'raw_material_lot_created';

-- Recurring Product Lot: add click-to-view section before footer
UPDATE email_templates
SET body_html = REPLACE(
  body_html,
  E'      </tr>\n      <tr>\n        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">\n          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Operations</div>\n        </td>\n      </tr>\n    </table>\n  </td></tr>\n</table>',
  E'      </tr>\n      <tr>\n        <td style="padding:16px 32px 24px;text-align:center;">\n          <a href="{{view_lot_url}}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Click here to view the lot</a>\n        </td>\n      </tr>\n      <tr>\n        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">\n          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Operations</div>\n        </td>\n      </tr>\n    </table>\n  </td></tr>\n</table>'
)
WHERE trigger_key = 'recurring_product_lot_created';

-- Production Batch Completed: add click-to-view section before footer
UPDATE email_templates
SET body_html = REPLACE(
  body_html,
  E'        </td>\n      </tr>\n      <tr>\n        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">\n          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Operations</div>\n        </td>\n      </tr>\n    </table>\n  </td></tr>\n</table>',
  E'        </td>\n      </tr>\n      <tr>\n        <td style="padding:16px 32px 24px;text-align:center;">\n          <a href="{{view_batch_url}}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Click here to view the batch</a>\n        </td>\n      </tr>\n      <tr>\n        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">\n          <div style="font-size:12px;color:#94a3b8;">Hatvoni Insider · Operations</div>\n        </td>\n      </tr>\n    </table>\n  </td></tr>\n</table>'
)
WHERE trigger_key = 'production_batch_completed';

-- Update body_text for all three templates
UPDATE email_templates
SET body_text = body_text || E'\n\nView the lot: {{view_lot_url}}'
WHERE trigger_key IN ('raw_material_lot_created', 'recurring_product_lot_created');

UPDATE email_templates
SET body_text = body_text || E'\n\nView the batch: {{view_batch_url}}'
WHERE trigger_key = 'production_batch_completed';
