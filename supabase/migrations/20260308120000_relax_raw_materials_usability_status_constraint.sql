-- Allow any non-empty usability_status so custom lifecycle stage keys (e.g. per raw material type) are valid.
-- The previous constraint only allowed: NOT_USABLE, IN_RIPENING, READY_FOR_PROCESSING, READY_FOR_PRODUCTION, PROCESSED.
-- Tags like "Banana Stem&Corm" can have lifecycles with different stage_key values; those must be accepted.

ALTER TABLE raw_materials DROP CONSTRAINT IF EXISTS raw_materials_usability_status_valid;

ALTER TABLE raw_materials
  ADD CONSTRAINT raw_materials_usability_status_valid
  CHECK (
    usability_status IS NULL
    OR (trim(usability_status) <> '')
  );

COMMENT ON COLUMN raw_materials.usability_status IS
  'Lifecycle stage key for this lot (e.g. IN_RIPENING, READY_FOR_PROCESSING, or custom keys from raw_material_lifecycle_stages). NULL for legacy or non-multi-stage lots.';
