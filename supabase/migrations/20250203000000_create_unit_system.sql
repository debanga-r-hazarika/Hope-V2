/*
  # Unit System - Admin-Controlled Measurement Units
  
  This migration creates the unit system for standardizing measurement units across inventory items.
  
  Three unit types:
  1. Raw Material Units - for raw_materials
  2. Recurring Product Units - for recurring_products  
  3. Produced Goods Units - for processed_goods (from production batches)
  
  Each unit has an allows_decimal flag that determines if decimal values are allowed.
  Only Admins can create/update units.
  Units cannot be deleted if used.
  Inactive units cannot be selected for new entries but remain for historical data.
*/

-- ============================================
-- 1. RAW MATERIAL UNITS
-- ============================================
CREATE TABLE IF NOT EXISTS raw_material_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  allows_decimal boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE raw_material_units ENABLE ROW LEVEL SECURITY;

-- Admins can view all units (including inactive)
-- Operations users can view active units for selection
CREATE POLICY "Admins and operations users can view raw material units"
  ON raw_material_units FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all units
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- Operations users can see active units only
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

-- Only admins can create units
CREATE POLICY "Admins can create raw material units"
  ON raw_material_units FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can update units
CREATE POLICY "Admins can update raw material units"
  ON raw_material_units FOR UPDATE
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

-- Units cannot be deleted if used (enforced via trigger/application logic)
-- No DELETE policy - deletion must be done through admin UI which checks usage

CREATE INDEX IF NOT EXISTS idx_raw_material_units_status ON raw_material_units(status);
CREATE INDEX IF NOT EXISTS idx_raw_material_units_key ON raw_material_units(unit_key);

-- ============================================
-- 2. RECURRING PRODUCT UNITS
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_product_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  allows_decimal boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE recurring_product_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operations users can view recurring product units"
  ON recurring_product_units FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all units
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- Operations users can see active units only
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

CREATE POLICY "Admins can create recurring product units"
  ON recurring_product_units FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update recurring product units"
  ON recurring_product_units FOR UPDATE
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

CREATE INDEX IF NOT EXISTS idx_recurring_product_units_status ON recurring_product_units(status);
CREATE INDEX IF NOT EXISTS idx_recurring_product_units_key ON recurring_product_units(unit_key);

-- ============================================
-- 3. PRODUCED GOODS UNITS
-- ============================================
CREATE TABLE IF NOT EXISTS produced_goods_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  allows_decimal boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE produced_goods_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operations users can view produced goods units"
  ON produced_goods_units FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all units
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- Operations users can see active units only
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

CREATE POLICY "Admins can create produced goods units"
  ON produced_goods_units FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update produced goods units"
  ON produced_goods_units FOR UPDATE
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

CREATE INDEX IF NOT EXISTS idx_produced_goods_units_status ON produced_goods_units(status);
CREATE INDEX IF NOT EXISTS idx_produced_goods_units_key ON produced_goods_units(unit_key);

-- ============================================
-- 4. FUNCTION TO UPDATE updated_at TIMESTAMP
-- ============================================
-- Note: update_updated_at_column() function should already exist from tag migration
-- If not, it will be created here

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_raw_material_units_updated_at
  BEFORE UPDATE ON raw_material_units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_product_units_updated_at
  BEFORE UPDATE ON recurring_product_units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produced_goods_units_updated_at
  BEFORE UPDATE ON produced_goods_units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE raw_material_units IS 'Admin-defined units for measuring raw materials. Units control whether decimal values are allowed (e.g., kg allows decimals, pieces do not).';
COMMENT ON TABLE recurring_product_units IS 'Admin-defined units for measuring recurring products (packaging, consumables). Units control whether decimal values are allowed.';
COMMENT ON TABLE produced_goods_units IS 'Admin-defined units for measuring produced goods. Units control whether decimal values are allowed.';

COMMENT ON COLUMN raw_material_units.unit_key IS 'System identifier (e.g., kg, pieces, ltr). Must be unique and follow lowercase convention.';
COMMENT ON COLUMN recurring_product_units.unit_key IS 'System identifier (e.g., pieces, boxes, bottles). Must be unique and follow lowercase convention.';
COMMENT ON COLUMN produced_goods_units.unit_key IS 'System identifier (e.g., kg, gm, ltr, pieces). Must be unique and follow lowercase convention.';

COMMENT ON COLUMN raw_material_units.allows_decimal IS 'If true, quantities can have decimal values (e.g., 1.5 kg). If false, only whole numbers allowed (e.g., 5 pieces).';
COMMENT ON COLUMN recurring_product_units.allows_decimal IS 'If true, quantities can have decimal values. If false, only whole numbers allowed.';
COMMENT ON COLUMN produced_goods_units.allows_decimal IS 'If true, quantities can have decimal values. If false, only whole numbers allowed.';

COMMENT ON COLUMN raw_material_units.status IS 'active: can be selected for new entries. inactive: cannot be selected but remains for historical data.';
COMMENT ON COLUMN recurring_product_units.status IS 'active: can be selected for new entries. inactive: cannot be selected but remains for historical data.';
COMMENT ON COLUMN produced_goods_units.status IS 'active: can be selected for new entries. inactive: cannot be selected but remains for historical data.';
