-- Combined migration: Fix existing lot IDs and add UNIQUE constraints
-- This migration:
-- 1. Fixes existing lot IDs to follow format LOT-RM-000, LOT-RP-000
-- 2. Adds UNIQUE constraints to prevent future duplicates

-- Step 1: Fix existing lot IDs for raw materials
DO $$
DECLARE
  rec RECORD;
  new_lot_id TEXT;
  counter INTEGER := 0;
BEGIN
  -- Update raw materials to have sequential LOT-RM-000, LOT-RM-001, etc.
  FOR rec IN 
    SELECT id, lot_id 
    FROM raw_materials 
    ORDER BY created_at ASC
  LOOP
    new_lot_id := 'LOT-RM-' || LPAD(counter::TEXT, 3, '0');
    
    -- Check if this lot_id already exists (skip if it's the same record)
    IF NOT EXISTS (
      SELECT 1 FROM raw_materials 
      WHERE lot_id = new_lot_id AND id != rec.id
    ) THEN
      UPDATE raw_materials 
      SET lot_id = new_lot_id 
      WHERE id = rec.id;
      
      counter := counter + 1;
    ELSE
      -- If conflict, increment counter and try again
      counter := counter + 1;
      new_lot_id := 'LOT-RM-' || LPAD(counter::TEXT, 3, '0');
      UPDATE raw_materials 
      SET lot_id = new_lot_id 
      WHERE id = rec.id;
      counter := counter + 1;
    END IF;
  END LOOP;
END $$;

-- Step 2: Fix existing lot IDs for recurring products
DO $$
DECLARE
  rec RECORD;
  new_lot_id TEXT;
  counter INTEGER := 0;
BEGIN
  -- Update recurring products to have sequential LOT-RP-000, LOT-RP-001, etc.
  FOR rec IN 
    SELECT id, lot_id 
    FROM recurring_products 
    ORDER BY created_at ASC
  LOOP
    new_lot_id := 'LOT-RP-' || LPAD(counter::TEXT, 3, '0');
    
    -- Check if this lot_id already exists (skip if it's the same record)
    IF NOT EXISTS (
      SELECT 1 FROM recurring_products 
      WHERE lot_id = new_lot_id AND id != rec.id
    ) THEN
      UPDATE recurring_products 
      SET lot_id = new_lot_id 
      WHERE id = rec.id;
      
      counter := counter + 1;
    ELSE
      -- If conflict, increment counter and try again
      counter := counter + 1;
      new_lot_id := 'LOT-RP-' || LPAD(counter::TEXT, 3, '0');
      UPDATE recurring_products 
      SET lot_id = new_lot_id 
      WHERE id = rec.id;
      counter := counter + 1;
    END IF;
  END LOOP;
END $$;

-- Step 3: Verify no duplicates exist after fixing
DO $$
BEGIN
  IF EXISTS (
    SELECT lot_id, COUNT(*) 
    FROM raw_materials 
    GROUP BY lot_id 
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate lot_ids still exist in raw_materials after fix attempt.';
  END IF;
  
  IF EXISTS (
    SELECT lot_id, COUNT(*) 
    FROM recurring_products 
    GROUP BY lot_id 
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate lot_ids still exist in recurring_products after fix attempt.';
  END IF;
END $$;

-- Step 4: Add UNIQUE constraint to raw_materials.lot_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'raw_materials_lot_id_unique'
  ) THEN
    ALTER TABLE raw_materials 
      ADD CONSTRAINT raw_materials_lot_id_unique UNIQUE (lot_id);
  END IF;
END $$;

-- Step 5: Add UNIQUE constraint to recurring_products.lot_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'recurring_products_lot_id_unique'
  ) THEN
    ALTER TABLE recurring_products 
      ADD CONSTRAINT recurring_products_lot_id_unique UNIQUE (lot_id);
  END IF;
END $$;


