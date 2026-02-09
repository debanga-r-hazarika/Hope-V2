-- Complete redesign: Documents with folder-level access control
-- Drop existing tables and recreate with proper structure

-- Drop existing tables
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS document_folders CASCADE;

-- Create document_folders table (no parent_folder_id - flat structure)
CREATE TABLE document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create folder_user_access table for folder-level permissions
CREATE TABLE folder_user_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES document_folders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_level text NOT NULL CHECK (access_level IN ('read-only', 'read-write', 'no-access')),
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

-- Create documents table (must have folder_id - no root documents)
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  file_url text,
  file_path text NOT NULL,
  folder_id uuid NOT NULL REFERENCES document_folders(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_document_folders_name ON document_folders (name);
CREATE INDEX idx_folder_user_access_folder ON folder_user_access (folder_id);
CREATE INDEX idx_folder_user_access_user ON folder_user_access (user_id);
CREATE INDEX idx_documents_folder_id ON documents (folder_id);
CREATE INDEX idx_documents_uploaded_at ON documents (uploaded_at DESC);
CREATE INDEX idx_documents_name ON documents USING gin (to_tsvector('english', coalesce(name, '')));

-- Enable RLS
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_folders
-- Users with R/W module access can see all folders
-- Users with folder access can see their assigned folders
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

-- Only module R/W can create folders
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

-- Only module R/W can update folders
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

-- Only module R/W can delete folders
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

-- RLS Policies for folder_user_access
-- Module R/W can see all access assignments
-- Users can see their own access assignments
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

-- Only module R/W can assign folder access
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

-- Only module R/W can update folder access
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

-- Only module R/W can delete folder access
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

-- RLS Policies for documents
-- Users can see documents in folders they have access to
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
  EXISTS (
    SELECT 1 FROM folder_user_access
    WHERE folder_id = documents.folder_id
    AND user_id = auth.uid()
    AND access_level != 'no-access'
  )
);

-- Users with folder R/W access can upload documents
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
  EXISTS (
    SELECT 1 FROM folder_user_access
    WHERE folder_id = documents.folder_id
    AND user_id = auth.uid()
    AND access_level = 'read-write'
  )
);

-- Users with folder R/W access can update documents
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
  EXISTS (
    SELECT 1 FROM folder_user_access
    WHERE folder_id = documents.folder_id
    AND user_id = auth.uid()
    AND access_level = 'read-write'
  )
);

-- Users with folder R/W access can delete documents
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
  EXISTS (
    SELECT 1 FROM folder_user_access
    WHERE folder_id = documents.folder_id
    AND user_id = auth.uid()
    AND access_level = 'read-write'
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_document_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
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
SELECT pg_notify('pgrst', 'reload schema');
