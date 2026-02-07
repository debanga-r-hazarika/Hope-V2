/*
  ============================================================================
  MIGRATION: Remove Delivery-Based Inventory Logic
  ============================================================================
  
  This migration removes the old delivery-based inventory system.
  From now on, inventory is deducted when order items are added.
  
  Changes:
  1. Drop old delivery-based inventory triggers
  2. Keep order item triggers for inventory deduction
  3. Clean up delivery-related functions
  ============================================================================
*/

-- ============================================================================
-- STEP 1: Drop Old Delivery-Based Inventory Triggers
-- ============================================================================

-- Drop the trigger that reduced inventory on delivery
DROP TRIGGER IF EXISTS reduce_inventory_on_delivery ON order_items;

-- Drop the trigger function for delivery-based inventory reduction
DROP FUNCTION IF EXISTS reduce_inventory_on_delivery() CASCADE;

-- Drop the trigger that updated delivery status
DROP TRIGGER IF EXISTS update_delivery_status_on_item_delivery ON order_items;

-- Drop the function that updated delivery status
DROP FUNCTION IF EXISTS update_delivery_status_on_item_delivery() CASCADE;

-- ============================================================================
-- STEP 2: Verify Inventory Deduction Triggers Are Active
-- ============================================================================

-- These triggers should already exist from previous migrations:
-- - deduct_inventory_on_order_item_insert
-- - adjust_inventory_on_order_item_update  
-- - restore_inventory_on_order_item_delete
-- - restore_inventory_on_order_cancel

-- Verify they exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'deduct_inventory_on_order_item_insert'
  ) THEN
    RAISE EXCEPTION 'Required trigger deduct_inventory_on_order_item_insert not found!';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'adjust_inventory_on_order_item_update'
  ) THEN
    RAISE EXCEPTION 'Required trigger adjust_inventory_on_order_item_update not found!';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'restore_inventory_on_order_item_delete'
  ) THEN
    RAISE EXCEPTION 'Required trigger restore_inventory_on_order_item_delete not found!';
  END IF;
  
  RAISE NOTICE 'All required inventory deduction triggers are active';
END $$;

-- ============================================================================
-- STEP 3: Update Comments
-- ============================================================================

COMMENT ON COLUMN order_items.quantity_delivered IS 
'DEPRECATED: This column is no longer used. Inventory is deducted when items are added to orders, not on delivery.';

-- ============================================================================
-- STEP 4: Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Delivery-Based Inventory Logic Removed';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '1. Dropped old delivery-based inventory triggers';
  RAISE NOTICE '2. Verified inventory deduction triggers are active';
  RAISE NOTICE '3. Marked quantity_delivered column as deprecated';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Inventory is now deducted when order items are added/updated/deleted';
  RAISE NOTICE 'The delivery tracking UI should be removed from the frontend';
  RAISE NOTICE '============================================================================';
END $$;
