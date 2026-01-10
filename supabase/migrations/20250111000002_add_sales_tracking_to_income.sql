/*
  # Add Sales Payment Tracking to Income Table
  
  Add fields to track income entries that come from sales order payments.
  This allows us to:
  - Identify sales entries in Finance module
  - Prevent editing sales entries from Finance module
  - Link income entries back to their originating order payments
  - Update income entries when payments are updated
*/

-- Add tracking fields to income table
ALTER TABLE income
  ADD COLUMN IF NOT EXISTS from_sales_payment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_payment_id uuid REFERENCES order_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_number text;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_income_order_payment ON income(order_payment_id);
CREATE INDEX IF NOT EXISTS idx_income_order_id ON income(order_id);
CREATE INDEX IF NOT EXISTS idx_income_from_sales ON income(from_sales_payment) WHERE from_sales_payment = true;
