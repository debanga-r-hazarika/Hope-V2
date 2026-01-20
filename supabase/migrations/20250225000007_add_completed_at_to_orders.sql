-- Add completed_at timestamp to orders table
-- This tracks when an order was marked as ORDER_COMPLETED
-- Used for 48-hour timer before auto-locking

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Create index for completed_at filtering
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);

-- Note: The trigger functions will be updated in a separate migration
-- after ensuring the completed_at column exists

-- Auto-lock orders after 48 hours of being completed
-- This function checks and locks orders that have been completed for more than 48 hours
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
