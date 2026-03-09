-- Update the admin promotion trigger to CREATE missing module entries
-- Previously it only updated existing entries, now it ensures ALL modules are present

CREATE OR REPLACE FUNCTION update_module_access_on_admin_promotion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if role changed to 'admin' (from non-admin)
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    
    -- First, update all existing module access entries to 'read-write'
    UPDATE user_module_access
    SET 
      access_level = 'read-write',
      has_access = true,
      granted_at = now()
    WHERE user_id = NEW.id;
    
    -- Second, insert missing module entries for all standard modules
    INSERT INTO user_module_access (user_id, module_name, access_level, has_access, granted_by, granted_at)
    SELECT 
      NEW.id,
      m.module_name,
      'read-write',
      true,
      NEW.id,
      now()
    FROM (
      VALUES 
        ('finance'),
        ('analytics'),
        ('documents'),
        ('agile'),
        ('sales'),
        ('operations'),
        ('operations-raw-materials'),
        ('operations-raw-material-log'),
        ('operations-recurring-products'),
        ('operations-production-batches'),
        ('operations-processed-goods'),
        ('operations-suppliers'),
        ('operations-machines'),
        ('tools')
    ) AS m(module_name)
    WHERE NOT EXISTS (
      SELECT 1 
      FROM user_module_access uma 
      WHERE uma.user_id = NEW.id 
      AND uma.module_name = m.module_name
    )
    ON CONFLICT (user_id, module_name) DO NOTHING;
    
    -- Log the change
    RAISE NOTICE 'Updated and created module access entries for new admin user: %', NEW.full_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger remains the same, just the function is updated
COMMENT ON FUNCTION update_module_access_on_admin_promotion() IS 
'Automatically updates existing AND creates missing module access entries to read-write when a user is promoted to admin role. Ensures admins have full access to all modules.';
