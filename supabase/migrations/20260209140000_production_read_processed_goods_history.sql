/*
  # Production module: read processed_goods_history

  Allow users with operations-production-batches to SELECT from processed_goods_history
  so Processed Goods section and any history views work for Production-only users.
*/

DROP POLICY IF EXISTS "Users with operations or sales access can view processed goods history" ON processed_goods_history;
CREATE POLICY "Users with operations or sales access can view processed goods history"
  ON processed_goods_history FOR SELECT
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
