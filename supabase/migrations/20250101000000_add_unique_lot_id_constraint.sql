-- Add UNIQUE constraint to lot_id in raw_materials and recurring_products tables
-- This ensures lot IDs are unique across the system

-- First, check if there are any duplicate lot_ids and handle them
-- (This is a safety check - if duplicates exist, we need to fix them first)

-- Add UNIQUE constraint to raw_materials.lot_id
DO $$
BEGIN
  -- Check for duplicates before adding constraint
  IF EXISTS (
    SELECT lot_id, COUNT(*) 
    FROM raw_materials 
    GROUP BY lot_id 
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate lot_ids found in raw_materials. Please fix duplicates before adding UNIQUE constraint.';
  END IF;
END $$;

ALTER TABLE raw_materials 
  ADD CONSTRAINT raw_materials_lot_id_unique UNIQUE (lot_id);

-- Add UNIQUE constraint to recurring_products.lot_id
DO $$
BEGIN
  -- Check for duplicates before adding constraint
  IF EXISTS (
    SELECT lot_id, COUNT(*) 
    FROM recurring_products 
    GROUP BY lot_id 
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate lot_ids found in recurring_products. Please fix duplicates before adding UNIQUE constraint.';
  END IF;
END $$;

ALTER TABLE recurring_products 
  ADD CONSTRAINT recurring_products_lot_id_unique UNIQUE (lot_id);


