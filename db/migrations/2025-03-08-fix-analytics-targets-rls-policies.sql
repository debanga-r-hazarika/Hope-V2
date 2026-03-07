-- Fix analytics_targets RLS policies to work with new access_level system
-- Remove invalid 'admin' from access_level checks and fix the logic

-- DROP old policies
DROP POLICY IF EXISTS "Users with analytics write access can create targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics write access can update targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics write access can delete targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics access can view targets" ON analytics_targets;

-- CREATE fixed policies

-- INSERT: Users with Analytics R/W access can create targets
CREATE POLICY "Users with analytics write access can create targets"
ON analytics_targets
FOR INSERT
TO authenticated
WITH CHECK (
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

-- UPDATE: Users with Analytics R/W access can update targets
CREATE POLICY "Users with analytics write access can update targets"
ON analytics_targets
FOR UPDATE
TO authenticated
USING (
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

-- DELETE: Users with Analytics R/W access can delete targets
CREATE POLICY "Users with analytics write access can delete targets"
ON analytics_targets
FOR DELETE
TO authenticated
USING (
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

-- SELECT: Users with Analytics R/W or R/O access can view targets
CREATE POLICY "Users with analytics access can view targets"
ON analytics_targets
FOR SELECT
TO authenticated
USING (
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
