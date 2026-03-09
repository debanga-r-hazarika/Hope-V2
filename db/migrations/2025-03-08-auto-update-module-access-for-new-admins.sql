-- Automatically update all module access to 'read-write' when a user becomes admin
-- This ensures admins have full access to all modules by default

-- Create function to update module access when user role changes to admin
CREATE OR REPLACE FUNCTION update_module_access_on_admin_promotion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if role changed to 'admin' (from non-admin)
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    -- Update all existing module access entries for this user to 'read-write'
    UPDATE user_module_access
    SET 
      access_level = 'read-write',
      has_access = true,
      granted_at = now()
    WHERE user_id = NEW.id;
    
    -- Log the change
    RAISE NOTICE 'Updated all module access to read-write for new admin user: %', NEW.full_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on users table
DROP TRIGGER IF EXISTS trigger_update_module_access_on_admin_promotion ON users;

CREATE TRIGGER trigger_update_module_access_on_admin_promotion
  AFTER UPDATE OF role ON users
  FOR EACH ROW
  WHEN (NEW.role = 'admin' AND (OLD.role IS DISTINCT FROM 'admin'))
  EXECUTE FUNCTION update_module_access_on_admin_promotion();

-- Add comment
COMMENT ON FUNCTION update_module_access_on_admin_promotion() IS 
'Automatically updates all module access entries to read-write when a user is promoted to admin role. This ensures admins have full access to all modules by default.';
