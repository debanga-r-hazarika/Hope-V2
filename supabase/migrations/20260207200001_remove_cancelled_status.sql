-- Migration: Remove CANCELLED Status
-- Remove CANCELLED from order statuses as there is no cancellation logic
-- Update constraint to only include: ORDER_CREATED, READY_FOR_PAYMENT, FULL_PAYMENT, HOLD, ORDER_COMPLETED

-- Step 1: Drop the old check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Add new check constraint without CANCELLED
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('ORDER_CREATED', 'READY_FOR_PAYMENT', 'FULL_PAYMENT', 'HOLD', 'ORDER_COMPLETED'));

-- Step 3: Update comment for documentation
COMMENT ON COLUMN orders.status IS 'Order status: ORDER_CREATED (no items), READY_FOR_PAYMENT (items added, no payment), FULL_PAYMENT (paid but on hold), HOLD (manually held), ORDER_COMPLETED (paid and not on hold)';
