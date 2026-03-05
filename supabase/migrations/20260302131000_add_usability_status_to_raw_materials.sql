-- Add usability_status to raw_materials for richer lifecycle tracking (e.g., In Ripening, Ready for Processing).
-- Backwards compatible: existing rows remain NULL and current usable flag continues to work.

ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS usability_status text;

ALTER TABLE raw_materials DROP CONSTRAINT IF EXISTS raw_materials_usability_status_valid;
ALTER TABLE raw_materials
  ADD CONSTRAINT raw_materials_usability_status_valid
  CHECK (
    usability_status IS NULL
    OR usability_status IN (
      'NOT_USABLE',
      'IN_RIPENING',
      'READY_FOR_PROCESSING',
      'READY_FOR_PRODUCTION',
      'PROCESSED'
    )
  );

COMMENT ON COLUMN raw_materials.usability_status IS
  'Detailed lifecycle status for raw material lots. Used for workflows like Banana ripening/processing. Legacy lots may keep this NULL.';

