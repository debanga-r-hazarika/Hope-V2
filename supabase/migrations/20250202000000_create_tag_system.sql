/*
  # Tag System - Admin-Controlled Classification Tags
  
  This migration creates the tag system for logical grouping of inventory items.
  
  Three tag types:
  1. Raw Material Type Tags - for raw_materials
  2. Recurring Product Type Tags - for recurring_products  
  3. Produced Goods Type Tags - for processed_goods (from production batches)
  
  Tags are metadata only and do not affect stock quantities.
  Only Admins can create/update tags.
  Tags cannot be deleted if used.
  Inactive tags cannot be selected for new entries but remain for historical data.
*/

-- ============================================
-- 1. RAW MATERIAL TYPE TAGS
-- ============================================
CREATE TABLE IF NOT EXISTS raw_material_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE raw_material_tags ENABLE ROW LEVEL SECURITY;

-- Admins can view all tags (including inactive)
-- Operations users can view active tags for selection
CREATE POLICY "Admins and operations users can view raw material tags"
  ON raw_material_tags FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all tags
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- Operations users can see active tags only
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

-- Only admins can create tags
CREATE POLICY "Admins can create raw material tags"
  ON raw_material_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can update tags
CREATE POLICY "Admins can update raw material tags"
  ON raw_material_tags FOR UPDATE
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

-- Tags cannot be deleted if used (enforced via trigger/application logic)
-- No DELETE policy - deletion must be done through admin UI which checks usage

CREATE INDEX IF NOT EXISTS idx_raw_material_tags_status ON raw_material_tags(status);
CREATE INDEX IF NOT EXISTS idx_raw_material_tags_key ON raw_material_tags(tag_key);

-- ============================================
-- 2. RECURRING PRODUCT TYPE TAGS
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE recurring_product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operations users can view recurring product tags"
  ON recurring_product_tags FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all tags
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- Operations users can see active tags only
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

CREATE POLICY "Admins can create recurring product tags"
  ON recurring_product_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update recurring product tags"
  ON recurring_product_tags FOR UPDATE
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

CREATE INDEX IF NOT EXISTS idx_recurring_product_tags_status ON recurring_product_tags(status);
CREATE INDEX IF NOT EXISTS idx_recurring_product_tags_key ON recurring_product_tags(tag_key);

-- ============================================
-- 3. PRODUCED GOODS TYPE TAGS
-- ============================================
CREATE TABLE IF NOT EXISTS produced_goods_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE produced_goods_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operations users can view produced goods tags"
  ON produced_goods_tags FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all tags
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- Operations users can see active tags only
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

CREATE POLICY "Admins can create produced goods tags"
  ON produced_goods_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update produced goods tags"
  ON produced_goods_tags FOR UPDATE
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

CREATE INDEX IF NOT EXISTS idx_produced_goods_tags_status ON produced_goods_tags(status);
CREATE INDEX IF NOT EXISTS idx_produced_goods_tags_key ON produced_goods_tags(tag_key);

-- ============================================
-- 4. ADD TAG FOREIGN KEYS TO EXISTING TABLES
-- ============================================

-- Add tag_id to raw_materials (NOT NULL for new entries, nullable for existing)
ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS raw_material_tag_id uuid REFERENCES raw_material_tags(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_raw_materials_tag_id ON raw_materials(raw_material_tag_id);

-- Add tag_id to recurring_products
ALTER TABLE recurring_products
  ADD COLUMN IF NOT EXISTS recurring_product_tag_id uuid REFERENCES recurring_product_tags(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recurring_products_tag_id ON recurring_products(recurring_product_tag_id);

-- Add tag_id to processed_goods (from production batches)
ALTER TABLE processed_goods
  ADD COLUMN IF NOT EXISTS produced_goods_tag_id uuid REFERENCES produced_goods_tags(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_processed_goods_tag_id ON processed_goods(produced_goods_tag_id);

-- Add tag_id to production_batches (to track selected tag during QA approval)
ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS produced_goods_tag_id uuid REFERENCES produced_goods_tags(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_production_batches_tag_id ON production_batches(produced_goods_tag_id);

-- ============================================
-- 5. RLS POLICIES FOR TAG SELECTION
-- ============================================
-- Note: Tag selection policies are already covered in the main SELECT policies above
-- which allow operations users to see active tags and admins to see all tags

-- ============================================
-- 6. FUNCTION TO UPDATE updated_at TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_raw_material_tags_updated_at
  BEFORE UPDATE ON raw_material_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_product_tags_updated_at
  BEFORE UPDATE ON recurring_product_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produced_goods_tags_updated_at
  BEFORE UPDATE ON produced_goods_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE raw_material_tags IS 'Admin-defined tags for classifying raw materials. Tags act as logical SKUs for grouping materials with different names/suppliers/batches that represent the same material type operationally.';
COMMENT ON TABLE recurring_product_tags IS 'Admin-defined tags for classifying recurring products (packaging, consumables). Tags enable logical grouping across different suppliers and batches.';
COMMENT ON TABLE produced_goods_tags IS 'Admin-defined tags for classifying produced goods. Used during production batch QA approval to standardize finished goods classification.';

COMMENT ON COLUMN raw_material_tags.tag_key IS 'System identifier (e.g., banana_peel). Must be unique and follow snake_case convention.';
COMMENT ON COLUMN recurring_product_tags.tag_key IS 'System identifier (e.g., bottle_250ml). Must be unique and follow snake_case convention.';
COMMENT ON COLUMN produced_goods_tags.tag_key IS 'System identifier (e.g., banana_alkali_liquid). Must be unique and follow snake_case convention.';

COMMENT ON COLUMN raw_material_tags.status IS 'active: can be selected for new entries. inactive: cannot be selected but remains for historical data.';
COMMENT ON COLUMN recurring_product_tags.status IS 'active: can be selected for new entries. inactive: cannot be selected but remains for historical data.';
COMMENT ON COLUMN produced_goods_tags.status IS 'active: can be selected for new entries. inactive: cannot be selected but remains for historical data.';
