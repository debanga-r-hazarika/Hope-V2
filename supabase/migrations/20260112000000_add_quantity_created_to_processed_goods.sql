-- Add quantity_created column to processed_goods table
-- This stores the original quantity when the processed good was created from a production batch
-- quantity_available = quantity_created - quantity_delivered

ALTER TABLE processed_goods
ADD COLUMN IF NOT EXISTS quantity_created numeric;

-- Set quantity_created for existing records
-- For existing records, we'll set it to quantity_available + total delivered
-- This ensures backward compatibility
UPDATE processed_goods
SET quantity_created = COALESCE(
  quantity_available + COALESCE((
    SELECT SUM(quantity_delivered)
    FROM order_items
    WHERE order_items.processed_good_id = processed_goods.id
    AND quantity_delivered > 0
  ), 0),
  quantity_available
)
WHERE quantity_created IS NULL;

-- Make quantity_created NOT NULL after backfilling
ALTER TABLE processed_goods
ALTER COLUMN quantity_created SET NOT NULL;

-- Add check constraint to ensure quantity_created >= quantity_available
ALTER TABLE processed_goods
ADD CONSTRAINT check_quantity_created_ge_available 
CHECK (quantity_created >= quantity_available);

-- Add comment for documentation
COMMENT ON COLUMN processed_goods.quantity_created IS 'Original quantity when processed good was created from production batch. Available = Created - Delivered';
