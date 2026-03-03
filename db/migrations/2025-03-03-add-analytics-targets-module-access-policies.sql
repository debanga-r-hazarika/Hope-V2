-- Add RLS policy for users with analytics module access to view targets
CREATE POLICY "Users with analytics access can view targets"
  ON analytics_targets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN user_module_access uma ON u.id = uma.user_id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'analytics'
        AND uma.has_access = true
        AND uma.access_level IN ('read-write', 'read-only', 'admin')
    )
  );

-- Add RLS policy for users with read-write or admin access to insert targets
CREATE POLICY "Users with analytics write access can create targets"
  ON analytics_targets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN user_module_access uma ON u.id = uma.user_id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'analytics'
        AND uma.has_access = true
        AND uma.access_level IN ('read-write', 'admin')
    )
  );

-- Add RLS policy for users with read-write or admin access to update targets
CREATE POLICY "Users with analytics write access can update targets"
  ON analytics_targets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN user_module_access uma ON u.id = uma.user_id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'analytics'
        AND uma.has_access = true
        AND uma.access_level IN ('read-write', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN user_module_access uma ON u.id = uma.user_id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'analytics'
        AND uma.has_access = true
        AND uma.access_level IN ('read-write', 'admin')
    )
  );

-- Add RLS policy for users with read-write or admin access to delete targets
CREATE POLICY "Users with analytics write access can delete targets"
  ON analytics_targets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN user_module_access uma ON u.id = uma.user_id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'analytics'
        AND uma.has_access = true
        AND uma.access_level IN ('read-write', 'admin')
    )
  );

COMMENT ON POLICY "Users with analytics access can view targets" ON analytics_targets IS
  'Allows users with any analytics module access (read-only, read-write, or admin) to view sales targets';

COMMENT ON POLICY "Users with analytics write access can create targets" ON analytics_targets IS
  'Allows users with read-write or admin analytics access to create sales targets';

COMMENT ON POLICY "Users with analytics write access can update targets" ON analytics_targets IS
  'Allows users with read-write or admin analytics access to update sales targets';

COMMENT ON POLICY "Users with analytics write access can delete targets" ON analytics_targets IS
  'Allows users with read-write or admin analytics access to delete sales targets';
