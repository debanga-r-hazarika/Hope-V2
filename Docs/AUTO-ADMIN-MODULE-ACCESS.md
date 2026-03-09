# Automatic Module Access for Admin Users

## Overview

When a user is promoted to the `admin` role, all their module access entries are automatically updated to `read-write` access level. This ensures admins have full access to all modules by default without manual intervention.

## Implementation

### Database Trigger

A PostgreSQL trigger automatically updates module access when a user's role changes to 'admin':

```sql
CREATE TRIGGER trigger_update_module_access_on_admin_promotion
  AFTER UPDATE OF role ON users
  FOR EACH ROW
  WHEN (NEW.role = 'admin' AND (OLD.role IS DISTINCT FROM 'admin'))
  EXECUTE FUNCTION update_module_access_on_admin_promotion();
```

### Behavior

1. **Trigger Activation**: Fires when a user's `role` column is updated to 'admin'
2. **Automatic Update**: All existing `user_module_access` entries for that user are updated to:
   - `access_level = 'read-write'`
   - `has_access = true`
   - `granted_at = now()`
3. **Logging**: A notice is logged with the admin user's name

### Example

**Before promotion:**
```
User: John Doe (role: user)
- analytics: read-only
- finance: read-only
- operations: read-write
- sales: no-access
```

**After promotion to admin:**
```sql
UPDATE users SET role = 'admin' WHERE id = 'john-doe-id';
```

**Result:**
```
User: John Doe (role: admin)
- analytics: read-write  ← automatically updated
- finance: read-write    ← automatically updated
- operations: read-write ← already read-write
- sales: read-write      ← automatically updated
```

## Migration Files

1. **2025-03-08-auto-update-module-access-for-new-admins.sql**
   - Creates the trigger function and trigger
   - Handles future admin promotions

2. **2025-03-08-fix-existing-admin-module-access.sql**
   - One-time update for existing admin users
   - Ensures all current admins have read-write access

## Benefits

- **Consistency**: All admins automatically have full access
- **No Manual Work**: No need to manually update module access after promotion
- **Audit Trail**: `granted_at` timestamp is updated when access is granted
- **Reliable**: Database-level enforcement ensures it always happens

## Testing

To verify the trigger works:

```sql
-- Check current access for a user
SELECT u.full_name, u.role, uma.module_name, uma.access_level
FROM users u
LEFT JOIN user_module_access uma ON u.id = uma.user_id
WHERE u.email = 'test@example.com';

-- Promote user to admin
UPDATE users SET role = 'admin' WHERE email = 'test@example.com';

-- Verify all access is now read-write
SELECT u.full_name, u.role, uma.module_name, uma.access_level
FROM users u
LEFT JOIN user_module_access uma ON u.id = uma.user_id
WHERE u.email = 'test@example.com';
```

## Notes

- The trigger only fires when role changes TO 'admin' (not when changing FROM admin to another role)
- If a user has no module access entries, the trigger won't create new ones (they should be created through the normal module access management flow)
- The trigger uses `IS DISTINCT FROM` to handle NULL values correctly
- Existing admin users were updated via the one-time migration
