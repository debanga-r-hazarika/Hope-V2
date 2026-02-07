/*
  ============================================================================
  MIGRATION: Fix Order Item Deletion Trigger
  ============================================================================
  
  Problem: When deleting an order item, the restore_inventory_on_order_item_delete
  trigger tries to log the change with the order_item_id, but the item has already
  been deleted, causing a foreign key constraint violation.
  
  Solution: Pass NULL for order_item_id when logging the deletion since the item
  no longer exists.
  ============================================================================
*/

-- Fix the restore_inventory_on_order_item_delete function
CREATE OR REPLACE FUNCTION restore_inventory_on_order_item_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT 
    created_before_migration,
    is_locked,
    status
  INTO v_order
  FROM orders
  WHERE id = OLD.order_id;
  
  -- Only apply new logic to orders created after migration
  IF v_order.created_before_migration THEN
    RETURN OLD;
  END IF;
  
  -- Restore inventory
  UPDATE processed_goods
  SET quantity_available = quantity_available + OLD.quantity
  WHERE id = OLD.processed_good_id;
  
  -- Log the change with NULL order_item_id since the item is being deleted
  PERFORM log_inventory_change(
    OLD.processed_good_id,
    OLD.quantity,
    'ORDER_ITEM_DELETED',
    OLD.order_id,
    NULL  -- Pass NULL instead of OLD.id since item is being deleted
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Summary
DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Order Item Deletion Trigger Fixed';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '1. Updated restore_inventory_on_order_item_delete function';
  RAISE NOTICE '2. Now passes NULL for order_item_id when logging deletion';
  RAISE NOTICE '';
  RAISE NOTICE 'Result: Order items can now be deleted without foreign key violations';
  RAISE NOTICE '============================================================================';
END $$;
