-- Run these migrations in order to enable the enhanced order status system with hold mechanism

-- Step 1: Run the enhanced order status migration
\i supabase/migrations/20260207200000_enhanced_order_status_with_hold.sql

-- Step 2: Run the remove cancelled status migration
\i supabase/migrations/20260207200001_remove_cancelled_status.sql

-- Step 3: Verify the changes
SELECT 
  id,
  order_number,
  status,
  is_on_hold,
  hold_reason,
  payment_status,
  total_amount,
  discount_amount
FROM orders
ORDER BY created_at DESC
LIMIT 10;

-- Step 4: Test the calculate_order_status function
SELECT 
  id,
  order_number,
  status AS current_status,
  calculate_order_status(id) AS calculated_status,
  is_on_hold
FROM orders
WHERE status != calculate_order_status(id)
LIMIT 10;
