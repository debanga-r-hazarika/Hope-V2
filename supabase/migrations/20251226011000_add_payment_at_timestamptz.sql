-- Add payment_at column with time for all finance tables and backfill
alter table if exists public.contributions
  add column if not exists payment_at timestamptz;

alter table if exists public.income
  add column if not exists payment_at timestamptz;

alter table if exists public.expenses
  add column if not exists payment_at timestamptz;

-- Backfill from existing payment_date (assumed date) to midnight UTC (keeps legacy data)
update public.contributions
set payment_at = coalesce(payment_at, payment_date);

update public.income
set payment_at = coalesce(payment_at, payment_date);

update public.expenses
set payment_at = coalesce(payment_at, payment_date);


