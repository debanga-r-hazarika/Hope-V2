-- Add paid_by column to contributions table to track who made the payment
alter table if exists public.contributions
  add column if not exists paid_by uuid references users(id);