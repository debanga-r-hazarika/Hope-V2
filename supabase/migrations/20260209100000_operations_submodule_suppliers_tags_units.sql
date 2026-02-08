/*
  # Operations sub-modules: Suppliers, Tags, Units, Machines

  - Recurring Product users must see recurring_product_tags and recurring_product_units
    (policies previously only allowed module_name = 'operations').
  - Suppliers and Machines are shared: allow access when user has
    operations-raw-materials OR operations-recurring-products (or legacy operations / operations-suppliers / operations-machines).
  - Read: any of these modules with read-only or read-write.
  - Write: any of these modules with read-write (highest privilege).
*/

-- ============================================
-- RECURRING PRODUCT TAGS (SELECT)
-- ============================================
DROP POLICY IF EXISTS "Admins and operations users can view recurring product tags" ON recurring_product_tags;
CREATE POLICY "Admins and operations users can view recurring product tags"
  ON recurring_product_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR (
      status = 'active' AND
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('operations', 'operations-recurring-products')
        AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
      )
    )
  );

-- ============================================
-- RECURRING PRODUCT UNITS (SELECT)
-- ============================================
DROP POLICY IF EXISTS "Admins and operations users can view recurring product units" ON recurring_product_units;
CREATE POLICY "Admins and operations users can view recurring product units"
  ON recurring_product_units FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR (
      status = 'active' AND
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('operations', 'operations-recurring-products')
        AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
      )
    )
  );

-- ============================================
-- SUPPLIERS (shared: Raw Material + Recurring Product; highest privilege = R/W)
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view suppliers" ON suppliers;
CREATE POLICY "Users with operations access can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-suppliers', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert suppliers" ON suppliers;
CREATE POLICY "Users with read-write access can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-suppliers', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can update suppliers" ON suppliers;
CREATE POLICY "Users with read-write access can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-suppliers', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-suppliers', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete suppliers" ON suppliers;
CREATE POLICY "Users with read-write access can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-suppliers', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- MACHINES (shared: Raw Material + Recurring Product; highest privilege = R/W)
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view machines" ON machines;
CREATE POLICY "Users with operations access can view machines"
  ON machines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-machines', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert machines" ON machines;
CREATE POLICY "Users with read-write access can insert machines"
  ON machines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-machines', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can update machines" ON machines;
CREATE POLICY "Users with read-write access can update machines"
  ON machines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-machines', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-machines', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete machines" ON machines;
CREATE POLICY "Users with read-write access can delete machines"
  ON machines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-machines', 'operations-raw-materials', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );
