/*
  # Fix Delivery Trigger - Use Correct Available Calculation
  
  This migration updates the delivery trigger to use the correct available quantity calculation:
  actual_available = quantity_created - delivered (matches Processed Goods page and dropdown display)
  
  This matches the UI calculation and ensures consistency across the application.
*/

-- Drop and recreate the function with correct available calculation
CREATE OR REPLACE FUNCTION reduce_inventory_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  old_delivered numeric;
  new_delivered numeric;
  delivery_difference numeric;
  quantity_before numeric;
  quantity_after numeric;
  actual_available numeric;
  quantity_created_val numeric;
  total_delivered_val numeric;
BEGIN
  -- Get old and new delivered quantities
  old_delivered := COALESCE(OLD.quantity_delivered, 0);
  new_delivered := COALESCE(NEW.quantity_delivered, 0);
  
  -- Calculate the difference (how much more was delivered)
  delivery_difference := new_delivered - old_delivered;
  
  -- Only proceed if delivery changed
  IF delivery_difference != 0 THEN
    -- Get current quantity_available for history tracking
    SELECT quantity_available INTO quantity_before
    FROM processed_goods
    WHERE id = NEW.processed_good_id;
    
    -- Calculate actual available using the same logic as the application
    -- actual_available = quantity_created - delivered (matches Processed Goods page and dropdown)
    SELECT 
      pg.quantity_created,
      -- Get total delivered from all order_items (includes old_delivered for current item)
      COALESCE(SUM(oi.quantity_delivered), 0) as total_delivered
    INTO 
      quantity_created_val,
      total_delivered_val
    FROM processed_goods pg
    LEFT JOIN order_items oi ON pg.id = oi.processed_good_id 
      AND oi.quantity_delivered IS NOT NULL
    WHERE pg.id = NEW.processed_good_id
    GROUP BY pg.id, pg.quantity_created;
    
    -- Calculate actual available BEFORE this delivery update
    -- Use quantity_created if available, otherwise fallback to quantity_available + delivered
    quantity_created_val := COALESCE(quantity_created_val, quantity_before + total_delivered_val);
    -- Since this is an AFTER UPDATE trigger, total_delivered includes NEW.quantity_delivered
    -- To get the "before" state, we need to subtract the delivery_difference
    -- actual_available = quantity_created - (total_delivered - delivery_difference)
    -- This matches the application calculation: quantity_created - delivered
    actual_available := quantity_created_val - (total_delivered_val - delivery_difference);
    
    -- Validate we have enough inventory (if increasing delivery)
    IF delivery_difference > 0 THEN
      IF actual_available < delivery_difference THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Required: %', 
          GREATEST(0, actual_available), delivery_difference;
      END IF;
      
      -- Reduce the inventory by the delivery difference
      UPDATE processed_goods
      SET quantity_available = quantity_available - delivery_difference
      WHERE id = NEW.processed_good_id;
      
      -- Get quantity after the change
      SELECT quantity_available INTO quantity_after
      FROM processed_goods
      WHERE id = NEW.processed_good_id;
      
      -- Create delivery dispatch record for audit (only if this is an UPDATE, not initial INSERT)
      IF OLD IS NOT NULL THEN
        INSERT INTO delivery_dispatches (
          order_id,
          order_item_id,
          processed_good_id,
          quantity_delivered,
          delivery_date,
          created_by
        )
        VALUES (
          NEW.order_id,
          NEW.id,
          NEW.processed_good_id,
          delivery_difference,
          CURRENT_DATE,
          auth.uid()
        );
      END IF;
      
      -- Create history record
      INSERT INTO processed_goods_history (
        processed_good_id,
        quantity_before,
        quantity_after,
        quantity_change,
        change_type,
        change_reason,
        order_id,
        order_item_id,
        effective_date,
        created_by,
        notes
      )
      VALUES (
        NEW.processed_good_id,
        quantity_before,
        quantity_after,
        -delivery_difference, -- Negative because it's a reduction
        'delivery',
        'Delivery - Order: ' || COALESCE((SELECT order_number FROM orders WHERE id = NEW.order_id), 'N/A'),
        NEW.order_id,
        NEW.id,
        CURRENT_DATE,
        auth.uid(),
        'Delivery of ' || delivery_difference || ' ' || NEW.unit
      );
    END IF;
    
    -- Handle case where delivery is reduced (shouldn't happen normally, but handle it)
    IF delivery_difference < 0 THEN
      -- Increase inventory back by the difference
      UPDATE processed_goods
      SET quantity_available = quantity_available + ABS(delivery_difference)
      WHERE id = NEW.processed_good_id;
      
      -- Get quantity after the change
      SELECT quantity_available INTO quantity_after
      FROM processed_goods
      WHERE id = NEW.processed_good_id;
      
      -- Create history record for the reversal
      INSERT INTO processed_goods_history (
        processed_good_id,
        quantity_before,
        quantity_after,
        quantity_change,
        change_type,
        change_reason,
        order_id,
        order_item_id,
        effective_date,
        created_by,
        notes
      )
      VALUES (
        NEW.processed_good_id,
        quantity_before,
        quantity_after,
        ABS(delivery_difference), -- Positive because it's an increase
        'correction',
        'Delivery reversal - Order: ' || COALESCE((SELECT order_number FROM orders WHERE id = NEW.order_id), 'N/A'),
        NEW.order_id,
        NEW.id,
        CURRENT_DATE,
        auth.uid(),
        'Reversal of ' || ABS(delivery_difference) || ' ' || NEW.unit || ' delivery'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
