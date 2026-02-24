// Daily order digest: find new and updated orders for a given date (IST), send one email per order.
// Body: { date?: "YYYY-MM-DD" } — default: today in Asia/Kolkata.
// Env: SMTP_* (same as send-transactional-email), APP_BASE_URL (e.g. https://app.hatvoni.tech)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.5.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayBoundsIST(dateStr: string): { start: string; end: string } {
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(`${dateStr}T23:59:59.999+05:30`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function replacePlaceholders(text: string, payload: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const v = payload[key];
    return v != null ? String(v) : "";
  });
}

function buildFromAddress(email: string, displayName?: string | null): string {
  const trimmed = (email || "").trim();
  if (!trimmed) return "";
  const name = (displayName || "").trim().replace(/"/g, "");
  if (!name) return trimmed;
  return `"${name}" <${trimmed}>`;
}

function formatDate(s: string): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

function formatCurrency(n: number): string {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOrderBadge(order: {
  status?: string;
  payment_status?: string;
  is_on_hold?: boolean;
}): string {
  if (order.is_on_hold) return "HOLD";
  if (order.status === "ORDER_COMPLETED") return "ORDER COMPLETED";
  if (order.payment_status === "PARTIAL_PAYMENT") return "Partially Paid";
  if (order.status === "READY_FOR_PAYMENT") return "READY FOR PAYMENT";
  return "ORDER CREATED";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        sent: 0,
        newOrders: 0,
        updatedOrders: 0,
        error: "Server config missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set for Edge Function",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dateStr = (body?.date as string) || todayIST();

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").replace(/\/$/, "");

    const { data: config, error: configError } = await supabase
      .from("email_trigger_config")
      .select("id, template_id, distribution_list_id, enabled")
      .eq("trigger_key", "order_daily_digest")
      .maybeSingle();

    if (configError || !config || !config.enabled) {
      return new Response(
        JSON.stringify({ sent: 0, newOrders: 0, updatedOrders: 0, reason: "order_daily_digest disabled or not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("subject, body_html, body_text")
      .eq("id", config.template_id)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ sent: 0, newOrders: 0, updatedOrders: 0, reason: "template not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: members, error: membersError } = await supabase
      .from("email_distribution_list_members")
      .select("user_id")
      .eq("distribution_list_id", config.distribution_list_id);

    if (membersError || !members?.length) {
      return new Response(
        JSON.stringify({ sent: 0, newOrders: 0, updatedOrders: 0, reason: "no recipients in distribution list" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = members.map((m) => m.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, auth_user_id")
      .in("id", userIds);

    if (usersError || !users?.length) {
      return new Response(
        JSON.stringify({ sent: 0, newOrders: 0, updatedOrders: 0, reason: "no valid users for DL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toEmails: string[] = [];
    for (const u of users) {
      let email = ((u as { email?: string }).email ?? "").trim();
      if (!email && (u as { auth_user_id?: string }).auth_user_id) {
        const { data: authData } = await supabase.auth.admin.getUserById((u as { auth_user_id: string }).auth_user_id);
        if (authData?.user?.email) email = authData.user.email.trim();
      }
      if (email) toEmails.push(email);
    }
    if (toEmails.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, newOrders: 0, updatedOrders: 0, reason: "no valid emails for DL members" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { start, end } = dayBoundsIST(dateStr);

    const { data: newOrdersRows } = await supabase
      .from("orders")
      .select("id")
      .gte("created_at", start)
      .lte("created_at", end);

    const { data: updatedOrdersRows } = await supabase
      .from("orders")
      .select("id")
      .gte("updated_at", start)
      .lte("updated_at", end)
      .lt("created_at", start);

    const newIds = new Set((newOrdersRows || []).map((r) => r.id));
    const updatedIds = new Set((updatedOrdersRows || []).map((r) => r.id));
    const allIds = [...newIds, ...updatedIds];
    if (allIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, newOrders: 0, updatedOrders: 0, reason: "no new or updated orders for " + dateStr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip orders we already sent a digest for on this date (prevents duplicate emails when re-running the digest)
    const { data: alreadySentRows } = await supabase
      .from("order_digest_sent")
      .select("order_id")
      .eq("digest_date", dateStr);
    const alreadySentIds = new Set((alreadySentRows || []).map((r) => (r as { order_id: string }).order_id));
    const orderIdsToSend = allIds.filter((id) => !alreadySentIds.has(id));
    if (orderIdsToSend.length === 0) {
      return new Response(
        JSON.stringify({
          sent: 0,
          newOrders: newIds.size,
          updatedOrders: updatedIds.size,
          reason: "no new emails to send (all orders for this date were already sent)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: ordersData } = await supabase
      .from("orders")
      .select("*, customer:customers(*), sold_by_user:users!orders_sold_by_fkey(full_name)")
      .in("id", orderIdsToSend);

    const orders = ordersData || [];
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("*, processed_good:processed_goods(batch_reference, output_size, output_size_unit)")
      .in("order_id", allIds);

    const { data: paymentsData } = await supabase
      .from("order_payments")
      .select("*")
      .in("order_id", allIds)
      .order("payment_date", { ascending: false });

    const itemsByOrder: Record<string, unknown[]> = {};
    for (const i of itemsData || []) {
      const oid = (i as { order_id: string }).order_id;
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
      itemsByOrder[oid].push(i);
    }
    const paymentsByOrder: Record<string, unknown[]> = {};
    for (const p of paymentsData || []) {
      const oid = (p as { order_id: string }).order_id;
      if (!paymentsByOrder[oid]) paymentsByOrder[oid] = [];
      paymentsByOrder[oid].push(p);
    }

    const host = Deno.env.get("SMTP_HOST");
    const port = parseInt(Deno.env.get("SMTP_PORT") ?? "587", 10);
    const user = Deno.env.get("SMTP_USER");
    const password = Deno.env.get("SMTP_PASSWORD");
    const fromEmail = Deno.env.get("SMTP_FROM");
    const fromName = Deno.env.get("SMTP_FROM_NAME")?.trim() || "Hatvoni Insider";
    const secure = Deno.env.get("SMTP_SECURE") === "true" || port === 465;

    if (!host || !user || !password || !fromEmail) {
      return new Response(
        JSON.stringify({ sent: 0, newOrders: newIds.size, updatedOrders: updatedIds.size, reason: "SMTP not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: secure,
        auth: { username: user, password },
      },
    });
    const from = buildFromAddress(fromEmail, fromName);

    let sentCount = 0;
    for (const order of orders) {
      const o = order as {
        id: string;
        order_number: string;
        order_date: string;
        created_at?: string;
        updated_at?: string;
        total_amount: number;
        discount_amount?: number;
        status?: string;
        payment_status?: string;
        is_on_hold?: boolean;
        notes?: string;
        third_party_delivery_enabled?: boolean;
        customer?: { name?: string } | null;
        sold_by_user?: { full_name?: string } | null;
      };
      const items = (itemsByOrder[o.id] || []) as Array<{
        product_type?: string;
        quantity?: number;
        unit?: string;
        unit_price?: number;
        line_total?: number;
        processed_good?: { batch_reference?: string; output_size?: string; output_size_unit?: string };
      }>;
      const payments = (paymentsByOrder[o.id] || []) as Array<{
        payment_date?: string;
        amount_received?: number;
        payment_mode?: string;
      }>;

      const netAmount = (o.total_amount ?? 0) - (o.discount_amount ?? 0);
      const totalPaid = payments.reduce((sum, p) => sum + (p.amount_received ?? 0), 0);
      const outstanding = Math.max(0, netAmount - totalPaid);

      const orderBadge = buildOrderBadge(o);
      const isNew = newIds.has(o.id);
      const isUpdatedOnly = updatedIds.has(o.id);
      // Same-day update: order was created this date but also updated this date (e.g. payment added) → show "Order Updated"
      const updatedAt = o.updated_at ? new Date(o.updated_at).getTime() : 0;
      const createdAt = o.created_at ? new Date(o.created_at).getTime() : 0;
      const updatedSameDay = isNew && updatedAt > createdAt && updatedAt >= new Date(start).getTime() && updatedAt <= new Date(end).getTime();
      const orderEventType = isUpdatedOnly || updatedSameDay ? "Order Updated" : isNew ? "Order Created" : "Order Updated";
      const orderDetailsUrl = appBaseUrl ? `${appBaseUrl}/sales/orders/${o.id}` : "";

      const itemsTableRows =
        items.length > 0
          ? items
              .map((i) => {
                const name = escapeHtml(String(i.product_type ?? "—"));
                const pg = i.processed_good;
                const batch = pg?.batch_reference ?? "";
                const size = [pg?.output_size, pg?.output_size_unit].filter(Boolean).join(" ");
                const details = [batch, size].filter(Boolean).join(" · ");
                const detailsCell = details ? `<span style="color:#64748b;font-size:12px;">${escapeHtml(details)}</span>` : "—";
                const qty = `${i.quantity ?? 0} ${(i.unit ?? "").trim()}`.trim() || "—";
                const unitPrice = formatCurrency(i.unit_price ?? 0);
                const lineTotal = formatCurrency(i.line_total ?? 0);
                return `<tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;vertical-align:top;">${name}<br/>${detailsCell}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(qty)}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;">${unitPrice}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${lineTotal}</td></tr>`;
              })
              .join("")
          : "<tr><td colspan=\"4\" style=\"padding:16px;text-align:center;color:#94a3b8;\">No items</td></tr>";

      const paymentsTableRows =
        payments.length > 0
          ? payments
              .map((p) => {
                const d = formatDate(p.payment_date ?? "");
                const amt = formatCurrency(p.amount_received ?? 0);
                const mode = escapeHtml(String(p.payment_mode ?? "—"));
                return `<tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${d}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;">${amt}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${mode}</td></tr>`;
              })
              .join("")
          : "<tr><td colspan=\"3\" style=\"padding:16px;text-align:center;color:#94a3b8;\">No payments yet</td></tr>";

      const paymentsTablePlain =
        payments.length > 0
          ? payments
              .map((p) => `${formatDate(p.payment_date ?? "")} ${formatCurrency(p.amount_received ?? 0)} ${p.payment_mode ?? ""}`)
              .join("; ")
          : "None";

      const payload: Record<string, unknown> = {
        order_event_type: orderEventType,
        order_badge: orderBadge,
        order_number: o.order_number ?? "",
        order_date_formatted: formatDate(o.order_date ?? ""),
        customer_name: o.customer?.name ?? "",
        sold_by_name: o.sold_by_user?.full_name ?? "",
        notes: o.notes ?? "—",
        items_table: itemsTableRows,
        total_amount_formatted: formatCurrency(o.total_amount ?? 0),
        discount_amount_formatted: formatCurrency(o.discount_amount ?? 0),
        net_amount_formatted: formatCurrency(netAmount),
        total_paid_formatted: formatCurrency(totalPaid),
        outstanding_amount_formatted: formatCurrency(outstanding),
        payments_table: paymentsTableRows,
        payments_table_plain: paymentsTablePlain,
        third_party_delivery_label: o.third_party_delivery_enabled ? "Yes" : "No",
        order_details_url: orderDetailsUrl,
      };

      const subject = replacePlaceholders(template.subject, payload);
      const bodyHtml = replacePlaceholders(template.body_html, payload);
      const bodyText = template.body_text
        ? replacePlaceholders(template.body_text, payload)
        : bodyHtml.replace(/<[^>]+>/g, "");

      for (const to of toEmails) {
        const toAddr = (to || "").trim();
        if (!toAddr) continue;
        await client.send({
          from,
          to: toAddr,
          subject,
          content: bodyText,
          html: bodyHtml,
        });
        sentCount++;
      }
      // Mark this order as sent for this date so we don't re-send if digest runs again
      await supabase.from("order_digest_sent").upsert(
        { order_id: o.id, digest_date: dateStr },
        { onConflict: "order_id,digest_date" }
      );
    }
    await client.close();

    return new Response(
      JSON.stringify({
        sent: sentCount,
        newOrders: newIds.size,
        updatedOrders: updatedIds.size,
        reason: `Sent ${sentCount} email(s) for ${orders.length} order(s) (${newIds.size} new, ${updatedIds.size} updated)`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ sent: 0, newOrders: 0, updatedOrders: 0, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
