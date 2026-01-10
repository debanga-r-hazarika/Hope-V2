/*
  # Add is_locked column to orders table
  
  Add is_locked functionality to orders similar to production batches.
  This allows orders to be saved as drafts and then locked when complete.
  Locked orders cannot be edited.
*/

-- Add is_locked column to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Create index for locked status filtering
CREATE INDEX IF NOT EXISTS idx_orders_is_locked ON orders(is_locked);
