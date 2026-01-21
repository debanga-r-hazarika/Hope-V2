/*
  # Add payment_datetime column to order_payments

  This migration adds a payment_datetime column to store the full date and time
  that the user selected in the payment form, rather than just the date.

  This allows income entries to show the correct payment date/time as selected
  by the user instead of using the database created_at timestamp.
*/

-- Add payment_datetime column to store full datetime
ALTER TABLE order_payments
ADD COLUMN IF NOT EXISTS payment_datetime timestamptz;

-- Backfill existing records with payment_date + midnight time
-- This preserves existing behavior for old payments
UPDATE order_payments
SET payment_datetime = payment_date::timestamptz
WHERE payment_datetime IS NULL;