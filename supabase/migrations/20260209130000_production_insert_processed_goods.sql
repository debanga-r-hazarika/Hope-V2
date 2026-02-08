/*
  # Production module: insert into processed_goods when completing batch

  When a user with Production access locks/completes a batch, the app inserts
  rows into processed_goods (finished goods from batch outputs). Allow INSERT
  and SELECT for operations-production-batches so lock/save succeeds.
*/

-- ============================================
-- PROCESSED GOODS: allow SELECT for Production users
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view processed goods" ON processed_goods;
CREATE POLICY "Users with operations access can view processed goods"
  ON processed_goods FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-processed-goods', 'operations-production-batches', 'sales')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- PROCESSED GOODS: allow INSERT for Production users (when completing batch)
-- ============================================
DROP POLICY IF EXISTS "Users with read-write access can insert processed goods" ON processed_goods;
CREATE POLICY "Users with read-write access can insert processed goods"
  ON processed_goods FOR INSERT
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
      AND uma.module_name IN ('operations', 'operations-processed-goods', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );
