-- Fix for completed_at column and auto_lock_completed_orders function
-- Run this in Supabase SQL Editor if migrations failed

-- 1. Add completed_at column if it doesn't exist
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 2. Create index for completed_at
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);

-- 3. Create the auto_lock_completed_orders function
CREATE OR REPLACE FUNCTION auto_lock_completed_orders()
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET is_locked = true,
      updated_at = now()
  WHERE status = 'ORDER_COMPLETED'
    AND completed_at IS NOT NULL
    AND completed_at < now() - INTERVAL '48 hours'
    AND is_locked = false;
END;
$$ LANGUAGE plpgsql;

-- 4. Update existing ORDER_COMPLETED orders to have completed_at if they don't
UPDATE orders
SET completed_at = updated_at
WHERE status = 'ORDER_COMPLETED'
  AND completed_at IS NULL;

-- 5. Verify the setup
SELECT
  'completed_at column exists' as check_result,
  COUNT(*) as orders_with_completed_at
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name = 'completed_at'
UNION ALL
SELECT
  'auto_lock_completed_orders function exists' as check_result,
  COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_name = 'auto_lock_completed_orders';