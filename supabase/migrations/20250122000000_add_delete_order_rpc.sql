-- Add RPC function to safely delete orders
-- This bypasses RLS policies and handles the deletion properly

CREATE OR REPLACE FUNCTION delete_order_safe(order_id uuid)
RETURNS json AS $$
DECLARE
  order_exists boolean := false;
  order_locked boolean := false;
  result json;
BEGIN
  -- Check if order exists and is not locked
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = order_id) INTO order_exists;
  SELECT COALESCE(is_locked, false) FROM orders WHERE id = order_id INTO order_locked;

  IF NOT order_exists THEN
    RETURN json_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF order_locked THEN
    RETURN json_build_object('success', false, 'message', 'Order is locked and cannot be deleted');
  END IF;

  -- Delete related records in correct order
  DELETE FROM delivery_dispatches WHERE order_id = order_id;
  DELETE FROM order_reservations WHERE order_id = order_id;
  DELETE FROM order_payments WHERE order_id = order_id;
  DELETE FROM order_items WHERE order_id = order_id;
  DELETE FROM invoices WHERE order_id = order_id;

  -- Finally delete the order
  DELETE FROM orders WHERE id = order_id;

  RETURN json_build_object('success', true, 'message', 'Order deleted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;