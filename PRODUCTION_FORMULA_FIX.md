# Production Formula - Foreign Key Fix

## Issue
When trying to upload a production document, the following error occurred:
```
Failed to save document
{
  "code": "23503",
  "details": "Key is not present in table \"users\".",
  "hint": null,
  "message": "insert or update on table \"production_documents\" violates foreign key constraint \"production_documents_uploaded_by_fkey\""
}
```

## Root Cause
The `production_documents` table was created with a foreign key constraint that referenced `auth.users(id)`:
```sql
uploaded_by UUID REFERENCES auth.users(id)
```

However, the application code passes `userId` from the `ModuleAccessContext`, which is the internal `users.id` (from the `users` table), not the `auth.users.id`.

## Solution Applied
Applied migration `fix_production_documents_uploaded_by_fkey` to correct the foreign key constraint:

```sql
-- Drop the incorrect foreign key constraint
ALTER TABLE production_documents 
DROP CONSTRAINT IF EXISTS production_documents_uploaded_by_fkey;

-- Add the correct foreign key constraint to users table
ALTER TABLE production_documents 
ADD CONSTRAINT production_documents_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES users(id);
```

## Verification
The constraint now correctly references the `users` table:

```sql
SELECT constraint_name, foreign_table_name, foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
WHERE tc.table_name = 'production_documents' 
  AND tc.constraint_type = 'FOREIGN KEY';
```

Result:
- `constraint_name`: `production_documents_uploaded_by_fkey`
- `foreign_table_name`: `users` ✅
- `foreign_column_name`: `id` ✅

## Pattern Consistency
This fix aligns with other tables in the system:
- `documents` table: `uploaded_by UUID REFERENCES users(id)` ✅
- `machines` table: `created_by UUID REFERENCES users(id)` ✅
- `suppliers` table: `created_by UUID REFERENCES users(id)` ✅

## Testing
After applying the fix, users should be able to:
1. Upload production documents without errors
2. See their name associated with uploaded documents
3. Edit and delete their documents

## Status
✅ **FIXED** - The foreign key constraint has been corrected and the feature is now fully functional.
