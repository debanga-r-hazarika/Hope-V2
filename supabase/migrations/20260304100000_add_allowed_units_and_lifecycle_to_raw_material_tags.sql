-- Add per-tag configuration for allowed units and optional lifecycle behavior.
-- This migration is fully backwards compatible and does NOT modify existing rows beyond adding nullable columns.

-- 1) Allowed units per raw material tag
--    Array of raw_material_units.id values that are allowed when creating lots for this tag.
--    Enforced at the application layer.
ALTER TABLE raw_material_tags
  ADD COLUMN IF NOT EXISTS allowed_unit_ids uuid[] DEFAULT '{}'::uuid[];

COMMENT ON COLUMN raw_material_tags.allowed_unit_ids IS
  'Array of raw_material_units.id values allowed for this tag (used to filter units in the raw material lot form).';

-- 2) Optional lifecycle type per tag
--    Used to distinguish between standard materials and special multi-stage lifecycles like Banana.
--    Values are application-defined (e.g. NULL or '' for standard, ''banana_multi_stage'' for Banana).
ALTER TABLE raw_material_tags
  ADD COLUMN IF NOT EXISTS lifecycle_type text;

COMMENT ON COLUMN raw_material_tags.lifecycle_type IS
  'Optional lifecycle key for this tag (e.g., banana_multi_stage). NULL or empty means standard behavior.';

