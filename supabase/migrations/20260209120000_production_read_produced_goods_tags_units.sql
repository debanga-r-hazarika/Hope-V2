/*
  # Production module: read access to produced_goods_tags and produced_goods_units

  Users with Production (operations-production-batches) access need to SELECT
  produced_goods_tags and produced_goods_units in the Output step when defining
  finished product. Allow SELECT for operations and operations-production-batches.
*/

-- ============================================
-- PRODUCED GOODS TAGS: allow SELECT for Production users
-- ============================================
DROP POLICY IF EXISTS "Admins and operations users can view produced goods tags" ON produced_goods_tags;
CREATE POLICY "Admins and operations users can view produced goods tags"
  ON produced_goods_tags FOR SELECT
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
        AND uma.module_name IN ('operations', 'operations-production-batches')
        AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
      )
    )
  );

-- ============================================
-- PRODUCED GOODS UNITS: allow SELECT for Production users
-- ============================================
DROP POLICY IF EXISTS "Admins and operations users can view produced goods units" ON produced_goods_units;
CREATE POLICY "Admins and operations users can view produced goods units"
  ON produced_goods_units FOR SELECT
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
        AND uma.module_name IN ('operations', 'operations-production-batches')
        AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
      )
    )
  );
