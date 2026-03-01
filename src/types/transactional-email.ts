export interface EmailDistributionList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailDistributionListMember {
  id: string;
  distribution_list_id: string;
  user_id: string;
  created_at: string;
}

export interface EmailDistributionListMemberWithUser extends EmailDistributionListMember {
  user?: { id: string; full_name: string; email: string } | null;
}

export interface EmailTemplate {
  id: string;
  trigger_key: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTriggerConfig {
  id: string;
  trigger_key: string;
  template_id: string;
  distribution_list_id: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTriggerConfigWithRelations extends EmailTriggerConfig {
  template?: EmailTemplate | null;
  distribution_list?: EmailDistributionList | null;
}

export interface CreateDistributionListInput {
  name: string;
  description?: string | null;
}

export interface UpdateDistributionListInput {
  name?: string;
  description?: string | null;
}

export interface UpdateEmailTemplateInput {
  name?: string;
  subject?: string;
  body_html?: string;
  body_text?: string | null;
}

export interface UpdateTriggerConfigInput {
  template_id?: string;
  distribution_list_id?: string;
  enabled?: boolean;
}

/** Known trigger keys for the UI (only triggers that send emails in the app) */
export const TRANSACTIONAL_EMAIL_TRIGGER_KEYS = [
  { key: 'order_created', label: 'Order created' },
  { key: 'order_payment_received', label: 'Order payment received' },
  { key: 'order_completed', label: 'Order completed' },
  { key: 'order_locked', label: 'Order locked' },
  { key: 'order_hold', label: 'Order put on hold' },
  { key: 'raw_material_lot_created', label: 'Raw material lot created' },
  { key: 'recurring_product_lot_created', label: 'Recurring product lot created' },
  { key: 'production_batch_completed', label: 'Production batch completed (processed goods created)' },
  { key: 'finance_report', label: 'Finance report (manual)' },
  { key: 'sales_report', label: 'Sales report (manual)' },
  { key: 'inventory_report', label: 'Inventory report (manual)' },
] as const;

export type TransactionalEmailTriggerKey = (typeof TRANSACTIONAL_EMAIL_TRIGGER_KEYS)[number]['key'];

export interface EmailSendLog {
  id: string;
  trigger_key: string;
  recipient_count: number;
  sent_at: string;
  payload_snapshot: Record<string, unknown> | null;
  error_message: string | null;
}
