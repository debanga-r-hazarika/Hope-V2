# Simple Access Control Approach

## Philosophy

**One source of truth**: The `user_module_access` table determines who can access what.

## How It Works

### For Regular Users
1. Admin grants module access via Module Access Management page
2. Entry created in `user_module_access` with `access_level` (read-write or read-only)
3. RLS policies check this table to allow/deny operations

### For Admin Users
1. User is promoted to admin role
2. Trigger automatically updates ALL their `user_module_access` entries to `read-write`
3. RLS policies check this table (same as regular users)
4. Admin has full access because they have `read-write` on all modules

## Key Components

### 1. Trigger (Automatic)
```sql
CREATE TRIGGER trigger_update_module_access_on_admin_promotion
  AFTER UPDATE OF role ON users
  WHEN (NEW.role = 'admin')
  EXECUTE FUNCTION update_module_access_on_admin_promotion();
```

**What it does**: When user becomes admin, sets all their module access to `read-write`

### 2. RLS Policies (Simple)
```sql
-- Example for analytics_targets
CREATE POLICY "Users with analytics access can view targets"
ON analytics_targets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN user_module_access uma ON u.id = uma.user_id
    WHERE u.auth_user_id = auth.uid()
    AND uma.module_name = 'analytics'
    AND uma.access_level IN ('read-write', 'read-only')
  )
);
```

**What it does**: Checks if user has analytics module access (works for both admin and regular users)

## Benefits

✅ **Simple**: One consistent check for all users
✅ **Transparent**: Query `user_module_access` to see who has what access
✅ **Maintainable**: No duplicate logic or special cases
✅ **Reliable**: Trigger ensures admins always have proper access

## Checking Access

### In Database
```sql
SELECT 
  u.full_name,
  u.role,
  uma.module_name,
  uma.access_level
FROM users u
JOIN user_module_access uma ON u.id = uma.user_id
WHERE u.email = 'user@example.com';
```

### In Application
Just check the `user_module_access` table - no need to check role separately.

## Example Scenarios

### Scenario 1: Regular User Gets Analytics R/W
1. Admin grants analytics read-write access
2. Entry created: `{module: 'analytics', access_level: 'read-write'}`
3. User can create/edit/delete targets ✅

### Scenario 2: User Promoted to Admin
1. User role changed from 'user' to 'admin'
2. Trigger fires automatically
3. ALL module access entries updated to `read-write`
4. User now has full access to everything ✅

### Scenario 3: Admin Demoted to User
1. Admin role changed to 'user'
2. Module access entries remain as-is (still read-write)
3. Admin manually adjusts access levels as needed

## Migration Files

1. `2025-03-08-auto-update-module-access-for-new-admins.sql` - Creates trigger
2. `2025-03-08-fix-existing-admin-module-access.sql` - Fixes existing admins
3. `2025-03-08-revert-to-simple-rls-and-ensure-admin-module-access.sql` - Simplifies RLS policies

## Summary

**Before**: Complex RLS with admin role checks + module access checks
**After**: Simple RLS that only checks module access + trigger ensures admins have proper entries

Result: Cleaner code, easier to understand, same functionality.
