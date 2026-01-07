-- Update finance delete policies to require read-write access

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Finance users can delete contributions') THEN
    DROP POLICY "Finance users can delete contributions" ON contributions;
  END IF;
  CREATE POLICY "Finance users can delete contributions"
    ON contributions FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
          AND uma.module_name = 'finance'
          AND (uma.access_level = 'read-write' OR uma.has_access = true)
      )
    );

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Finance users can delete income') THEN
    DROP POLICY "Finance users can delete income" ON income;
  END IF;
  CREATE POLICY "Finance users can delete income"
    ON income FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
          AND uma.module_name = 'finance'
          AND (uma.access_level = 'read-write' OR uma.has_access = true)
      )
    );

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Finance users can delete expenses') THEN
    DROP POLICY "Finance users can delete expenses" ON expenses;
  END IF;
  CREATE POLICY "Finance users can delete expenses"
    ON expenses FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
          AND uma.module_name = 'finance'
          AND (uma.access_level = 'read-write' OR uma.has_access = true)
      )
    );
END $$;




