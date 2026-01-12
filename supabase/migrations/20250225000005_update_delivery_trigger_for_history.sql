/*
  # Update delivery trigger to create processed_goods_history records
  
  This migration updates the reduce_inventory_on_delivery() function to also
  create history records in processed_goods_history table when deliveries occur.
*/

-- Update the function to create history records
CREATE OR REPLACE FUNCTION reduce_inventory_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  old_delivered numeric;
  new_delivered numeric;
  delivery_difference numeric;
  current_available numeric;
  quantity_before numeric;
  quantity_after numeric;
  dispatch_id uuid;
BEGIN
  -- Get old and new delivered quantities
  -- For INSERT, OLD is NULL, so use 0
  old_delivered := COALESCE(OLD.quantity_delivered, 0);
  new_delivered := COALESCE(NEW.quantity_delivered, 0);
  
  -- Calculate the difference (how much more was delivered)
  delivery_difference := new_delivered - old_delivered;
  
  -- Only proceed if delivery changed
  IF delivery_difference != 0 THEN
    -- Get current available quantity BEFORE the change
    SELECT quantity_available INTO quantity_before
    FROM processed_goods
    WHERE id = NEW.processed_good_id;
    
    -- Validate we have enough inventory (if increasing delivery)
    IF delivery_difference > 0 THEN
      IF quantity_before < delivery_difference THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Required: %', 
          quantity_before, delivery_difference;
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
        )
        RETURNING id INTO dispatch_id;
        
        -- Create history record for the delivery
        INSERT INTO processed_goods_history (
          processed_good_id,
          quantity_before,
          quantity_after,
          quantity_change,
          change_type,
          change_reason,
          order_id,
          order_item_id,
          delivery_dispatch_id,
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
          'Sales delivery - Order: ' || COALESCE((SELECT order_number FROM orders WHERE id = NEW.order_id), 'N/A'),
          NEW.order_id,
          NEW.id,
          dispatch_id,
          CURRENT_DATE,
          auth.uid(),
          'Delivery of ' || delivery_difference || ' ' || NEW.unit || ' from order item'
        );
      END IF;
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
