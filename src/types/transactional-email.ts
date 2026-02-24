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

/** Known trigger keys for the UI (sales / order lifecycle) */
export const TRANSACTIONAL_EMAIL_TRIGGER_KEYS = [
  { key: 'order_daily_digest', label: 'Daily order digest (11:30 PM IST)' },
  { key: 'sale_created', label: 'Sale created' },
  { key: 'order_completed', label: 'Order completed' },
  { key: 'order_locked', label: 'Order locked' },
  { key: 'order_unlocked', label: 'Order unlocked' },
  { key: 'order_hold', label: 'Order put on hold' },
  { key: 'order_hold_removed', label: 'Order hold removed' },
] as const;

export type TransactionalEmailTriggerKey = (typeof TRANSACTIONAL_EMAIL_TRIGGER_KEYS)[number]['key'];
