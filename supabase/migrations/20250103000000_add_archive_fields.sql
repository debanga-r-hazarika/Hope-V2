-- Add is_archived field to raw_materials and recurring_products tables
-- This allows R/W users to archive lots with quantity <= 5 to keep the UI clean

ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false NOT NULL;

ALTER TABLE recurring_products
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false NOT NULL;

-- Add index for better query performance when filtering archived items
CREATE INDEX IF NOT EXISTS idx_raw_materials_is_archived ON raw_materials(is_archived);
CREATE INDEX IF NOT EXISTS idx_recurring_products_is_archived ON recurring_products(is_archived);

-- Add comment for documentation
COMMENT ON COLUMN raw_materials.is_archived IS 'When true, this lot is archived and hidden from production/waste sections by default. Can only be archived when quantity <= 5.';
COMMENT ON COLUMN recurring_products.is_archived IS 'When true, this lot is archived and hidden from production/waste sections by default. Can only be archived when quantity <= 5.';

