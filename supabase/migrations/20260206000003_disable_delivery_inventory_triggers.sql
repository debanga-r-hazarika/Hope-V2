/*
  # Disable Delivery-Based Inventory Triggers
  
  This migration disables the old delivery-based inventory deduction logic:
  1. Drops the trigger that reduces inventory when quantity_delivered is updated
  2. Keeps the delivery_dispatches table for historical records
  3. Keeps the handle_order_cancellation_trigger for backward compatibility
  
  Note: This does NOT delete any data - all historical delivery records are preserved
*/

-- Drop the old inventory deduction trigger
DROP TRIGGER IF EXISTS reduce_inventory_on_delivery_trigger ON order_items;

-- Drop the old delivery-based order status update trigger
-- (We'll use payment-based status updates instead)
DROP TRIGGER IF EXISTS update_order_status_on_delivery ON order_items;
DROP TRIGGER IF EXISTS update_order_status_on_delivery_v2 ON order_items;

-- Keep the delivery function for backward compatibility (in case it's referenced elsewhere)
-- but it won't be triggered anymore
-- The function reduce_inventory_on_delivery() remains but is not actively used

-- Add comment to document the change
COMMENT ON FUNCTION reduce_inventory_on_delivery IS 
'DEPRECATED: This function is no longer triggered. Inventory is now deducted when order items are added, not when delivered. Kept for backward compatibility only.';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Delivery-based inventory triggers have been disabled. Inventory is now deducted when order items are added.';
END $$;
