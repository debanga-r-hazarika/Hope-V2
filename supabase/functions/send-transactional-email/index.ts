// Transactional email Edge Function: event-driven send via SMTP
// Body: { event: string, payload: Record<string, unknown> }
// Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_FROM_NAME (optional), SMTP_SECURE (optional)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.5.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function replacePlaceholders(text: string, payload: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const v = payload[key];
    return v != null ? String(v) : "";
  });
}

/** Build RFC 5322 From header: "Display Name <email@domain.com>" or just "email@domain.com" */
function buildFromAddress(email: string, displayName?: string | null): string {
  const trimmed = (email || "").trim();
  if (!trimmed) return "";
  const name = (displayName || "").trim().replace(/"/g, "");
  if (!name) return trimmed;
  return `"${name}" <${trimmed}>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const event = body?.event as string | undefined;
    const payload = (body?.payload ?? {}) as Record<string, unknown>;
    // Test mode: use these when provided (e.g. from Admin "Send test email" with current form selection)
    const testTemplateId = body?.template_id as string | undefined;
    const testDistributionListId = body?.distribution_list_id as string | undefined;
    const useTestOverrides = testTemplateId && testDistributionListId;

    if (!event) {
      return new Response(
        JSON.stringify({ error: "Missing event" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let templateId: string;
    let distributionListId: string;

    if (useTestOverrides) {
      templateId = testTemplateId;
      distributionListId = testDistributionListId;
    } else {
      const { data: config, error: configError } = await supabase
        .from("email_trigger_config")
        .select("id, template_id, distribution_list_id, enabled")
        .eq("trigger_key", event)
        .maybeSingle();

      if (configError || !config || !config.enabled) {
        return new Response(
          JSON.stringify({ sent: false, reason: "trigger disabled or not configured" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      templateId = config.template_id;
      distributionListId = config.distribution_list_id;
    }

    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("subject, body_html, body_text")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ sent: false, reason: "template not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: members, error: membersError } = await supabase
      .from("email_distribution_list_members")
      .select("user_id")
      .eq("distribution_list_id", distributionListId);

    if (membersError || !members?.length) {
      return new Response(
        JSON.stringify({ sent: true, recipientCount: 0, reason: "no recipients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = members.map((m) => m.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, auth_user_id")
      .in("id", userIds);

    if (usersError) {
      return new Response(
        JSON.stringify({ sent: false, reason: "Failed to load users: " + usersError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!users?.length) {
      return new Response(
        JSON.stringify({ sent: false, reason: "No users found for the distribution list member IDs. Check that members are from the Users table." }),
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
        JSON.stringify({ sent: false, reason: "No valid emails: DL members have no email in Users or Auth. Set email in Admin → Users, or ensure users signed up with email." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let subject = replacePlaceholders(template.subject, payload).trim();
    if (!subject && event === "raw_material_lot_created") {
      subject = "New Raw Material Lot";
    } else if (!subject && event === "recurring_product_lot_created") {
      subject = "New Recurring Product Lot";
    }
    const bodyHtml = replacePlaceholders(template.body_html, payload);
    const bodyText = template.body_text
      ? replacePlaceholders(template.body_text, payload)
      : bodyHtml.replace(/<[^>]+>/g, "");

    const host = Deno.env.get("SMTP_HOST");
    const port = parseInt(Deno.env.get("SMTP_PORT") ?? "587", 10);
    const user = Deno.env.get("SMTP_USER");
    const password = Deno.env.get("SMTP_PASSWORD");
    const fromEmail = Deno.env.get("SMTP_FROM");
    // Default so display name always shows in inbox (set SMTP_FROM_NAME to override)
    const fromName = Deno.env.get("SMTP_FROM_NAME")?.trim() || "Hatvoni Insider";
    const secure = Deno.env.get("SMTP_SECURE") === "true" || port === 465;

    if (!host || !user || !password || !fromEmail) {
      await supabase.from("email_send_log").insert({
        trigger_key: event,
        recipient_count: 0,
        payload_snapshot: payload,
        error_message: "SMTP not configured (missing SMTP_HOST, SMTP_USER, SMTP_PASSWORD, or SMTP_FROM)",
      });
      return new Response(
        JSON.stringify({ sent: false, reason: "SMTP not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const from = buildFromAddress(fromEmail, fromName);

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: secure,
        auth: { username: user, password },
      },
    });

    if (toEmails.length === 0) {
      return new Response(
        JSON.stringify({ sent: false, reason: "No valid email addresses to send to." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    for (const toAddress of toEmails) {
      const to = (toAddress || "").trim();
      if (!to) continue;
      await client.send({
        from,
        to,
        subject,
        content: bodyText,
        html: bodyHtml,
      });
    }
    await client.close();

    await supabase.from("email_send_log").insert({
      trigger_key: event,
      recipient_count: toEmails.length,
      payload_snapshot: payload,
      error_message: null,
    });

    return new Response(
      JSON.stringify({ sent: true, recipientCount: toEmails.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("email_send_log").insert({
        trigger_key: "unknown",
        recipient_count: 0,
        payload_snapshot: {},
        error_message: message,
      });
    } catch (_) {}
    return new Response(
      JSON.stringify({ sent: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
