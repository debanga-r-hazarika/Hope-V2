# Admin Users Can't See Targets - Fix

## Problem

Admin users could access the Targets Management page but couldn't see any targets, even though:
- They have `role = 'admin'`
- Targets exist in the database

## Root Cause

Admin users didn't have entries in the `user_module_access` table for the analytics module, so the RLS policies denied access.

## Solution (Simplified Approach)

Instead of adding complex admin role checks to RLS policies, we ensure all admin users have proper module access entries:

1. **Trigger**: Automatically adds/updates module access when user becomes admin
2. **Migration**: Ensures existing admins have analytics module access
3. **Simple RLS**: Policies only check `user_module_access` table (consistent for all users)


### RLS Policy (Simple)

```sql
-- Example: SELECT policy
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
```

**Key Point**: No special admin role check needed. Admins work like any other user - they just have read-write access to all modules via `user_module_access` table.

### Ensuring Admin Module Access

The trigger `update_module_access_on_admin_promotion()` automatically ensures admins have read-write access to all modules when promoted.

## Changes Made

### Migration Files

1. **2025-03-08-auto-update-module-access-for-new-admins.sql**
   - Creates trigger to update module access when user becomes admin
   
2. **2025-03-08-fix-existing-admin-module-access.sql**
   - One-time update for existing admin users

3. **2025-03-08-revert-to-simple-rls-and-ensure-admin-module-access.sql**
   - Simplified RLS policies (no admin role checks)
   - Ensures all admins have analytics module access

### Access Control Flow

```
User becomes admin
    ↓
Trigger fires: update_module_access_on_admin_promotion()
    ↓
All module_access entries set to 'read-write'
    ↓
RLS policies check user_module_access table
    ↓
Admin has access (same as any R/W user)
```

## Benefits

- **Simplicity**: One consistent access control mechanism for all users
- **Maintainability**: No duplicate logic in RLS policies
- **Transparency**: Easy to check who has what access by querying `user_module_access`
- **Consistency**: Admins and regular users follow the same access rules

## How to Check Access

To check if any user (including admin) has access to targets:

```sql
SELECT 
  u.full_name,
  u.role,
  uma.module_name,
  uma.access_level
FROM users u
JOIN user_module_access uma ON u.id = uma.user_id
WHERE uma.module_name = 'analytics';
```

Result shows:
- Admins: `access_level = 'read-write'`
- R/W users: `access_level = 'read-write'`
- R/O users: `access_level = 'read-only'`

## Testing

```sql
-- Check admin has analytics access
SELECT uma.access_level
FROM users u
JOIN user_module_access uma ON u.id = uma.user_id
WHERE u.role = 'admin'
AND uma.module_name = 'analytics';
-- Expected: 'read-write'
```
