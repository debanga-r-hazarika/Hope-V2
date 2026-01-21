-- Add usable column to raw_materials table for controlling production availability
-- This allows raw material lots to be marked as "usable" or "not usable" for production

ALTER TABLE raw_materials
ADD COLUMN IF NOT EXISTS usable boolean NOT NULL DEFAULT true;

-- Create an index for efficient filtering by usability status
CREATE INDEX IF NOT EXISTS idx_raw_materials_usable ON raw_materials(usable);

-- Update existing raw materials to be usable by default
-- This migration sets all existing lots to usable=true to maintain backward compatibility
UPDATE raw_materials
SET usable = true
WHERE usable IS NULL;

-- Add a comment to document the column purpose
COMMENT ON COLUMN raw_materials.usable IS 'Controls whether this raw material lot can be used in production. True = available for production, False = aging/ripening/drying';