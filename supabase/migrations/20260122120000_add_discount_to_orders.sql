-- Add discount functionality to orders
-- Migration: 20260122120000_add_discount_to_orders

-- Add discount_amount column to orders table
ALTER TABLE orders
ADD COLUMN discount_amount numeric(15,2) DEFAULT 0 CHECK (discount_amount >= 0);

-- Add comment for documentation
COMMENT ON COLUMN orders.discount_amount IS 'Fixed discount amount applied to the entire order (in rupees)';

-- Create index for potential queries on discounted orders
CREATE INDEX IF NOT EXISTS idx_orders_discount_amount ON orders(discount_amount) WHERE discount_amount > 0;

-- Update the order total calculation to account for discount
-- Note: This is informational, the actual calculation happens in application logic