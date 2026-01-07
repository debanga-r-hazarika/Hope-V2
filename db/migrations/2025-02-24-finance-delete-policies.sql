-- Delete policies for finance tables
-- Allows authenticated users with finance module access to delete rows

CREATE POLICY "Finance users can delete contributions"
  ON contributions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'finance'
        AND uma.has_access = true
    )
  );

CREATE POLICY "Finance users can delete income"
  ON income FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'finance'
        AND uma.has_access = true
    )
  );

CREATE POLICY "Finance users can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'finance'
        AND uma.has_access = true
    )
  );




