-- Add description_log field to raw_materials and recurring_products tables
-- This field will store a log of changes made through waste & transfer management
-- Format: Timestamped entries separated by newlines

ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS description_log text DEFAULT '';

ALTER TABLE recurring_products
  ADD COLUMN IF NOT EXISTS description_log text DEFAULT '';

-- Add comment for documentation
COMMENT ON COLUMN raw_materials.description_log IS 'Log of changes made through waste & transfer management. Each entry includes timestamp, action type, and details.';
COMMENT ON COLUMN recurring_products.description_log IS 'Log of changes made through waste & transfer management. Each entry includes timestamp, action type, and details.';

