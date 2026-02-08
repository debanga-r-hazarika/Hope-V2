# Module Access Design & Implementation

This document explains how module access is modeled, enforced, and managed in the app so future developers can extend it confidently.

## Goals
- Per-module access with three levels: `read-write`, `read-only`, `no-access`.
- Admins always have `read-write` on all modules automatically.
- Non-admin users default to `no-access` everywhere until granted.
- UIs hide modules that a user cannot even read.
- Data layer tolerates deployments where `user_module_access.access_level` is missing (falls back to legacy `has_access`).

## Data Model
- Table: `user_module_access`
  - `user_id` (uuid, FK users.id)
  - `module_name` (text; see Module IDs below)
  - `has_access` (boolean) — legacy write flag; also used as fallback
  - `access_level` (text, optional) — expected values: `read-write`, `read-only`, `no-access`
  - Unique constraint on `(user_id, module_name)`

### Module IDs
- Defined in `src/types/modules.ts`: `finance`, `inventory`, `sales`, `analytics`, `documents`, `agile`.
- The same list drives UI labels and icons.

### Access Levels
- `read-write`: full CRUD in that module.
- `read-only`: can view; UI disables or hides write actions.
- `no-access`: module not visible in nav/dashboard; API calls should be prevented at higher layers as added later.

### Fallback Behavior (no `access_level` column)
- Reads:
  - First tries `select module_name, access_level, has_access`.
  - If PostgREST returns `PGRST204` (column missing), retries with `select module_name, has_access`.
  - Maps levels as:
    - `read-write` / `read-only` if `access_level` is present.
    - Otherwise `has_access ? read-write : no-access`.
- Writes:
  - Upserts include `access_level`.
  - If Supabase rejects `access_level`, it retries without that column (legacy compatibility).

## Frontend Architecture

### Providers
- `ModuleAccessProvider` (`src/contexts/ModuleAccessContext.tsx`)
  - On auth change, loads the current profile (`users` table) to get `role` and `id`.
  - Admin shortcut: sets all modules to `read-write`.
  - Non-admin: loads `user_module_access` with fallback as described above.
  - Exposes:
    - `access: ModuleAccessMap` keyed by module id.
    - `getAccessLevel(moduleId)`.
    - `loading`, `role`, `userId`, `refresh()`.

### Navigation & Layout
- `AppLayout` consumes `ModuleAccessContext`:
  - Navigation items are filtered so modules with `no-access` are hidden.
  - Finance page guards: if `finance` is `no-access`, navigation is blocked; if already on finance when access drops, it redirects to dashboard.
  - For finance subsections, `hasWriteAccess` is derived from `finance` level === `read-write`; read-only users can view but cannot mutate.
- `Dashboard` shows only modules where access is not `no-access` and displays an empty-state message when none are available.

### Module Access Management (Admin)
- `Users` page and `ModuleAccessModal`:
  - Admin-only entry point via “Module Access” button.
  - When opening for a user:
    - Admin target: pre-fills all modules as `read-write`.
    - Non-admin target: loads from `user_module_access` with fallback, maps to RW/RO/No.
  - Saving:
    - Admin target: forces all modules to `read-write` and upserts (with fallback if needed).
    - Non-admin: upserts rows whose level is not `no-access`; deletes rows set to `no-access`.
    - Error handling: shows error message and leaves dialog open.
- `UserDetail` role change:
  - Promote to admin: upserts all modules as `read-write`.
  - Demote from admin: deletes all `user_module_access` rows for that user (leaves them at `no-access`).

## Admin Behavior
- Admins always:
  - See all modules in nav and dashboard.
  - Have `read-write` access in finance sub-pages.
  - When their role is saved as admin, module rows are auto-upserted to RW.
- Demotion clears module rows so the user has no module access until explicitly granted.

## Default Behavior for Regular Users
- On creation, a user has `role = user` and no module rows; effective access is `no-access` everywhere.
- Admins can grant RO or RW per module via Module Access modal.

## Upgrade Guidance (make `access_level` first-class)
If your database lacks `access_level`, add it to persist RO:
```sql
ALTER TABLE user_module_access
  ADD COLUMN IF NOT EXISTS access_level text
    CHECK (access_level IN ('read-write','read-only','no-access'))
    DEFAULT 'no-access';

UPDATE user_module_access
SET access_level = CASE WHEN has_access THEN 'read-write' ELSE 'no-access' END
WHERE access_level IS NULL;
```
Then refresh the PostgREST schema cache (or wait for automatic refresh).

## Extension Points
- Add more modules: update `src/types/modules.ts` and ensure corresponding UI/permission checks.
- Add server-side authorization: enforce access in RPCs or RLS using the same module ids and levels.
- Tighten UI controls: in finance child pages, all mutating buttons already respect `hasWriteAccess`; apply similar checks in new modules.

## Known Limitations / Next Steps
- Finance data reads are not yet filtered by access in the backend; RO relies on UI gating. Add RLS or RPC enforcement if needed.
- There is no audit trail for access changes; add `granted_by`/`granted_at` usage if required (columns exist in schema example).
- No caching layer; access is fetched on provider mount. Call `refresh()` after server-side changes if you add such flows.

## Testing Checklist
- Admin:
  - Sees all modules in nav and dashboard.
  - Finance pages allow create/edit/delete.
  - Promoting a user to admin grants RW on all modules.
  - Demoting admin clears their module rows (no modules visible until re-granted).
- User with RO finance:
  - Sees Finance in nav and dashboard.
  - Can view finance dashboards and records; create/edit/delete buttons disabled.
- User with no finance access:
  - Finance not visible in nav/dashboard; direct navigation to finance is blocked back to dashboard.
- Legacy schema (no `access_level` column):
  - No errors during fetch/save.
  - `has_access=true` maps to RW, false/absent maps to No Access.



