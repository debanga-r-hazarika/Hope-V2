-- Add photo_urls column to raw_materials table
ALTER TABLE raw_materials
ADD COLUMN photo_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN raw_materials.photo_urls IS 'Array of photo URLs stored in Raw Material Photos bucket (max 5 photos per lot)';
