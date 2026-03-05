-- Raw material transformation rules: which source tags can transform to which target tags, with optional default steps.
-- Used to drive the Transform modal (allowed targets dropdown) and default process steps.

CREATE TABLE IF NOT EXISTS raw_material_transformation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tag_id uuid NOT NULL REFERENCES raw_material_tags(id) ON DELETE CASCADE,
  target_tag_id uuid NOT NULL REFERENCES raw_material_tags(id) ON DELETE CASCADE,
  default_steps jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source_tag_id, target_tag_id),
  CHECK (source_tag_id != target_tag_id)
);

COMMENT ON TABLE raw_material_transformation_rules IS
  'Defines allowed transformation targets per source raw material tag and optional default process steps (e.g. Banana → Banana Peel with steps: Extract, Drying, Sorting).';

CREATE INDEX IF NOT EXISTS idx_transformation_rules_source ON raw_material_transformation_rules(source_tag_id);
CREATE INDEX IF NOT EXISTS idx_transformation_rules_target ON raw_material_transformation_rules(target_tag_id);

ALTER TABLE raw_material_transformation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS raw_material_transformation_rules_select ON raw_material_transformation_rules;
CREATE POLICY raw_material_transformation_rules_select ON raw_material_transformation_rules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS raw_material_transformation_rules_insert ON raw_material_transformation_rules;
CREATE POLICY raw_material_transformation_rules_insert ON raw_material_transformation_rules
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS raw_material_transformation_rules_update ON raw_material_transformation_rules;
CREATE POLICY raw_material_transformation_rules_update ON raw_material_transformation_rules
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS raw_material_transformation_rules_delete ON raw_material_transformation_rules;
CREATE POLICY raw_material_transformation_rules_delete ON raw_material_transformation_rules
  FOR DELETE USING (true);

-- Seed: Banana → Banana Peel with default steps (if both tags exist)
INSERT INTO raw_material_transformation_rules (source_tag_id, target_tag_id, default_steps)
SELECT s.id, t.id, '[{"key":"extract_banana","label":"Extract banana"},{"key":"drying","label":"Drying"},{"key":"sorting","label":"Sorting"},{"key":"other","label":"Other"}]'::jsonb
FROM raw_material_tags s
CROSS JOIN raw_material_tags t
WHERE s.tag_key = 'banana' AND t.tag_key = 'banana_peel'
ON CONFLICT (source_tag_id, target_tag_id) DO NOTHING;
