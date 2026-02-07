/*
  # Inventory Deduction on Order Creation - Part 1: Schema Changes
  
  This migration adds support for:
  1. Immediate inventory deduction when order items are added
  2. Optional third-party delivery tracking
  3. Backward compatibility with existing orders
  
  Changes:
  - Add third_party_delivery_enabled flag to orders
  - Add created_before_migration flag to orders
  - Mark all existing orders as created before migration
  - Update order status constraint to support new values
*/

-- Step 1: Add new fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS third_party_delivery_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_before_migration boolean DEFAULT false;

-- Step 2: Mark all existing orders as created before migration
-- This ensures backward compatibility - existing orders won't be affected by new logic
UPDATE orders
SET created_before_migration = true
WHERE created_before_migration = false;

-- Step 3: Update order status constraint to support new status values
-- Keep legacy values for backward compatibility
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  -- New status values (for orders created after migration)
  'DRAFT', 'CONFIRMED', 'ORDER_COMPLETED', 'CANCELLED',
  -- Legacy status values (for backward compatibility)
  'Draft', 'Confirmed', 'Partially Delivered', 'Fully Delivered', 
  'READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERY_COMPLETED'
));

-- Step 4: Add comment to document the migration
COMMENT ON COLUMN orders.created_before_migration IS 
'Flag to identify orders created before inventory deduction migration. Orders with this flag set to true will not have new inventory deduction logic applied.';

COMMENT ON COLUMN orders.third_party_delivery_enabled IS 
'Flag to enable optional third-party delivery tracking for this order. When enabled, users can record delivery information without affecting inventory.';
