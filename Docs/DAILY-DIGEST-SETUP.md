# Daily Order Digest – Setup Guide

This guide explains **Option 3 (APP_BASE_URL secret)** and **Option 4 (Cron)** in simple steps.

---

## How the digest works

### How we decide “Order Created” vs “Order Updated”

- **New orders (for the chosen date in IST):** `created_at` falls on that date → subject uses **“Order Created”**.
- **Updated orders (for the chosen date):** `updated_at` falls on that date and `created_at` is **before** that date → subject uses **“Order Updated”**.
- **Created and updated the same day:** If an order was created on the 23rd and later updated on the 23rd (e.g. payment added), the subject shows **“Order Updated”** so the email reflects the latest change, not just creation.

So: “Order Created” only when the order was created that day and not updated that day; otherwise “Order Updated”.

### Will an order be re-sent on the next day?

**No.** The digest for **24th** only includes orders whose **`updated_at`** (or **`created_at`** for new) falls on **24th** in IST. An order that was only updated on the 23rd has `updated_at` on the 23rd, so it is **not** included in the 24th run. You get one digest per order per calendar day when it was new or updated.

### Preventing duplicate emails when you run the digest multiple times

If you run the digest **several times for the same date** (e.g. “Run digest now” or “Run workflow” in GitHub Actions multiple times), the app **does not** send the same order email again for that date. We record each sent email in a table **`order_digest_sent`** (per order, per digest date). The second run for the same date sees that those orders were already sent and skips them, returning something like: *“no new emails to send (all orders for this date were already sent)”*.

---

## Option 3: Set the `APP_BASE_URL` secret

### What it is

The digest email has a **“View Order Details”** button. That button must open your app on the correct order page, e.g.:

`https://your-app.com/sales/orders/abc-123-order-id`

The Edge Function does not know your app’s URL. You tell it by setting a **secret** named `APP_BASE_URL`.

### What happens if you don’t set it

- The button link in the email will be empty or wrong.
- Recipients won’t be able to open the order in your app from the email.

### How to set it

1. Open **Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Project Settings** (gear icon in the left sidebar).
3. Click **Edge Functions** in the left menu.
4. Find **Secrets** (or “Function secrets”).
5. Add a new secret:
  - **Name:** `APP_BASE_URL`
  - **Value:** The full URL of your app **without** a trailing slash.

Examples:

- If your app is at `https://app.hatvoni.tech` → use `**https://app.hatvoni.tech`**
- If you use Vercel and the URL is `https://hatvoni-insider.vercel.app` → use `**https://hatvoni-insider.vercel.app**`
- For local testing you could use `http://localhost:5173` (only for testing).

1. Save. The `order-daily-digest` function will then build links like:
  `https://app.hatvoni.tech/sales/orders/<order-id>`

**Summary:** In Supabase → Project Settings → Edge Functions → Secrets, add `APP_BASE_URL` = your app’s base URL (e.g. `https://app.hatvoni.tech`).

---

## Option 4: Cron setup (run digest every day at 11:30 PM IST)

### What it is

Right now the digest runs **only when you click “Run digest now (test)”** in Admin.  
**Cron** means something external calls your Edge Function **once per day at 11:30 PM IST** so the digest runs automatically every day without you doing anything.

### Do you need it?

- **No** if you are fine clicking “Run digest now (test)” yourself when you want to send the digest.
- **Yes** if you want the digest to run automatically every day at 11:30 PM IST.

### Time conversion

- **11:30 PM IST** = **6:00 PM UTC** (18:00 UTC) on the **same calendar day**.
- So the cron job should run at **18:00 UTC** every day.

### How to set up cron

You need **something** that can send an HTTP request every day at 18:00 UTC. Common options:

---

#### A. GitHub Actions (recommended, free)

A ready-to-use workflow is in the repo: `**.github/workflows/daily-order-digest.yml`**.

1. **Add two GitHub repository secrets** (Settings → Secrets and variables → Actions):
  - `**SUPABASE_PROJECT_REF`** – Your Supabase project ref (e.g. `abcdefghij` from `https://abcdefghij.supabase.co`). Find it in Supabase Dashboard → Project Settings → API → Project URL.
  - `**SUPABASE_ANON_KEY**` – Your anon/public key from Supabase Dashboard → Project Settings → API.
2. Commit and push the workflow file if it isn’t already in the repo. GitHub will run it every day at **18:00 UTC** (11:30 PM IST).
3. To test without waiting: in GitHub go to **Actions → Daily order digest → Run workflow** and click “Run workflow”.

---

#### B. Supabase “Cron” (if available)

Some Supabase plans offer **pg_cron** or a built-in way to run functions on a schedule. If your project has that:

- Create a job that runs at **18:00 UTC** and triggers the `order-daily-digest` function (e.g. via `net.http_post` or the method Supabase documents).

---

#### C. Other cron services

- **Vercel Cron:** If the app is on Vercel, you can add a cron job that runs at 18:00 UTC and calls the Edge Function URL.
- **Any server or serverless function** that can run on a schedule: make a POST request to  
`https://<your-project-ref>.supabase.co/functions/v1/order-daily-digest`  
with header `Authorization: Bearer <your-anon-or-service-role-key>` and body `{}` (for “today”) or `{"date":"YYYY-MM-DD"}`.

---

### What URL to call

- **Method:** POST  
- **URL:** `https://<project-ref>.supabase.co/functions/v1/order-daily-digest`  
Replace `<project-ref>` with your Supabase project reference (e.g. `abcdefghij` from the project URL).
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-anon-key-or-service-role-key>`
- **Body (optional):**  
  - `{}` → digest for **today** (in IST).  
  - `{"date":"2025-02-21"}` → digest for that specific date.

You can find the project ref and anon key in Supabase Dashboard → Project Settings → API.

---

## Troubleshooting: "Edge Function returned a non-2xx status code"

When you click **Run digest now (test)** and see this message, the request to the Edge Function did not succeed. Common causes:

1. **Not logged in or session expired**  
   The digest is invoked with your current session. Log in again as an admin and try **Run digest now** again.

2. **Function not deployed**  
   In Supabase Dashboard → **Edge Functions**, confirm **order-daily-digest** is listed and deployed. Redeploy with:  
   `supabase functions deploy order-daily-digest`

3. **Function crash or timeout**  
   In Supabase Dashboard → **Edge Functions** → **order-daily-digest** → **Logs**, check for errors (e.g. missing secrets, database errors). Ensure these are set in Project Settings → Edge Functions → **Secrets**:  
   **SMTP_HOST**, **SMTP_USER**, **SMTP_PASSWORD**, **SMTP_FROM** (and optionally **SMTP_PORT**, **SMTP_FROM_NAME**, **APP_BASE_URL**).  
   **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** are set automatically by Supabase; you do not add them.

If the app can read the response body, you may see a more specific message (e.g. from the function or gateway) instead of the generic line above.

---

## Quick checklist


| Step                   | What to do                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3. APP_BASE_URL**    | Supabase → Project Settings → Edge Functions → Secrets → Add `APP_BASE_URL` = your app URL (e.g. `https://app.hatvoni.tech`).                                                                                                                                             |
| **4. Cron (optional)** | Add GitHub secrets `SUPABASE_PROJECT_REF` and `SUPABASE_ANON_KEY`; the workflow in `.github/workflows/daily-order-digest.yml` runs the digest every day at 18:00 UTC (11:30 PM IST). Or use Vercel Cron / another scheduler to POST to `order-daily-digest` at that time. |


