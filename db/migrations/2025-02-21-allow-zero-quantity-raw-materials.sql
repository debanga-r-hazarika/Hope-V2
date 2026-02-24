-- Allow zero quantity for raw materials
-- Drop the existing constraint that requires quantity_received > 0
ALTER TABLE raw_materials DROP CONSTRAINT IF EXISTS raw_materials_quantity_received_check;

-- Add new constraint that allows quantity_received >= 0
ALTER TABLE raw_materials ADD CONSTRAINT raw_materials_quantity_received_check CHECK (quantity_received >= 0);

-- Add comment explaining the change
COMMENT ON CONSTRAINT raw_materials_quantity_received_check ON raw_materials IS 'Allows zero or positive quantities for raw material lots';
