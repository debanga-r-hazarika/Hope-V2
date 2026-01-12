-- Add 'Completed' status to orders table CHECK constraint
-- This allows orders to be marked as completed when payment is fully received and all items are delivered

-- Drop the existing CHECK constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new CHECK constraint with 'Completed' status
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('Draft', 'Confirmed', 'Partially Delivered', 'Fully Delivered', 'Completed', 'Cancelled'));
