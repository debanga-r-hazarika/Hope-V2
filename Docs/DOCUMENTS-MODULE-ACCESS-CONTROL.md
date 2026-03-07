# Documents Module Access Control

## Overview
The Documents module implements a **two-level access control system**:
1. **Module-level access** (managed via Module Access Management page)
2. **Folder-level access** (managed within the Documents module)

This provides fine-grained control over who can see and manage documents.

## Two-Level Access System

### Level 1: Module Access (Primary Gate)
Controlled through: **Admin → Module Access Management**

**Access Levels:**
- **No Access**: User cannot see the Documents module at all
- **Read-Only**: User can view folders they have access to, but cannot:
  - Create new folders
  - Upload documents
  - Delete documents
  - Manage folder access
- **Read & Write**: User can:
  - Create new folders
  - Manage folder-level access for any folder
  - Upload/delete documents (if they have folder-level write access)
  - Delete folders

**Important Notes:**
- Module-level access is the **first gate** - users must have at least Read-Only module access to see the Documents module
- Module Read & Write access is required to:
  - Create new folders
  - Manage folder access permissions
  - Delete folders
- Even with Module Read & Write, users still need folder-level access to view/manage documents within specific folders

### Level 2: Folder Access (Granular Control)
Controlled through: **Documents Module → Folder → Manage Access button**

**Access Levels:**
- **No Access**: Folder is completely hidden from the user
- **Read-Only**: User can:
  - View the folder
  - See documents inside
  - Download documents
  - Cannot upload or delete documents
- **Read & Write**: User can:
  - View the folder
  - See documents inside
  - Download documents
  - Upload new documents
  - Delete documents
- **Admin**: Automatic access level for users with Module Read & Write access

**Important Notes:**
- Folder-level access is managed per-user, per-folder
- Only users with Module Read & Write can manage folder access
- Users only see folders they have access to (no-access folders are filtered out)
- Folder access is stored in `folder_user_access` table

## Access Matrix

| Module Access | Folder Access | Can See Module? | Can See Folder? | Can View Docs? | Can Upload? | Can Delete Docs? | Can Create Folders? | Can Manage Folder Access? |
|---------------|---------------|-----------------|-----------------|----------------|-------------|------------------|---------------------|---------------------------|
| No Access     | Any           | ❌              | ❌              | ❌             | ❌          | ❌               | ❌                  | ❌                        |
| Read-Only     | No Access     | ✅              | ❌              | ❌             | ❌          | ❌               | ❌                  | ❌                        |
| Read-Only     | Read-Only     | ✅              | ✅              | ✅             | ❌          | ❌               | ❌                  | ❌                        |
| Read-Only     | Read-Write    | ✅              | ✅              | ✅             | ✅          | ✅               | ❌                  | ❌                        |
| Read & Write  | No Access     | ✅              | ❌              | ❌             | ❌          | ❌               | ✅                  | ✅                        |
| Read & Write  | Read-Only     | ✅              | ✅              | ✅             | ❌          | ❌               | ✅                  | ✅                        |
| Read & Write  | Read-Write    | ✅              | ✅              | ✅             | ✅          | ✅               | ✅                  | ✅                        |
| Admin (R/W)   | Any           | ✅              | ✅              | ✅             | ✅          | ✅               | ✅                  | ✅                        |

## Implementation Details

### Database Schema

**Tables:**
1. `document_folders` - Stores folder information
2. `folder_user_access` - Stores per-user, per-folder access levels
3. `documents` - Stores document metadata (all documents must belong to a folder)

**RPC Function:**
- `get_user_folder_access(p_folder_id, p_auth_user_id)` - Returns user's effective access level for a folder

### Access Resolution Logic

