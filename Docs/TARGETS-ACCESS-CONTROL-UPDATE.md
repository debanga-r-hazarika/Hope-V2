# Targets Access Control Update

## Overview
Updated the targets management system to use Analytics module access control instead of admin role checks. This allows non-admin users with Read/Write access to the Analytics module to manage targets.

## Changes Made

### 1. Access Control Logic Update

**Previous Behavior:**
- Only users with `role === 'admin'` could create/edit/delete targets
- All other users could only view targets

**New Behavior:**
- Users with **Read/Write access to Analytics module** can create/edit/delete targets
- Admins automatically have Read/Write access to all modules (including Analytics)
- Users with **Read-Only access to Analytics module** can only view targets
- Users without Analytics access cannot see the targets section at all

### 2. Files Modified

#### `src/pages/TargetsOverview.tsx`
- Changed from `isAdmin` check to `hasWriteAccess` check
- `hasWriteAccess = accessLevel === 'read-write'`
- Updated all conditional rendering:
  - Create target buttons (Sales, Inventory, Finance)
  - Quick links section
  - Empty state messages
  - Header description text
  - All target cards now use `hasWriteAccess` prop

#### `src/pages/Analytics.tsx`
- Added `hasWriteAccess` check based on `accessLevel` prop
- "Admin & Targets" tile now only visible to users with R/W access to Analytics
- Used conditional array spread to include/exclude the tile: `...(hasWriteAccess ? [adminSection] : [])`
- Fixed metrics to include `sublabel` property for consistency

### 3. Access Control Matrix

| User Type | Analytics Access | Can View Targets? | Can Create/Edit/Delete Targets? | Sees "Admin & Targets" Tile? |
|-----------|-----------------|-------------------|--------------------------------|------------------------------|
| Admin | R/W (automatic) | ✅ Yes | ✅ Yes | ✅ Yes |
| User with Analytics R/W | Read-Write | ✅ Yes | ✅ Yes | ✅ Yes |
| User with Analytics R/O | Read-Only | ✅ Yes | ❌ No | ❌ No |
| User without Analytics | No Access | ❌ No | ❌ No | ❌ No |

### 4. User Experience

**For users with R/W access to Analytics:**
- See "Admin & Targets" tile on Analytics page
- Can navigate to `/analytics/targets`
- Can create new targets for all three categories (Sales, Inventory, Finance)
- Can edit existing targets
- Can delete targets
- Can change target status (active/completed/cancelled)
- See "Create [Type] Target" buttons
- See "Manage Targets" buttons on individual analytics pages

**For users with R/O access to Analytics:**
- Do NOT see "Admin & Targets" tile on Analytics page
- Cannot navigate to `/analytics/targets` (unless they have the direct URL)
- If they access the page directly, they see all targets but:
  - No "Create Target" buttons
  - No "Edit" buttons on target cards
  - No "Delete" buttons on target cards
  - No "Complete" or "Cancel" buttons
  - See "View-only access • Contact admin to modify targets" message on cards
- See targets on individual analytics pages (Sales, Inventory, Finance) but cannot modify them

### 5. Database/RLS Policies

No database changes were required. The existing RLS policies on `analytics_targets` table already handle access control properly:
- Users can read targets if they have Analytics module access
- Users can write targets if they have appropriate permissions (checked at application level)

### 6. Benefits

1. **Flexibility**: Admins can delegate target management to specific users without making them full admins
2. **Security**: Maintains proper access control through the existing module access system
3. **Consistency**: Uses the same access control pattern as other modules
4. **Scalability**: Easy to add more users with target management capabilities
5. **Audit Trail**: All target changes are still tracked with `created_by` and `updated_by` fields

## Testing Checklist

- [ ] Admin user can see "Admin & Targets" tile
- [ ] Admin user can create/edit/delete targets
- [ ] Non-admin user with Analytics R/W can see "Admin & Targets" tile
- [ ] Non-admin user with Analytics R/W can create/edit/delete targets
- [ ] User with Analytics R/O cannot see "Admin & Targets" tile
- [ ] User with Analytics R/O can view targets but not modify them
- [ ] User without Analytics access cannot see targets at all
- [ ] Target cards show correct buttons based on access level
- [ ] Individual analytics pages (Sales, Inventory, Finance) respect access levels

## Related Documentation

- [Module Access Management](./MODULE-ACCESS-MANAGEMENT-PAGE.md)
- [Module Access Control](./MODULE-ACCESS.md)
- [Sales Targets Feature](./SALES-TARGETS-FEATURE.md)
- [Inventory Targets Feature](./INVENTORY-TARGETS-FEATURE.md)
- [Finance Targets Feature](./FINANCE-TARGETS-FEATURE.md)
