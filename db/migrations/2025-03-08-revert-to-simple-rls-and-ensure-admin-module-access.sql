-- Simplify RLS policies by removing admin role checks
-- Instead, ensure all admins have proper module access entries
-- This makes access control consistent: just check user_module_access table

-- Step 1: Revert RLS policies to simple module access checks only
DROP POLICY IF EXISTS "Users with analytics write access can create targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics write access can update targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics write access can delete targets" ON analytics_targets;
DROP POLICY IF EXISTS "Users with analytics access can view targets" ON analytics_targets;

-- CREATE simple policies (no admin role check)

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
    AND uma.access_level = 'read-write'
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
    AND uma.access_level = 'read-write'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM users u
    JOIN user_module_access uma ON u.id = uma.user_id
    WHERE u.auth_user_id = auth.uid()
    AND uma.module_name = 'analytics'
    AND uma.access_level = 'read-write'
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
    AND uma.access_level = 'read-write'
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
    AND uma.access_level IN ('read-write', 'read-only')
  )
);

-- Step 2: Ensure all admin users have analytics module access with read-write
-- This is handled by the trigger created earlier (update_module_access_on_admin_promotion)
-- But let's also ensure current admins have it

INSERT INTO user_module_access (user_id, module_name, access_level, has_access, granted_by, granted_at)
SELECT 
  u.id,
  'analytics',
  'read-write',
  true,
  u.id, -- self-granted for admins
  now()
FROM users u
WHERE u.role = 'admin'
AND NOT EXISTS (
  SELECT 1 
  FROM user_module_access uma 
  WHERE uma.user_id = u.id 
  AND uma.module_name = 'analytics'
)
ON CONFLICT (user_id, module_name) 
DO UPDATE SET 
  access_level = 'read-write',
  has_access = true,
  granted_at = now();

-- Add comment
COMMENT ON POLICY "Users with analytics access can view targets" ON analytics_targets IS 
'Simple policy: checks user_module_access table only. Admins are ensured to have read-write access via trigger.';
