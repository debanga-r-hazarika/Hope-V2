# Order Email Redesign & Daily Digest – Design & Plan

## 1. Goals

1. **Single premium transactional email** for both **Order Created** and **Order Updated**, matching Order Details UI, with clear subject and CTA.
2. **Daily digest at 11:30 PM IST**: automatically find **new orders** and **updated orders** for the day and send emails to a selected distribution list.

---

## 2. Order Email Redesign

### 2.1 Trigger Model (Simplified)

| Scenario | Trigger key | Subject line |
|----------|-------------|--------------|
| New order created | `order_created` | **Order Created – {order_number} – {customer_name}** |
| Any order update | `order_updated` | **Order Updated – {order_number} – {customer_name}** |

**Updates** include: new payment, order completed, order locked/unlocked, hold placed/removed, notes updated, third-party delivery toggled.

- **One reusable template** for both; subject uses `{{order_event_type}}` (“Order Created” | “Order Updated”) and `{{order_number}}`, `{{customer_name}}`.
- Existing granular triggers (`order_completed`, `order_locked`, etc.) can be kept for backward compatibility or removed in favour of only `order_created` + `order_updated`.

### 2.2 Mandatory Data & Sections

| Section | Data | Template variables |
|--------|------|--------------------|
| **Header** | Brand: Hatvoni Insider | — |
| **Order badge** | ORDER COMPLETED / ORDER CREATED / READY FOR PAYMENT / Partially Paid / HOLD | `{{order_badge}}` |
| **Order summary** | Customer name, Order ID (number), Sold by, Order date, Notes (only if present) | `{{customer_name}}`, `{{order_number}}`, `{{sold_by_name}}`, `{{order_date_formatted}}`, `{{notes}}` |
| **Order items table** | Item name + output size/unit, Batch ID, Quantity, Unit price, Line total | `{{items_table}}` (pre-built HTML rows) |
| **Payment summary card** | Subtotal, Discount, Net total, Paid amount, Outstanding amount | `{{total_amount_formatted}}`, `{{discount_amount_formatted}}`, `{{net_amount_formatted}}`, `{{total_paid_formatted}}`, `{{outstanding_amount_formatted}}` |
| **Payment history table** | Date, Amount, Mode (Cash/UPI/Bank) | `{{payments_table}}` (pre-built HTML rows) |
| **Delivery** | Third-party delivery: Yes / No | `{{third_party_delivery_label}}` |
| **CTA** | “View Order Details” → deep link | `{{order_details_url}}` |

- **order_details_url**: full URL to the order details page, e.g. `https://yourapp.com/sales/orders/{order_id}`. Must be passed in the payload (client or cron sends it).

### 2.3 Payload Additions (client / digest job)

- `order_event_type`: `"Order Created"` | `"Order Updated"`
- `order_badge`: derived from status + payment + hold (e.g. `ORDER COMPLETED`, `HOLD`, `READY FOR PAYMENT`, `Partially Paid`)
- `order_details_url`: full URL to `/sales/orders/{order_id}` (base URL from app config or env, e.g. `VITE_APP_URL`)
- `outstanding_amount`, `outstanding_amount_formatted`: net total − total paid
- `payments_table`: HTML rows for each payment (date, amount, mode)
- `third_party_delivery_label`: “Yes” / “No” (from `third_party_delivery_enabled`)
- Items table: ensure columns **Item name + output size/unit**, **Batch ID**, **Quantity**, **Unit price**, **Line total** (already have batch; add output_size/unit if missing in payload)

### 2.4 Design Requirements

- Corporate, premium, neutral palette; clear hierarchy: summary → items → payments → delivery → CTA.
- Email-safe HTML + inline CSS; mobile-friendly; Gmail/Outlook safe.
- Hide empty sections (e.g. no notes, no payments) via conditional blocks or “—” in template.

---

## 3. When to Send: Detection Logic

### 3.1 Real-time (current app flow)

| Event | Trigger key | Where |
|-------|-------------|--------|
| Order created (Orders → Create) | `order_created` | `Orders.tsx` after `createOrder()` |
| Payment added/deleted, status → completed, lock, unlock, hold, hold removed, notes saved, third-party delivery toggled | `order_updated` | `OrderDetail.tsx`: after `loadOrder()` when any relevant field changed (compare prev vs current order); or after each mutation (payment, lock, hold, notes, delivery) |

