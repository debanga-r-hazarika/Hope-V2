-- Safe migration: Add folder structure without dropping existing data
-- This migration adds the folder system while preserving existing documents

-- Step 1: Create document_folders table (flat structure, no nesting)
CREATE TABLE IF NOT EXISTS document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Create folder_user_access table for folder-level permissions
CREATE TABLE IF NOT EXISTS folder_user_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES document_folders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_level text NOT NULL CHECK (access_level IN ('read-only', 'read-write', 'no-access')),
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

-- Step 3: Add folder_id to documents table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'folder_id'
  ) THEN
    -- Add as nullable first
    ALTER TABLE documents ADD COLUMN folder_id uuid REFERENCES document_folders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_document_folders_name ON document_folders (name);
CREATE INDEX IF NOT EXISTS idx_folder_user_access_folder ON folder_user_access (folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_user_access_user ON folder_user_access (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents (folder_id);

-- Step 5: Enable RLS
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_user_access ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if they exist and recreate
DO $$
BEGIN
  -- document_folders policies
  DROP POLICY IF EXISTS "document_folders_select" ON document_folders;
  DROP POLICY IF EXISTS "document_folders_insert" ON document_folders;
  DROP POLICY IF EXISTS "document_folders_update" ON document_folders;
  DROP POLICY IF EXISTS "document_folders_delete" ON document_folders;
  
  -- folder_user_access policies
  DROP POLICY IF EXISTS "folder_user_access_select" ON folder_user_access;
  DROP POLICY IF EXISTS "folder_user_access_insert" ON folder_user_access;
  DROP POLICY IF EXISTS "folder_user_access_update" ON folder_user_access;
  DROP POLICY IF EXISTS "folder_user_access_delete" ON folder_user_access;
  
  -- documents policies (update existing)
  DROP POLICY IF EXISTS "documents_select" ON documents;
  DROP POLICY IF EXISTS "documents_insert" ON documents;
  DROP POLICY IF EXISTS "documents_update" ON documents;
  DROP POLICY IF EXISTS "documents_delete" ON documents;
END $$;

-- Step 7: Create RLS policies for document_folders
CREATE POLICY "document_folders_select"
ON document_folders
FOR SELECT
TO authenticated
USING (
  -- Module R/W access can see all folders
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
  OR
  -- Users can see folders they have access to (not no-access)
  EXISTS (
    SELECT 1 FROM folder_user_access
    WHERE folder_id = document_folders.id
    AND user_id = auth.uid()
    AND access_level != 'no-access'
  )
);

CREATE POLICY "document_folders_insert"
ON document_folders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
);

CREATE POLICY "document_folders_update"
ON document_folders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
);

CREATE POLICY "document_folders_delete"
ON document_folders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
);

-- Step 8: Create RLS policies for folder_user_access
CREATE POLICY "folder_user_access_select"
ON folder_user_access
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
  OR user_id = auth.uid()
);

CREATE POLICY "folder_user_access_insert"
ON folder_user_access
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
);

CREATE POLICY "folder_user_access_update"
ON folder_user_access
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
);

CREATE POLICY "folder_user_access_delete"
ON folder_user_access
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
);

-- Step 9: Update RLS policies for documents
CREATE POLICY "documents_select"
ON documents
FOR SELECT
TO authenticated
USING (
  -- Module R/W can see all documents
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
  OR
  -- Users can see documents in folders they have access to (not no-access)
  -- OR documents without folder_id (legacy documents)
  (
    folder_id IS NULL
    OR
    EXISTS (
      SELECT 1 FROM folder_user_access
      WHERE folder_id = documents.folder_id
      AND user_id = auth.uid()
      AND access_level != 'no-access'
    )
  )
);

CREATE POLICY "documents_insert"
ON documents
FOR INSERT
TO authenticated
WITH CHECK (
  -- Module R/W can upload anywhere
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
  OR
  -- Users with folder R/W access can upload
  (
    folder_id IS NOT NULL
    AND
    EXISTS (
      SELECT 1 FROM folder_user_access
      WHERE folder_id = documents.folder_id
      AND user_id = auth.uid()
      AND access_level = 'read-write'
    )
  )
);

CREATE POLICY "documents_update"
ON documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
  OR
  (
    folder_id IS NOT NULL
    AND
    EXISTS (
      SELECT 1 FROM folder_user_access
      WHERE folder_id = documents.folder_id
      AND user_id = auth.uid()
      AND access_level = 'read-write'
    )
  )
);

CREATE POLICY "documents_delete"
ON documents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = auth.uid()
    AND module_name = 'documents'
    AND access_level = 'read-write'
  )
  OR
  (
    folder_id IS NOT NULL
    AND
    EXISTS (
      SELECT 1 FROM folder_user_access
      WHERE folder_id = documents.folder_id
      AND user_id = auth.uid()
      AND access_level = 'read-write'
    )
  )
);

-- Step 10: Create helper functions
CREATE OR REPLACE FUNCTION update_document_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_document_folders_updated_at ON document_folders;
CREATE TRIGGER trigger_update_document_folders_updated_at
  BEFORE UPDATE ON document_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_document_folders_updated_at();

-- Helper function to get user's folder access level
CREATE OR REPLACE FUNCTION get_user_folder_access(p_folder_id uuid, p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_access_level text;
BEGIN
  -- Check if user has module R/W access
  IF EXISTS (
    SELECT 1 FROM user_module_access
    WHERE user_id = p_user_id
    AND module_name = 'documents'
    AND access_level = 'read-write'
  ) THEN
    RETURN 'read-write';
  END IF;
  
  -- Check folder-level access
  SELECT access_level INTO v_access_level
  FROM folder_user_access
  WHERE folder_id = p_folder_id
  AND user_id = p_user_id;
  
  RETURN COALESCE(v_access_level, 'no-access');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
