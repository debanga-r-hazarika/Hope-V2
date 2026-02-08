/*
  # Inventory Dashboard: Raw Material tags and units for R/O and R/W

  Users with any access (read-only or read-write) to Raw Material module should
  see raw material tags and units on the Inventory Dashboard. Allow
  operations-raw-materials with read-only or read-write for SELECT.
*/

-- ============================================
-- RAW MATERIAL TAGS: allow SELECT for Raw Material module (R/O or R/W)
-- ============================================
DROP POLICY IF EXISTS "Admins and operations users can view raw material tags" ON raw_material_tags;
CREATE POLICY "Admins and operations users can view raw material tags"
  ON raw_material_tags FOR SELECT
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
        AND uma.module_name IN ('operations', 'operations-raw-materials')
        AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
      )
    )
  );

-- ============================================
-- RAW MATERIAL UNITS: allow SELECT for Raw Material module (R/O or R/W)
-- ============================================
DROP POLICY IF EXISTS "Admins and operations users can view raw material units" ON raw_material_units;
CREATE POLICY "Admins and operations users can view raw material units"
  ON raw_material_units FOR SELECT
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
        AND uma.module_name IN ('operations', 'operations-raw-materials')
        AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
      )
    )
  );