**Recommendation:** Keep detecting transitions in `OrderDetail` after `loadOrder()` (status, is_locked, is_on_hold, total_paid, notes, third_party_delivery_enabled) and call `notifyTransactionEmail('order_updated', buildOrderEventPayload(data, { order_event_type: 'Order Updated', order_details_url: ... }))`. On create, call `notifyTransactionEmail('order_created', buildOrderEventPayload(newOrder, { order_event_type: 'Order Created', order_details_url: ... }))`.

### 3.2 Daily digest at 11:30 PM IST

**Objective:** Once per day at 11:30 PM IST, identify:

- **New orders:** `created_at` within “today” in IST.
- **Updated orders:** `updated_at` within “today” in IST, but `created_at` before today (so we don’t send “updated” for orders that were also created today).

Then send **one email per order** (using the same order template) to a selected DL, with:

- For orders created today → `order_event_type: "Order Created"`, trigger `order_created` (or a dedicated `order_daily_digest` that uses the same template).
- For orders only updated today → `order_event_type: "Order Updated"`, trigger `order_updated` (or same digest trigger).

**Data for digest:**

- Query orders with full relations (customer, items with batch/size/unit, payments).
- “Today” in IST: use a time window, e.g. `created_at >= 'today 00:00 IST' AND created_at < 'tomorrow 00:00 IST'` for new; `updated_at >= 'today 00:00 IST' AND updated_at < 'tomorrow 00:00 IST' AND created_at < 'today 00:00 IST'` for updated. (Exact syntax depends on DB; can use `AT TIME ZONE 'Asia/Kolkata'` and date comparison.)

**Who sends:**

- **Option A – Edge Function + external cron:**  
  - New Edge Function, e.g. `order-daily-digest`, that:  
    - Accepts optional date (default: “today” IST).  
    - Loads trigger config for `order_daily_digest` (or reuses `order_created`/`order_updated` with a “digest” DL).  
    - Queries new + updated orders for that day (with items, payments, customer).  
    - For each order, builds payload (including `order_details_url` from a configured base URL), sets `order_event_type`, and sends one email per order to the DL (reuse existing send-transactional-email logic or call it internally).  
  - External cron (e.g. GitHub Actions, Vercel Cron, or a small server) at **18:00 UTC** (= 11:30 PM IST) calls this Edge Function (e.g. POST with optional `date`).

- **Option B – Supabase pg_cron (if available):**  
  - Schedule a DB function that inserts into a “digest queue” table or directly invokes the Edge Function via `net.http_post` or similar.  
  - Less portable; depends on Supabase plan.

**Recommendation:** Option A (Edge Function + external cron). Same template and payload as real-time; only the **invocation** is scheduled.

---

## 4. Implementation Phases

### Phase 1 – Order email template & payload (no digest)

1. **Payload (lib + types)**  
   - Add to `OrderEventPayloadSource`: `payments` (array), `third_party_delivery_enabled`, items with `processed_good_output_size`, `processed_good_output_size_unit`.  
   - In `buildOrderEventPayload`:  
     - Compute `order_badge` from status, payment_status, is_on_hold.  
     - Add `order_event_type`, `order_details_url` (from options), `outstanding_amount`, `outstanding_amount_formatted`, `payments_table` (HTML rows), `third_party_delivery_label`.  
     - Build `items_table` with columns: Item name + output size/unit, Batch ID, Qty, Unit price, Line total.

2. **App: order details URL**  
   - When calling `notifyTransactionEmail` for order_created/order_updated, pass `order_details_url: `${window.location.origin}/sales/orders/${order.id}`` (or from `import.meta.env.VITE_APP_URL` if set).

3. **Trigger keys**  
   - Use `order_created` and `order_updated` (and optionally deprecate granular triggers or map them to `order_updated`).

