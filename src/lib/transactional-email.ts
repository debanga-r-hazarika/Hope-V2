import { supabase } from './supabase';
import type {
  EmailDistributionList,
  EmailDistributionListMember,
  EmailDistributionListMemberWithUser,
  EmailTemplate,
  EmailTriggerConfig,
  EmailTriggerConfigWithRelations,
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

/** Build a consistent payload for all sales/order triggers. Use in templates as {{order_number}}, {{customer_name}}, {{items_table}}, etc. */
export function buildOrderEventPayload(
  order: OrderEventPayloadSource,
  options?: { event_message?: string; unlock_reason?: string }
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
    items_summary: itemsSummary,
    items_list: itemsList,
    items_table: itemsTableRows,
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

/** Call the Edge Function and return the result (for testing). */
export async function sendTestTransactionEmail(
  event: string,
  payload: Record<string, unknown>
): Promise<{ data?: { sent?: boolean; recipientCount?: number; error?: string; reason?: string }; error?: Error }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: { event, payload },
    });
    if (error) return { error };
    return { data: data as { sent?: boolean; recipientCount?: number; error?: string; reason?: string } };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/** Run the daily order digest (new + updated orders for the given date). Use for testing or cron. */
export async function invokeOrderDailyDigest(date?: string): Promise<{
  data?: { sent: number; newOrders: number; updatedOrders: number; reason?: string };
  error?: Error;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('order-daily-digest', {
      body: date ? { date } : {},
    });
    if (error) {
      // When the function returns non-2xx, try to read the response body for a clearer message
      const errWithContext = error as { message?: string; context?: Response };
      if (errWithContext.context && typeof errWithContext.context.json === 'function') {
        try {
          const body = await errWithContext.context.json() as { error?: string; reason?: string };
          const msg = body?.error || body?.reason || errWithContext.message;
          return { error: new Error(msg || 'Digest request failed') };
        } catch {
          // ignore parse error
        }
      }
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
    return {
      data: data as {
        sent: number;
        newOrders: number;
        updatedOrders: number;
        reason?: string;
      },
    };
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
