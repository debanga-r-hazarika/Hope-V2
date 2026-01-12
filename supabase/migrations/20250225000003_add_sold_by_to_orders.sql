/*
  # Add sold_by field to orders table
  
  Add sold_by field to track which user sold the order.
  This replaces the notes field functionality for tracking sales personnel.
*/

-- Add sold_by column to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sold_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_orders_sold_by ON orders(sold_by);

-- Add comment
COMMENT ON COLUMN orders.sold_by IS 'User who sold the order (salesperson)';
