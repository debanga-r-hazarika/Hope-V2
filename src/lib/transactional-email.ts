import { supabase } from './supabase';
import type {
  EmailDistributionList,
  EmailDistributionListMember,
  EmailDistributionListMemberWithUser,
  EmailTemplate,
  EmailTriggerConfig,
  EmailTriggerConfigWithRelations,
  EmailSendLog,
  CreateDistributionListInput,
  UpdateDistributionListInput,
  UpdateEmailTemplateInput,
  UpdateTriggerConfigInput,
} from '../types/transactional-email';

/** Order-like shape for building email payloads (avoids pulling in full sales types). */
export interface OrderEventPayloadSource {
  id: string;
  order_number: string;
  order_date: string;
  customer_name?: string | null;
  customer_id?: string;
  status?: string;
  payment_status?: string;
  total_amount: number;
  discount_amount?: number | null;
  total_paid?: number | null;
  sold_by_name?: string | null;
  completed_at?: string | null;
  is_locked?: boolean;
  locked_at?: string | null;
  locked_by_name?: string | null;
  can_unlock_until?: string | null;
  is_on_hold?: boolean;
  hold_reason?: string | null;
  held_at?: string | null;
  held_by_name?: string | null;
  notes?: string | null;
  customer?: { name?: string; phone?: string; address?: string; customer_type?: string; contact_person?: string } | null;
  items?: Array<{
    product_type?: string;
    form?: string;
    size?: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    line_total?: number;
    processed_good_batch_reference?: string;
  }>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(s: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

function formatDateTime(s: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return s;
  }
}

function formatCurrency(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Base URL for order detail links in emails (env or current origin). */
export function getOrderDetailsBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return (import.meta as { env?: { VITE_APP_URL?: string } }).env?.VITE_APP_URL ?? '';
}

/** Base URL for operations links (lots, batches). */
function getOperationsBaseUrl(): string {
  const base = getOrderDetailsBaseUrl();
  return base ? base.replace(/\/$/, '') : '';
}

/** Build a consistent payload for all sales/order triggers. Use in templates as {{order_number}}, {{customer_name}}, {{items_table}}, etc. */
export function buildOrderEventPayload(
  order: OrderEventPayloadSource,
  options?: { event_message?: string; unlock_reason?: string; order_event_type?: string; order_details_url?: string }
): Record<string, unknown> {
  const netAmount = (order.total_amount ?? 0) - (order.discount_amount ?? 0);
  const items = order.items ?? [];
  const customerName = order.customer?.name ?? order.customer_name ?? '';
  const itemsSummary =
    items.length === 0
      ? 'No items'
      : items.length === 1
        ? `1 item: ${items[0]?.product_type ?? '—'}`
        : `${items.length} items`;
  const itemsList =
    items.length > 0
      ? items
          .map(
            (i) =>
              `${i.product_type ?? '—'} × ${i.quantity ?? 0} ${i.unit ?? ''} @ ${i.unit_price ?? 0} = ${i.line_total ?? 0}`
          )
          .join('; ')
      : '';

  const itemsTableRows =
    items.length > 0
      ? items
          .map((i) => {
            const product = escapeHtml(String(i.product_type ?? '—'));
            const details = [i.processed_good_batch_reference, i.form, i.size].filter(Boolean).join(' · ');
            const detailsCell = details ? `<span style="color:#64748b;font-size:12px;">${escapeHtml(details)}</span>` : '—';
            const qty = `${i.quantity ?? 0} ${(i.unit ?? '').trim()}`.trim() || '—';
            const unitPrice = formatCurrency(i.unit_price ?? 0);
            const lineTotal = formatCurrency(i.line_total ?? 0);
            return `<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;vertical-align:top;">${product}<br/>${detailsCell}</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(qty)}</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">${unitPrice}</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${lineTotal}</td></tr>`;
          })
          .join('')
      : '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No items</td></tr>';

  return {
    order_id: order.id,
    order_number: order.order_number ?? '',
    order_date: order.order_date ?? '',
    order_date_formatted: formatDate(order.order_date ?? ''),
    customer_name: customerName,
    customer_id: order.customer_id ?? '',
    customer_phone: order.customer?.phone ?? '',
    customer_address: order.customer?.address ?? '',
    customer_type: order.customer?.customer_type ?? '',
    contact_person: order.customer?.contact_person ?? '',
    status: order.status ?? '',
    payment_status: order.payment_status ?? '',
    total_amount: order.total_amount ?? 0,
    total_amount_formatted: formatCurrency(order.total_amount ?? 0),
    discount_amount: order.discount_amount ?? 0,
    discount_amount_formatted: formatCurrency(order.discount_amount ?? 0),
    total_paid: order.total_paid ?? 0,
    total_paid_formatted: formatCurrency(order.total_paid ?? 0),
    net_amount: netAmount,
    net_amount_formatted: formatCurrency(netAmount),
    sold_by_name: order.sold_by_name ?? '',
    completed_at: order.completed_at ?? '',
    completed_at_formatted: formatDateTime(order.completed_at ?? ''),
    is_locked: order.is_locked ?? false,
    locked_at: order.locked_at ?? '',
    locked_at_formatted: formatDateTime(order.locked_at ?? ''),
    locked_by_name: order.locked_by_name ?? '',
    can_unlock_until: order.can_unlock_until ?? '',
    can_unlock_until_formatted: formatDateTime(order.can_unlock_until ?? ''),
    is_on_hold: order.is_on_hold ?? false,
    hold_reason: order.hold_reason ?? '',
    held_at: order.held_at ?? '',
    held_at_formatted: formatDateTime(order.held_at ?? ''),
    held_by_name: order.held_by_name ?? '',
    notes: order.notes ?? '',
    event_message: options?.event_message ?? '',
    unlock_reason: options?.unlock_reason ?? '',
    order_event_type: options?.order_event_type ?? '',
    order_details_url: options?.order_details_url ?? '',
    items_summary: itemsSummary,
    items_list: itemsList,
    items_table: itemsTableRows,
  };
}

/** Lot payload source for raw material (no photo_urls in email). */
export interface RawMaterialLotPayloadSource {
  id: string;
  lot_id: string;
  name: string;
  supplier_name?: string | null;
  quantity_received: number;
  quantity_available: number;
  unit: string;
  condition?: string | null;
  received_date: string;
  storage_notes?: string | null;
  handover_to_name?: string | null;
  amount_paid?: number | null;
  is_archived?: boolean;
  usable: boolean;
  raw_material_tag_id?: string | null;
  created_at: string;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_at?: string;
  updated_by_name?: string | null;
  raw_material_tag_name?: string | null;
}

/** Build payload for raw material lot created email. Excludes photos. */
export function buildRawMaterialLotPayload(lot: RawMaterialLotPayloadSource): Record<string, unknown> {
  return {
    event_type: 'Raw Material Lot Created',
    lot_id: lot.lot_id ?? '',
    name: lot.name ?? '',
    supplier_name: lot.supplier_name ?? '',
    quantity_received: lot.quantity_received ?? 0,
    quantity_available: lot.quantity_available ?? 0,
    unit: lot.unit ?? '',
    condition: lot.condition ?? '',
    received_date: lot.received_date ?? '',
    received_date_formatted: formatDate(lot.received_date ?? ''),
    storage_notes: lot.storage_notes ?? '',
    handover_to_name: lot.handover_to_name ?? '',
    amount_paid: lot.amount_paid ?? 0,
    amount_paid_formatted: lot.amount_paid != null ? formatCurrency(lot.amount_paid) : '',
    is_archived: lot.is_archived ?? false,
    usable: lot.usable ?? true,
    usable_display: (lot.usable ?? true) ? 'Yes' : 'No',
    tag_name: (lot as { raw_material_tag_name?: string }).raw_material_tag_name ?? '',
    created_at: lot.created_at ?? '',
    created_at_formatted: formatDateTime(lot.created_at ?? ''),
    created_by_name: lot.created_by_name ?? '',
    updated_at: lot.updated_at ?? '',
    updated_at_formatted: formatDateTime(lot.updated_at ?? ''),
    updated_by_name: lot.updated_by_name ?? '',
    view_lot_url: `${getOperationsBaseUrl()}/operations/raw-materials${lot.lot_id ? `?lotId=${encodeURIComponent(lot.lot_id)}` : ''}`,
  };
}

/** Lot payload source for recurring product. */
export interface RecurringProductLotPayloadSource {
  id: string;
  lot_id: string;
  name: string;
  category: string;
  supplier_name?: string | null;
  quantity_received: number;
  quantity_available: number;
  unit: string;
  received_date: string;
  notes?: string | null;
  handover_to_name?: string | null;
  amount_paid?: number | null;
  is_archived?: boolean;
  recurring_product_tag_id?: string | null;
  created_at: string;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_at?: string;
  updated_by_name?: string | null;
  recurring_product_tag_name?: string | null;
}

/** Build payload for recurring product lot created email. */
export function buildRecurringProductLotPayload(lot: RecurringProductLotPayloadSource): Record<string, unknown> {
  return {
    event_type: 'Recurring Product Lot Created',
    lot_id: lot.lot_id ?? '',
    name: lot.name ?? '',
    category: lot.category ?? '',
    supplier_name: lot.supplier_name ?? '',
    quantity_received: lot.quantity_received ?? 0,
    quantity_available: lot.quantity_available ?? 0,
    unit: lot.unit ?? '',
    received_date: lot.received_date ?? '',
    received_date_formatted: formatDate(lot.received_date ?? ''),
    notes: lot.notes ?? '',
    handover_to_name: lot.handover_to_name ?? '',
    amount_paid: lot.amount_paid ?? 0,
    amount_paid_formatted: lot.amount_paid != null ? formatCurrency(lot.amount_paid) : '',
    is_archived: lot.is_archived ?? false,
    tag_name: (lot as { recurring_product_tag_name?: string }).recurring_product_tag_name ?? '',
    created_at: lot.created_at ?? '',
    created_at_formatted: formatDateTime(lot.created_at ?? ''),
    created_by_name: lot.created_by_name ?? '',
    updated_at: lot.updated_at ?? '',
    updated_at_formatted: formatDateTime(lot.updated_at ?? ''),
    updated_by_name: lot.updated_by_name ?? '',
    view_lot_url: `${getOperationsBaseUrl()}/operations/recurring-products${lot.lot_id ? `?lotId=${encodeURIComponent(lot.lot_id)}` : ''}`,
  };
}

/** Payload source for production batch completed (batch + raw materials + recurring products + outputs + created processed goods). */
export interface ProductionBatchCompletedPayloadSource {
  batch: {
    id: string;
    batch_id: string;
    batch_date: string;
    responsible_user_name?: string | null;
    qa_status: string;
    is_locked: boolean;
    production_start_date?: string | null;
    production_end_date?: string | null;
    notes?: string | null;
    additional_information?: string | null;
    qa_reason?: string | null;
    custom_fields?: string | null;
  };
  rawMaterials: Array<{ raw_material_name: string; lot_id: string; quantity_consumed: number; unit: string }>;
  recurringProducts: Array<{ recurring_product_name: string; quantity_consumed: number; unit: string }>;
  outputs: Array<{
    output_name: string;
    produced_goods_tag_name?: string | null;
    output_size?: number | null;
    output_size_unit?: string | null;
    produced_quantity: number;
    produced_unit: string;
  }>;
  processedGoods: Array<{
    product_type: string;
    batch_reference: string;
    quantity_available: number;
    quantity_created?: number | null;
    unit: string;
    production_date: string;
    qa_status: string;
    output_size?: number | null;
    output_size_unit?: string | null;
    produced_goods_tag_name?: string | null;
  }>;
}

/** Build payload for production batch completed email (batch details + produced goods). */
export function buildProductionBatchCompletedPayload(source: ProductionBatchCompletedPayloadSource): Record<string, unknown> {
  const { batch, rawMaterials, recurringProducts, outputs, processedGoods } = source;
  let customFieldsDisplay = '';
  if (batch.custom_fields) {
    try {
      const arr = typeof batch.custom_fields === 'string' ? JSON.parse(batch.custom_fields) : batch.custom_fields;
      if (Array.isArray(arr) && arr.length > 0) {
        customFieldsDisplay = arr
          .map((f: { key?: string; value?: string }) => `${escapeHtml(String(f?.key ?? ''))}: ${escapeHtml(String(f?.value ?? ''))}`)
          .join('<br/>');
      }
    } catch {
      customFieldsDisplay = escapeHtml(String(batch.custom_fields));
    }
  }
  const rawMaterialsRows = rawMaterials.length
    ? rawMaterials
        .map(
          (m) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(m.raw_material_name)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(m.lot_id)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${m.quantity_consumed} ${escapeHtml(m.unit)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3" style="padding:12px;color:#64748b;">None</td></tr>';
  const recurringRows = recurringProducts.length
    ? recurringProducts
        .map(
          (p) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(p.recurring_product_name)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${p.quantity_consumed} ${escapeHtml(p.unit)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="2" style="padding:12px;color:#64748b;">None</td></tr>';
  const outputsRows = outputs.length
    ? outputs
        .map(
          (o) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(o.output_name)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(o.produced_goods_tag_name ?? '')}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${o.output_size != null && o.output_size_unit ? `${o.output_size} ${escapeHtml(o.output_size_unit)}` : '—'}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${o.produced_quantity} ${escapeHtml(o.produced_unit)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="4" style="padding:12px;color:#64748b;">None</td></tr>';
  const processedRows = processedGoods.length
    ? processedGoods
        .map(
          (g) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(g.product_type)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(g.produced_goods_tag_name ?? '')}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(g.batch_reference)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${g.output_size != null && g.output_size_unit ? `${g.output_size} ${escapeHtml(g.output_size_unit)}` : '—'}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${g.quantity_available} ${escapeHtml(g.unit)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${formatDate(g.production_date)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="6" style="padding:12px;color:#64748b;">None</td></tr>';

  return {
    event_type: 'Production Batch Completed',
    batch_id: batch.batch_id ?? '',
    batch_date: batch.batch_date ?? '',
    batch_date_formatted: formatDate(batch.batch_date ?? ''),
    batch_status: batch.is_locked ? 'Locked' : 'Draft',
    qa_status: batch.qa_status ?? 'pending',
    responsible_user_name: batch.responsible_user_name ?? '',
    production_start_date: batch.production_start_date ?? '',
    production_start_date_formatted: batch.production_start_date ? formatDate(batch.production_start_date) : '',
    production_end_date: batch.production_end_date ?? '',
    production_end_date_formatted: batch.production_end_date ? formatDate(batch.production_end_date) : '',
    notes: batch.notes ?? '',
    additional_information: batch.additional_information ?? '',
    qa_reason: batch.qa_reason ?? '',
    custom_fields_display: customFieldsDisplay,
    raw_materials_table: rawMaterialsRows,
    recurring_products_table: recurringRows,
    outputs_table: outputsRows,
    processed_goods_table: processedRows,
    outputs_count: outputs.length,
    processed_goods_count: processedGoods.length,
    view_batch_url: `${getOperationsBaseUrl()}/operations/production${batch.batch_id ? `?batchId=${encodeURIComponent(batch.batch_id)}` : ''}`,
  };
}

/** Invoke the transactional email Edge Function (e.g. after order creation). Fire-and-forget; does not throw. */
export async function notifyTransactionEmail(
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.functions.invoke('send-transactional-email', {
      body: { event, payload },
    });
  } catch (_) {
    // Fire-and-forget: do not block or surface errors to the user
  }
}

/** Call the Edge Function and return the result (for testing). Pass templateId and distributionListId to use current form selection (test mode) when trigger is not saved yet. */
export async function sendTestTransactionEmail(
  event: string,
  payload: Record<string, unknown>,
  options?: { templateId?: string; distributionListId?: string }
): Promise<{ data?: { sent?: boolean; recipientCount?: number; error?: string; reason?: string }; error?: Error }> {
  try {
    const body: { event: string; payload: Record<string, unknown>; template_id?: string; distribution_list_id?: string } = { event, payload };
    if (options?.templateId && options?.distributionListId) {
      body.template_id = options.templateId;
      body.distribution_list_id = options.distributionListId;
    }
    const { data, error } = await supabase.functions.invoke('send-transactional-email', { body });
    if (error) return { error };
    return { data: data as { sent?: boolean; recipientCount?: number; error?: string; reason?: string } };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// --- Distribution lists ---

export async function fetchDistributionLists(): Promise<EmailDistributionList[]> {
  const { data, error } = await supabase
    .from('email_distribution_lists')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw new Error(`Failed to fetch distribution lists: ${error.message}`);
  return data ?? [];
}

export async function createDistributionList(
  input: CreateDistributionListInput
): Promise<EmailDistributionList> {
  const { data, error } = await supabase
    .from('email_distribution_lists')
    .insert({
      name: input.name,
      description: input.description ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create distribution list: ${error.message}`);
  return data;
}

export async function updateDistributionList(
  id: string,
  input: UpdateDistributionListInput
): Promise<EmailDistributionList> {
  const { data, error } = await supabase
    .from('email_distribution_lists')
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update distribution list: ${error.message}`);
  return data;
}

export async function deleteDistributionList(id: string): Promise<void> {
  const { error } = await supabase.from('email_distribution_lists').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete distribution list: ${error.message}`);
}

// --- Distribution list members ---

export async function fetchDistributionListMembers(
  distributionListId: string
): Promise<EmailDistributionListMemberWithUser[]> {
  const { data, error } = await supabase
    .from('email_distribution_list_members')
    .select('id, distribution_list_id, user_id, created_at, user:users(id, full_name, email)')
    .eq('distribution_list_id', distributionListId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to fetch distribution list members: ${error.message}`);
  return (data ?? []) as unknown as EmailDistributionListMemberWithUser[];
}

export async function addDistributionListMember(
  distributionListId: string,
  userId: string
): Promise<EmailDistributionListMember> {
  const { data, error } = await supabase
    .from('email_distribution_list_members')
    .insert({ distribution_list_id: distributionListId, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(`Failed to add member: ${error.message}`);
  return data;
}

export async function removeDistributionListMember(
  distributionListId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('email_distribution_list_members')
    .delete()
    .eq('distribution_list_id', distributionListId)
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}

// --- Email templates ---

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('trigger_key', { ascending: true });
  if (error) throw new Error(`Failed to fetch email templates: ${error.message}`);
  return data ?? [];
}

export async function updateEmailTemplate(
  id: string,
  input: UpdateEmailTemplateInput
): Promise<EmailTemplate> {
  const updatePayload: Record<string, unknown> = {};
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.subject !== undefined) updatePayload.subject = input.subject;
  if (input.body_html !== undefined) updatePayload.body_html = input.body_html;
  if (input.body_text !== undefined) updatePayload.body_text = input.body_text;
  const { data, error } = await supabase
    .from('email_templates')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update email template: ${error.message}`);
  return data;
}

// --- Trigger config ---

export async function fetchTriggerConfig(): Promise<EmailTriggerConfigWithRelations[]> {
  const { data, error } = await supabase
    .from('email_trigger_config')
    .select(
      'id, trigger_key, template_id, distribution_list_id, enabled, created_at, updated_at, template:email_templates(*), distribution_list:email_distribution_lists(*)'
    )
    .order('trigger_key', { ascending: true });
  if (error) throw new Error(`Failed to fetch trigger config: ${error.message}`);
  return (data ?? []) as unknown as EmailTriggerConfigWithRelations[];
}

export async function upsertTriggerConfig(
  triggerKey: string,
  input: { template_id: string; distribution_list_id: string; enabled: boolean }
): Promise<EmailTriggerConfig> {
  const { data, error } = await supabase
    .from('email_trigger_config')
    .upsert(
      {
        trigger_key: triggerKey,
        template_id: input.template_id,
        distribution_list_id: input.distribution_list_id,
        enabled: input.enabled,
      },
      { onConflict: 'trigger_key' }
    )
    .select()
    .single();
  if (error) throw new Error(`Failed to save trigger config: ${error.message}`);
  return data;
}

/** Fetch active users for adding to distribution lists (id, full_name, email). */
export async function fetchUsersForMemberPicker(): Promise<
  { id: string; full_name: string; email: string }[]
> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('is_active', true)
    .order('full_name', { ascending: true });
  if (error) throw new Error(`Failed to fetch users: ${error.message}`);
  return (data ?? []).filter((u) => u.email);
}

export async function updateTriggerConfig(
  triggerKey: string,
  input: UpdateTriggerConfigInput
): Promise<EmailTriggerConfig> {
  const updatePayload: Record<string, unknown> = {};
  if (input.template_id !== undefined) updatePayload.template_id = input.template_id;
  if (input.distribution_list_id !== undefined)
    updatePayload.distribution_list_id = input.distribution_list_id;
  if (input.enabled !== undefined) updatePayload.enabled = input.enabled;
  const { data, error } = await supabase
    .from('email_trigger_config')
    .update(updatePayload)
    .eq('trigger_key', triggerKey)
    .select()
    .single();
  if (error) throw new Error(`Failed to update trigger config: ${error.message}`);
  return data;
}

// --- Email send log ---

export interface FetchEmailLogsOptions {
  triggerKey?: string;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  status?: 'success' | 'error'; // success = error_message is null
  limit?: number;
  offset?: number;
}

export async function fetchEmailLogs(
  options: FetchEmailLogsOptions = {}
): Promise<{ logs: EmailSendLog[]; total: number }> {
  const { triggerKey, fromDate, toDate, status, limit = 50, offset = 0 } = options;
  let query = supabase
    .from('email_send_log')
    .select('id, trigger_key, recipient_count, sent_at, payload_snapshot, error_message', { count: 'exact' })
    .order('sent_at', { ascending: false });

  if (triggerKey) query = query.eq('trigger_key', triggerKey);
  if (fromDate) query = query.gte('sent_at', `${fromDate}T00:00:00.000Z`);
  if (toDate) query = query.lte('sent_at', `${toDate}T23:59:59.999Z`);
  if (status === 'success') query = query.is('error_message', null);
  if (status === 'error') query = query.not('error_message', 'is', null);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(`Failed to fetch email logs: ${error.message}`);
  return { logs: (data ?? []) as EmailSendLog[], total: count ?? 0 };
}
