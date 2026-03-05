-- Track parent lot for transformed raw materials (e.g., Banana → Banana Peel)
-- Backwards compatible: existing rows remain unchanged.
-- Run this in Supabase Dashboard → SQL Editor if migrations are not applied via CLI.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'raw_materials' AND column_name = 'transformed_from_lot_id'
  ) THEN
    ALTER TABLE raw_materials
      ADD COLUMN transformed_from_lot_id uuid REFERENCES raw_materials(id) ON DELETE SET NULL;
    COMMENT ON COLUMN raw_materials.transformed_from_lot_id IS
      'Optional reference to the parent raw_material lot this lot was transformed from.';
  END IF;
END $$;
