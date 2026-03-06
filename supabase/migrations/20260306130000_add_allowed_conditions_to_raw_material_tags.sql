-- Add allowed_conditions per raw material tag.
-- Admins configure which condition options appear in the add/edit lot form for each tag.
-- When NULL or empty, the app falls back to legacy tag-based defaults (banana vs tea).

ALTER TABLE raw_material_tags
  ADD COLUMN IF NOT EXISTS allowed_conditions text[] DEFAULT NULL;

COMMENT ON COLUMN raw_material_tags.allowed_conditions IS
  'Array of condition labels (e.g. Raw, Semi-ripe, Ripe, Baduliye Khuwa, Other) shown in the lot form for this tag. NULL = use legacy defaults.';