```typescript
// Step 1: Check module-level access
if (moduleAccess === 'no-access') {
  // User cannot see Documents module at all
  return 'no-access';
}

// Step 2: Check if user has module write access (admin-like)
const hasModuleWriteAccess = moduleAccess === 'read-write';

// Step 3: For each folder, determine user's access
const folderAccess = await getFolderAccess(folderId, userId);

// Step 4: Determine effective permissions
if (hasModuleWriteAccess) {
  // Module R/W users have admin access to all folders
  effectiveFolderAccess = 'admin';
} else {
  // Module R/O users get their assigned folder access
  effectiveFolderAccess = folderAccess; // 'read-only', 'read-write', or 'no-access'
}
```

### UI Behavior

**Module-Level Controls:**
- "New Folder" button: Only visible if `hasModuleWriteAccess === true`
- "Manage Access" button on folders: Only visible if `hasModuleWriteAccess === true`
- "Delete Folder" button: Only visible if `hasModuleWriteAccess === true`

**Folder-Level Controls:**
- "Upload File" button: Only visible if `currentFolderWriteAccess === true`
- "Delete Document" button: Only visible if `currentFolderWriteAccess === true`
- Folder visibility: Only folders where `userAccessLevel !== 'no-access'` are shown

### Code References

**Key Files:**
- `src/pages/Documents.tsx` - Main Documents page with access checks
- `src/components/FolderAccessModal.tsx` - Folder access management UI
- `src/lib/documents.ts` - Document and folder operations
- `src/types/documents.ts` - Type definitions

**Key Variables:**
```typescript
// Module-level
const hasModuleWriteAccess = accessLevel === 'read-write' || accessLevel === 'admin';

// Folder-level
const currentFolderWriteAccess = selectedFolder
  ? (selectedFolder.userAccessLevel === 'read-write' || selectedFolder.userAccessLevel === 'admin')
  : false;
```

## Common Scenarios

### Scenario 1: Department-Specific Documents
**Setup:**
- Give all employees Module Read-Only access
- Create folders for each department (HR, Finance, Engineering)
- Assign folder-level Read-Only access to department members
- Assign folder-level Read & Write access to department managers

**Result:**
- Employees can only see their department's folder
- Employees can view but not modify documents
- Managers can upload and manage documents in their department

### Scenario 2: Project Collaboration
**Setup:**
- Give project team Module Read-Only access
- Create project folder
- Assign folder-level Read & Write access to all team members

**Result:**
- Team members can collaborate on documents
- Team members cannot create new folders or manage access
- Admin retains control over folder structure

### Scenario 3: Executive Access
**Setup:**
- Give executives Module Read & Write access
- No need to assign folder-level access

**Result:**
- Executives automatically have admin access to all folders
- Can create folders, manage access, and view all documents

## Best Practices

1. **Start with Module Read-Only**: Give most users Module Read-Only access, then grant folder-level access as needed

2. **Use Folder-Level Access for Granularity**: Don't give everyone Module Read & Write - use folder-level access for fine-grained control

3. **Admin Users**: Remember that admin users (role='admin') automatically have Module Read & Write access to all modules, including Documents

4. **Folder Organization**: Create a clear folder structure before assigning access - reorganizing later requires updating all access permissions

5. **Regular Audits**: Periodically review folder access to ensure users have appropriate permissions

## Troubleshooting

**User can't see Documents module:**
- Check Module Access Management - user needs at least Read-Only access

**User can see Documents but no folders:**
- User has Module access but no folder-level access
- Assign folder access through "Manage Access" button

**User can see folder but can't upload:**
- User has folder Read-Only access
- Change to Read & Write access or give user Module Read & Write access

**User can't create folders:**
- User needs Module Read & Write access
- Module Read-Only users cannot create folders regardless of folder-level access

**User can't manage folder access:**
- User needs Module Read & Write access
- Only Module R/W users can manage folder access permissions

## Migration Notes

If upgrading from a simpler access system:
1. Ensure all existing users have appropriate Module-level access
2. Migrate existing folder permissions to `folder_user_access` table
3. Test access levels thoroughly before deploying
4. Communicate the two-level system to users
