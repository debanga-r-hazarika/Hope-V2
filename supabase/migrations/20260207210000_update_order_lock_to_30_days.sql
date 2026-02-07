-- Update Order Lock Timer from 48 hours to 30 days
-- This migration updates the auto_lock_completed_orders function to lock orders after 30 days instead of 48 hours

-- Drop the existing function
DROP FUNCTION IF EXISTS auto_lock_completed_orders();

-- Recreate the function with 30 days interval
CREATE OR REPLACE FUNCTION auto_lock_completed_orders()
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET is_locked = true,
      updated_at = now()
  WHERE status = 'ORDER_COMPLETED'
    AND completed_at IS NOT NULL
    AND completed_at < now() - INTERVAL '30 days'
    AND is_locked = false;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_lock_completed_orders IS 
'Auto-locks orders that have been completed for more than 30 days to maintain data integrity';
