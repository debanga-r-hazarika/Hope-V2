/*
  ============================================================================
  MIGRATION: Fix Order Deletion Issue
  ============================================================================
  
  Problem: Cannot delete orders because inventory_changes_log has a foreign
  key constraint on order_item_id that prevents deletion.
  
  Solution: Make order_item_id nullable and add ON DELETE CASCADE to allow
  proper cleanup when orders are deleted.
  ============================================================================
*/

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE inventory_changes_log 
DROP CONSTRAINT IF EXISTS inventory_changes_log_order_item_id_fkey;

-- Step 2: Make order_item_id nullable (it's not always needed)
ALTER TABLE inventory_changes_log 
ALTER COLUMN order_item_id DROP NOT NULL;

-- Step 3: Re-add the foreign key with ON DELETE CASCADE
ALTER TABLE inventory_changes_log
ADD CONSTRAINT inventory_changes_log_order_item_id_fkey 
FOREIGN KEY (order_item_id) 
REFERENCES order_items(id) 
ON DELETE CASCADE;

-- Step 4: Also ensure order_id has CASCADE delete
ALTER TABLE inventory_changes_log 
DROP CONSTRAINT IF EXISTS inventory_changes_log_order_id_fkey;

ALTER TABLE inventory_changes_log
ADD CONSTRAINT inventory_changes_log_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

-- Step 5: Add comment
COMMENT ON TABLE inventory_changes_log IS 
'Audit log for inventory changes. Records are automatically deleted when the related order or order item is deleted (CASCADE).';

-- Summary
DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Order Deletion Fix Applied';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '1. Made order_item_id nullable in inventory_changes_log';
  RAISE NOTICE '2. Added ON DELETE CASCADE to order_item_id foreign key';
  RAISE NOTICE '3. Added ON DELETE CASCADE to order_id foreign key';
  RAISE NOTICE '';
  RAISE NOTICE 'Result: Orders can now be deleted without foreign key violations';
  RAISE NOTICE '============================================================================';
END $$;