4. **Template (DB + migration)**  
   - One HTML template with: header (Hatvoni Insider), order badge, order summary, items table, payment summary card, payment history table (hide if no payments), delivery line, CTA button (View Order Details → `{{order_details_url}}`).  
   - Subject: `{{order_event_type}} – {{order_number}} – {{customer_name}}`.  
   - Use placeholders above; hide notes section if `{{notes}}` empty; payment history section if no rows.

5. **Invocation**  
   - Orders: on create → `order_created` with `order_event_type: 'Order Created'`, `order_details_url`.  
   - OrderDetail: on transitions (payment, completed, lock, unlock, hold, notes, delivery) → `order_updated` with `order_event_type: 'Order Updated'`, `order_details_url`.

### Phase 2 – Daily digest at 11:30 PM IST

1. **Edge Function: `order-daily-digest`**  
   - Input: optional `date` (YYYY-MM-DD); default = today in IST.  
   - Read trigger config for e.g. `order_daily_digest` (template_id, distribution_list_id, enabled).  
   - Query orders:  
     - New: `created_at` in that day IST.  
     - Updated: `updated_at` in that day IST, `created_at` not in that day.  
   - For each order, fetch full order (customer, items, payments).  
   - Base URL for links: from env `APP_BASE_URL` (e.g. `https://app.hatvoni.tech`).  
   - For each order: build payload (same as Phase 1), set `order_event_type` (“Order Created” / “Order Updated”), call existing send logic (or shared helper) to send one email per order to the DL.

2. **Trigger key + config**  
   - Add `order_daily_digest` (or reuse `order_created`/`order_updated` with a separate “Digest” DL).  
   - One template can serve both real-time and digest (same placeholders).

3. **Cron**  
   - External: e.g. GitHub Actions workflow cron `0 18 * * *` (18:00 UTC = 11:30 PM IST) calling the Edge Function URL (with Supabase anon key or a secret).  
   - Or Vercel Cron / other host that hits the function once per day.

4. **Admin**  
   - Optional: “Daily digest” section to pick DL and enable/disable; stores config for `order_daily_digest`.

---

## 5. Test without waiting for 11:30 PM IST

- In **Admin → Transactional Email → Triggers**, find **Daily order digest (11:30 PM IST)**.
- Configure template and distribution list, enable the trigger, and click **Save**.
- Use **Run digest now (test)**:
  - Choose a **date** (default: today). The function finds new orders (created that date) and updated orders (updated that date, created earlier).
  - Click **Run digest now (test)**. The Edge Function runs immediately and sends one email per order to the DL.
  - Result shows: *Sent X email(s). New orders: Y, Updated orders: Z.*

No need to wait for the real cron time to verify behaviour.

---

## 6. Cron setup for 11:30 PM IST

- **11:30 PM IST = 18:00 UTC** (same calendar day).
- Call the Edge Function once per day at 18:00 UTC, e.g.:
  - **GitHub Actions:** workflow with `schedule: cron('0 18 * * *')` that `curl -X POST` your Supabase function URL with `Authorization: Bearer <anon_or_service_role_key>` and optional body `{}` (for today) or `{"date":"YYYY-MM-DD"}`.
  - **Vercel Cron / other:** same idea — HTTP POST to `https://<project-ref>.supabase.co/functions/v1/order-daily-digest` with the same headers/body.
- **Edge Function secret:** set `APP_BASE_URL` (e.g. `https://app.hatvoni.tech`) so “View Order Details” links in the email point to your app.

---

## 7. Summary

- **No real-time emails:** Order emails are not sent when an order is created or updated. They are sent only by the daily digest.
- **One template** for the digest: subject `{{order_event_type}} – {{order_number}} – {{customer_name}}`, with order badge, summary, items table, payment summary, payment history, third-party delivery, and CTA `{{order_details_url}}`.
- **Daily digest:** At 11:30 PM IST (or when you click “Run digest now (test)”), the Edge Function finds new orders (created that day) and updated orders (updated that day, created earlier), then sends one email per order to the configured DL.
- **Test:** Use **Admin → Transactional Email → Triggers → Daily order digest → Run digest now (test)** with a date to test without waiting for 11:30 PM IST.
- **Cron:** Call the `order-daily-digest` Edge Function at 18:00 UTC (11:30 PM IST) daily. Set `APP_BASE_URL` in Edge Function secrets so “View Order Details” links work.
