-- Per-unit archive threshold: admin sets threshold per unit (e.g. 0.2 for kg, 5 for pieces).
-- Lots can be archived when quantity_available <= that unit's archive_threshold.

-- 1) Raw material units
ALTER TABLE raw_material_units
  ADD COLUMN IF NOT EXISTS archive_threshold numeric NOT NULL DEFAULT 5
  CHECK (archive_threshold >= 0);

COMMENT ON COLUMN raw_material_units.archive_threshold IS
  'Lots in this unit can be archived when quantity_available <= this value. E.g. 0.2 for kg, 5 for pieces.';

-- 2) Recurring product units
ALTER TABLE recurring_product_units
  ADD COLUMN IF NOT EXISTS archive_threshold numeric NOT NULL DEFAULT 5
  CHECK (archive_threshold >= 0);

COMMENT ON COLUMN recurring_product_units.archive_threshold IS
  'Lots in this unit can be archived when quantity_available <= this value. E.g. 5 for pieces.';

-- 3) Seed common values: kg = 0.2, pieces = 5 (by unit_key)
UPDATE raw_material_units SET archive_threshold = 0.2 WHERE unit_key IN ('kg', 'kg.');
UPDATE raw_material_units SET archive_threshold = 5 WHERE unit_key IN ('pieces', 'piece');

UPDATE recurring_product_units SET archive_threshold = 0.2 WHERE unit_key IN ('kg', 'kg.');
UPDATE recurring_product_units SET archive_threshold = 5 WHERE unit_key IN ('pieces', 'piece');
