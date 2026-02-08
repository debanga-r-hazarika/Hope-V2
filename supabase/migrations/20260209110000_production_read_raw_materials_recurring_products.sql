/*
  # Production module: read access to raw_materials and recurring_products

  Users with only Production (operations-production-batches) access need to
  SELECT raw_materials and recurring_products when building a batch (steps 2 & 3).
  They do NOT get insert/update/delete on these tables—only read for selection.
*/

-- ============================================
-- RAW MATERIALS: allow SELECT for Production users
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view raw materials" ON raw_materials;
CREATE POLICY "Users with operations access can view raw materials"
  ON raw_materials FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-raw-materials', 'operations-production-batches')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- RECURRING PRODUCTS: allow SELECT for Production users
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view recurring products" ON recurring_products;
CREATE POLICY "Users with operations access can view recurring products"
  ON recurring_products FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-recurring-products', 'operations-production-batches')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );
