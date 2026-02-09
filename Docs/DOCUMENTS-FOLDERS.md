# Documents Module - Folder-Based Access Control

## Overview
The Documents module uses a folder-based access control system where:
- **Module-level access (R/W)**: Allows managing folders and assigning users to folders
- **Folder-level access**: Controls what users can do inside specific folders
- **All documents must be inside folders** (no root-level documents allowed)

## Access Control Model

### Module-Level Access (R/W)
Users with Read & Write access to the Documents module can:
- Create new folders
- Delete folders (and all their contents)
- Assign users to folders with specific access levels
- Remove users from folders
- View all folders and documents

### Folder-Level Access
Each user can be assigned one of three access levels per folder:

1. **Read & Write (R/W)**
   - View all documents in the folder
   - Upload new documents to the folder
   - Delete documents from the folder

2. **Read Only**
   - View all documents in the folder
   - Download/open documents
   - Cannot upload or delete documents

3. **No Access**
   - Cannot see the folder at all
   - Folder is completely hidden from the user

## Example Scenario

**Folder: "Testing"**

- **User A** (Module R/W): Can manage the folder, assign users, and has full R/W access to documents
- **User B** (Folder R/W): Can add and delete files inside the folder
- **User C** (Folder Read Only): Can only view files added by others
- **User D** (No Access): Cannot see the "Testing" folder at all

## Database Schema

### Tables

1. **document_folders**
   - `id`: UUID primary key
   - `name`: Folder name
   - `description`: Optional folder description
   - `created_by`: User who created the folder
   - `created_at`: Creation timestamp
   - `updated_at`: Last update timestamp

2. **folder_user_access**
   - `id`: UUID primary key
   - `folder_id`: Reference to folder
   - `user_id`: Reference to user
   - `access_level`: 'read-only', 'read-write', or 'no-access'
   - `assigned_by`: User who assigned the access
   - `assigned_at`: Assignment timestamp
   - Unique constraint on (folder_id, user_id)

3. **documents**
   - `id`: UUID primary key
   - `name`: Document name
   - `file_name`: Original file name
   - `file_type`: MIME type
   - `file_size`: Size in bytes
   - `file_url`: Public URL
   - `file_path`: Storage path
   - `folder_id`: Reference to folder (REQUIRED - NOT NULL)
   - `uploaded_by`: User who uploaded
   - `uploaded_at`: Upload timestamp

### RLS Policies

**document_folders**:
- SELECT: Module R/W can see all; users see folders they have access to (not no-access)
- INSERT/UPDATE/DELETE: Module R/W only

**folder_user_access**:
- SELECT: Module R/W can see all; users see their own assignments
- INSERT/UPDATE/DELETE: Module R/W only

**documents**:
- SELECT: Module R/W can see all; users see documents in folders they have access to
- INSERT: Module R/W or folder R/W access
- UPDATE/DELETE: Module R/W or folder R/W access

## API Functions

### Folder Management (Module R/W only)

```typescript
// Fetch all folders user has access to
fetchFolders(): Promise<FolderWithAccess[]>

// Create a new folder
createFolder(name: string, description: string | null, userId: string): Promise<DocumentFolder>

// Update folder details
updateFolder(id: string, name: string, description: string | null): Promise<void>

// Delete folder and all contents
deleteFolder(id: string): Promise<void>
```

### Folder Access Management (Module R/W only)

```typescript
// Get all users assigned to a folder
fetchFolderUsers(folderId: string): Promise<FolderUserAccess[]>

// Assign or update user access to a folder
assignFolderAccess(
  folderId: string,
  userId: string,
  accessLevel: 'read-only' | 'read-write' | 'no-access',
  assignedBy: string
): Promise<FolderUserAccess>

// Remove user access from a folder
removeFolderAccess(accessId: string): Promise<void>

// Get user's access level for a specific folder
getUserFolderAccess(folderId: string, userId: string): Promise<string>
```

### Document Management (Folder-level access)

```typescript
// Fetch documents in a specific folder
fetchDocuments(folderId: string): Promise<DocumentRecord[]>

// Upload document to a folder (requires folder R/W access)
uploadDocument(
  file: File,
  name: string,
  userId: string,
  folderId: string
): Promise<DocumentRecord>

// Delete document (requires folder R/W access)
deleteDocument(id: string, filePath: string): Promise<void>
```

## UI Components

### Folders View
- List of all folders user has access to
- Shows folder name, description, document count, and user's access level
- "New Folder" button (Module R/W only)
- "Manage Access" button per folder (Module R/W only)
- "Delete" button per folder (Module R/W only)
- Click folder to view its documents

### Documents View
- Shows documents in selected folder
- "Back to Folders" button
- Upload form (visible only with folder R/W access)
- Document list with Open and Delete buttons
- Delete button only visible with folder R/W access

### Folder Access Modal
- Assign users to folder with specific access levels
- View current user assignments
- Remove user access
- Only accessible by users with Module R/W access

## Migration

Run the migration to set up the folder-based access control:

```bash
supabase migration up 20260209190000_documents_folder_access_control
```

This will:
- Drop and recreate tables with proper structure
- Create folder_user_access table
- Set up all RLS policies
- Create helper functions

**Note**: This migration drops existing data. Back up any important documents before running.

## Usage Workflow

### For Module Administrators (R/W Access)

1. **Create a folder**:
   - Click "New Folder"
   - Enter name and optional description
   - Click "Create Folder"

2. **Assign users to folder**:
   - Click "Manage Access" on a folder
   - Select user from dropdown
   - Choose access level (Read Only or Read & Write)
   - Click "Assign"

3. **Remove user access**:
   - Click "Manage Access" on a folder
   - Click "Remove" next to user's name

4. **Delete folder**:
   - Click "Delete" on a folder
   - Confirm deletion (all documents will be deleted)

### For Regular Users

1. **View folders**:
   - See only folders you have access to
   - Folders with "No Access" are completely hidden

2. **View documents** (Read Only or R/W):
   - Click on a folder to view its documents
   - Click "Open" to view/download a document

3. **Upload documents** (R/W only):
   - Navigate into a folder
   - Fill in document name
   - Select file
   - Click "Upload Document"

4. **Delete documents** (R/W only):
   - Click "Delete" next to a document
   - Confirm deletion

## Security Features

- Row-Level Security (RLS) enforced on all tables
- Users can only see folders they have access to
- Folder access is checked at database level
- Module R/W access is verified through user_module_access table
- Cascade deletion ensures no orphaned records
- Storage files are deleted when documents are removed

## Best Practices

1. **Organize by purpose**: Create folders for different document types (Contracts, Reports, etc.)
2. **Minimal access**: Only grant access to users who need it
3. **Use Read Only**: Default to Read Only access unless users need to upload/delete
4. **Regular audits**: Periodically review folder access assignments
5. **Descriptive names**: Use clear folder names and descriptions
6. **Module R/W sparingly**: Only grant Module R/W to administrators who need to manage folders
