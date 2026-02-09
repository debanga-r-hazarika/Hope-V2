-- Add folder structure to documents module

-- Create document_folders table
CREATE TABLE IF NOT EXISTS document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_folder_id uuid REFERENCES document_folders(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for folder queries
CREATE INDEX IF NOT EXISTS idx_document_folders_parent ON document_folders (parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_name ON document_folders (name);

-- Add folder_id to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;

-- Add index for folder_id
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents (folder_id);

-- Enable RLS on document_folders
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_folders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'document_folders' AND policyname = 'document_folders_select_authenticated'
  ) THEN
    CREATE POLICY "document_folders_select_authenticated"
    ON document_folders
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'document_folders' AND policyname = 'document_folders_insert_authenticated'
  ) THEN
    CREATE POLICY "document_folders_insert_authenticated"
    ON document_folders
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'document_folders' AND policyname = 'document_folders_update_authenticated'
  ) THEN
    CREATE POLICY "document_folders_update_authenticated"
    ON document_folders
    FOR UPDATE
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'document_folders' AND policyname = 'document_folders_delete_authenticated'
  ) THEN
    CREATE POLICY "document_folders_delete_authenticated"
    ON document_folders
    FOR DELETE
    TO authenticated
    USING (true);
  END IF;
END
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_document_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_document_folders_updated_at ON document_folders;
CREATE TRIGGER trigger_update_document_folders_updated_at
  BEFORE UPDATE ON document_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_document_folders_updated_at();

-- Refresh PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
