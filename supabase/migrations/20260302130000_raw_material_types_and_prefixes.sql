-- Raw Material Types & Tag Lot Prefixes
-- - Adds lot_prefix to raw_material_tags for admin-controlled lot ID prefixes
-- - Creates raw_material_types table to control workflow and allowed units
-- - Backwards compatible: existing tags and lots remain untouched

-- 1) Add lot_prefix to raw_material_tags (nullable for backwards compatibility)
ALTER TABLE raw_material_tags
  ADD COLUMN IF NOT EXISTS lot_prefix text;

-- Enforce uppercase A–Z, digits, and hyphen only when provided
ALTER TABLE raw_material_tags DROP CONSTRAINT IF EXISTS raw_material_tags_lot_prefix_format;
ALTER TABLE raw_material_tags
  ADD CONSTRAINT raw_material_tags_lot_prefix_format
  CHECK (
    lot_prefix IS NULL
    OR lot_prefix ~ '^[A-Z0-9-]+$'
  );

-- Ensure lot_prefix is unique per tag when set
CREATE UNIQUE INDEX IF NOT EXISTS raw_material_tags_lot_prefix_unique
  ON raw_material_tags(lot_prefix)
  WHERE lot_prefix IS NOT NULL;

COMMENT ON COLUMN raw_material_tags.lot_prefix IS
  'Admin-defined lot ID prefix for this tag (e.g., RAW-BAN, FIN-BAN-PEEL). Used for structured lot IDs like PREFIX-001. Only affects new lots.';

-- 2) Raw Material Types: type-driven workflow layer above tags

CREATE TABLE IF NOT EXISTS raw_material_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text NOT NULL UNIQUE, -- e.g. banana
  type_name text NOT NULL,       -- e.g. Banana
  raw_material_tag_id uuid NOT NULL REFERENCES raw_material_tags(id) ON DELETE RESTRICT,
  allowed_unit_ids uuid[] NOT NULL DEFAULT '{}'::uuid[], -- References raw_material_units.id (enforced in app)
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE raw_material_types ENABLE ROW LEVEL SECURITY;

-- Admins and operations users can view types
DROP POLICY IF EXISTS "Admins and operations users can view raw material types" ON raw_material_types;
CREATE POLICY "Admins and operations users can view raw material types"
  ON raw_material_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    (
      status = 'active' AND
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'operations'
        AND uma.access_level IN ('read-only', 'read-write')
      )
    )
  );

-- Only admins can create types
DROP POLICY IF EXISTS "Admins can create raw material types" ON raw_material_types;
CREATE POLICY "Admins can create raw material types"
  ON raw_material_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can update types
DROP POLICY IF EXISTS "Admins can update raw material types" ON raw_material_types;
CREATE POLICY "Admins can update raw material types"
  ON raw_material_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_raw_material_types_status ON raw_material_types(status);
CREATE INDEX IF NOT EXISTS idx_raw_material_types_tag_id ON raw_material_types(raw_material_tag_id);

COMMENT ON TABLE raw_material_types IS
  'Admin-defined raw material Types that control workflow (units, initial tag) independent of tags used for inventory aggregation.';

COMMENT ON COLUMN raw_material_types.type_key IS
  'Stable system identifier for the type (e.g., banana).';

COMMENT ON COLUMN raw_material_types.type_name IS
  'Human-readable name for the type (e.g., Banana).';

COMMENT ON COLUMN raw_material_types.allowed_unit_ids IS
  'Array of raw_material_units.id values allowed for this Type. Enforced at application layer.';

-- 3) Seed example Type for Banana when tag and at least kg unit exist (bosta optional)

WITH banana_tag AS (
  SELECT id FROM raw_material_tags WHERE tag_key = 'banana' LIMIT 1
),
kg_unit AS (
  SELECT id FROM raw_material_units WHERE unit_key = 'kg' OR display_name ILIKE 'kg%' LIMIT 1
),
bosta_unit AS (
  SELECT id FROM raw_material_units WHERE unit_key = 'bosta' OR display_name ILIKE '%bosta%' LIMIT 1
)
INSERT INTO raw_material_types (type_key, type_name, raw_material_tag_id, allowed_unit_ids, status)
SELECT
  'banana',
  'Banana',
  banana_tag.id,
  ARRAY_REMOVE(ARRAY[kg_unit.id, bosta_unit.id]::uuid[], NULL),
  'active'
FROM banana_tag, kg_unit
LEFT JOIN bosta_unit ON true
WHERE NOT EXISTS (SELECT 1 FROM raw_material_types WHERE type_key = 'banana');

-- Optional: set default prefixes for Banana and Banana Peel tags when present
UPDATE raw_material_tags
SET lot_prefix = 'RAW-BAN'
WHERE tag_key = 'banana'
  AND lot_prefix IS NULL;

UPDATE raw_material_tags
SET lot_prefix = 'FIN-BAN-PEEL'
WHERE tag_key = 'banana_peel'
  AND lot_prefix IS NULL;

