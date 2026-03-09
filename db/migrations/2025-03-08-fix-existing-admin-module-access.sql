-- One-time fix: Update all existing admin users to have read-write access to all modules
-- This ensures any admins created before the trigger was implemented have proper access

-- Update all module access entries for existing admin users
UPDATE user_module_access uma
SET 
  access_level = 'read-write',
  has_access = true,
  granted_at = now()
FROM users u
WHERE uma.user_id = u.id
  AND u.role = 'admin'
  AND (uma.access_level != 'read-write' OR uma.access_level IS NULL OR uma.has_access = false);

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % module access entries for existing admin users', updated_count;
END $$;
