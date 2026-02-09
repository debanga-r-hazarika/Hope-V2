# Documents Module - Quick Summary

## How It Works

### Two-Level Access Control

1. **Module Level (Documents Module Access)**
   - **Read & Write**: Can create/delete folders and assign users to folders
   - **Read Only**: Can view folders they're assigned to (not useful in practice)
   - **No Access**: Cannot access the module at all

2. **Folder Level (Per-Folder Access)**
   - **Read & Write**: Can upload and delete documents in the folder
   - **Read Only**: Can only view documents in the folder
   - **No Access**: Cannot see the folder at all

### Key Rules

✅ **All documents MUST be inside folders** (no root-level documents)
✅ **Module R/W users** manage the overall system (create folders, assign users)
✅ **Folder-level access** controls what users can do inside each folder
✅ **Users only see folders** they have access to (not "No Access")

## Example Scenario

**Folder: "Testing"**

| User | Module Access | Folder Access | What They Can Do |
|------|--------------|---------------|------------------|
| Admin | R/W | (automatic R/W) | Create/delete folders, assign users, upload/delete files |
| User A | Read Only | R/W | Upload and delete files in "Testing" folder |
| User B | Read Only | Read Only | Only view files in "Testing" folder |
| User C | Read Only | No Access | Cannot see "Testing" folder at all |

## Quick Start

### As Module Administrator (R/W)

1. Create a folder: Click "New Folder" → Enter name → Create
2. Assign users: Click "Manage Access" → Select user → Choose access level → Assign
3. Users can now access the folder based on their assigned level

### As Regular User

1. View folders: See only folders you have access to
2. Open folder: Click on folder to view documents
3. Upload (if R/W): Fill form and upload document
4. View/Download: Click "Open" on any document

## Files Changed

### Database
- `supabase/migrations/20260209190000_documents_folder_access_control.sql` - Complete schema

### Frontend
- `src/types/documents.ts` - Type definitions
- `src/lib/documents.ts` - API functions
- `src/pages/Documents.tsx` - Main UI
- `src/components/FolderAccessModal.tsx` - Access management modal

### Documentation
- `Docs/DOCUMENTS-FOLDERS.md` - Detailed documentation
- `Docs/DOCUMENTS-MODULE-SUMMARY.md` - This file

## Migration Note

⚠️ **Important**: The migration drops existing tables and recreates them. Back up any important documents before running the migration.

```bash
# Run the migration
supabase migration up 20260209190000_documents_folder_access_control
```
