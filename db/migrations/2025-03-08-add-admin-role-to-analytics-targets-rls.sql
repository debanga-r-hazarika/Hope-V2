-- Add explicit admin role check to analytics_targets RLS policies
-- Admins should always have full access regardless of module_access entries

-- DROP existing policies
DROP POLICY IF EXISTS "Users with analytics write access can create targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics write access can update targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics write access can delete targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics access can view targets" ON analytics_targets;

-- CREATE updated policies with admin role check

-- INSERT: Admins OR users with Analytics R/W access can create targets
CREATE POLICY "Users with analytics write access can create targets"
ON analytics_targets
FOR INSERT
TO authenticated
WITH CHECK (
  -- Admin users have full access
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'admin'
  )
  OR
  -- Users with Analytics R/W access
  EXISTS (
    SELECT 1
    FROM users u
    JOIN user_module_access uma ON u.id = uma.user_id
    WHERE u.auth_user_id = auth.uid()
    AND uma.module_name = 'analytics'
    AND (
      uma.access_level = 'read-write'
      OR (uma.access_level IS NULL AND uma.has_access = true)
    )
  )
);

-- UPDATE: Admins OR users with Analytics R/W access can update targets
CREATE POLICY "Users with analytics write access can update targets"
ON analytics_targets
FOR UPDATE
TO authenticated
USING (
  -- Admin users have full access
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'admin'
  )
  OR
  -- Users with Analytics R/W access
  EXISTS (
    SELECT 1
    FROM users u
    JOIN user_module_access uma ON u.id = uma.user_id
    WHERE u.auth_user_id = auth.uid()
    AND uma.module_name = 'analytics'
    AND (
      uma.access_level = 'read-write'
      OR (uma.access_level IS NULL AND uma.has_access = true)
    )
  )
)
WITH CHECK (
  -- Admin users have full access
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'admin'
  )
  OR
  -- Users with Analytics R/W access
  EXISTS (
    SELECT 1
    FROM users u
    JOIN user_module_access uma ON u.id = uma.user_id
    WHERE u.auth_user_id = auth.uid()
    AND uma.module_name = 'analytics'
    AND (
      uma.access_level = 'read-write'
      OR (uma.access_level IS NULL AND uma.has_access = true)
    )
  )
);

-- DELETE: Admins OR users with Analytics R/W access can delete targets
CREATE POLICY "Users with analytics write access can delete targets"
ON analytics_targets
FOR DELETE
TO authenticated
USING (
  -- Admin users have full access
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'admin'
  )
  OR
  -- Users with Analytics R/W access
  EXISTS (
    SELECT 1
    FROM users u
    JOIN user_module_access uma ON u.id = uma.user_id
    WHERE u.auth_user_id = auth.uid()
    AND uma.module_name = 'analytics'
    AND (
      uma.access_level = 'read-write'
      OR (uma.access_level IS NULL AND uma.has_access = true)
    )
  )
);

-- SELECT: Admins OR users with Analytics R/W or R/O access can view targets
CREATE POLICY "Users with analytics access can view targets"
ON analytics_targets
FOR SELECT
TO authenticated
USING (
  -- Admin users have full access
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'admin'
  )
  OR
  -- Users with Analytics R/W or R/O access
  EXISTS (
    SELECT 1
    FROM users u
    JOIN user_module_access uma ON u.id = uma.user_id
    WHERE u.auth_user_id = auth.uid()
    AND uma.module_name = 'analytics'
    AND (
      uma.access_level IN ('read-write', 'read-only')
      OR (uma.access_level IS NULL AND uma.has_access = true)
    )
  )
);

-- Add comments
COMMENT ON POLICY "Users with analytics access can view targets" ON analytics_targets IS 
'Allows admin users (by role) OR users with analytics module access (read-write or read-only) to view targets';

COMMENT ON POLICY "Users with analytics write access can create targets" ON analytics_targets IS 
'Allows admin users (by role) OR users with analytics module read-write access to create targets';

COMMENT ON POLICY "Users with analytics write access can update targets" ON analytics_targets IS 
'Allows admin users (by role) OR users with analytics module read-write access to update targets';

COMMENT ON POLICY "Users with analytics write access can delete targets" ON analytics_targets IS 
'Allows admin users (by role) OR users with analytics module read-write access to delete targets';
