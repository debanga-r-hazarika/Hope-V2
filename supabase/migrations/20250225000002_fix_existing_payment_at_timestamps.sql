/*
  # Fix existing income entries from sales payments
  
  Backfill payment_at timestamps for existing income entries that were created
  from sales payments. These entries currently have payment_at set to payment_date
  (which defaults to 5:30 AM), but should use the actual payment record time (created_at).
  
  This migration updates all existing income entries linked to order_payments
  to use the correct timestamp from order_payments.created_at.
*/

-- Update existing income entries to use the correct payment_at timestamp
UPDATE income i
SET payment_at = op.created_at
FROM order_payments op
WHERE i.order_payment_id = op.id
  AND i.from_sales_payment = true
  AND i.payment_at IS DISTINCT FROM op.created_at;

-- Log how many records were updated
DO $$
DECLARE
  updated_count integer;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % income entries with correct payment_at timestamps', updated_count;
END $$;
