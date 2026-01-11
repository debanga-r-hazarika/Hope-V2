/*
  # Add Responsible User and Documents to Machines
  
  1. Add responsible_user_id field to machines table
  2. Create machine_documents table for storing PDFs and files related to machines
*/

-- Add responsible_user_id to machines table
ALTER TABLE machines 
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid;

ALTER TABLE machines
  ADD CONSTRAINT machines_responsible_user_id_fkey 
  FOREIGN KEY (responsible_user_id) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

-- Create index for responsible_user_id
CREATE INDEX IF NOT EXISTS idx_machines_responsible_user ON machines(responsible_user_id);

-- Create machine_documents table
CREATE TABLE IF NOT EXISTS machine_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL,
  name text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  file_url text,
  file_path text NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraints with explicit names
ALTER TABLE machine_documents
  ADD CONSTRAINT machine_documents_machine_id_fkey 
  FOREIGN KEY (machine_id) 
  REFERENCES machines(id) 
  ON DELETE CASCADE;

ALTER TABLE machine_documents
  ADD CONSTRAINT machine_documents_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

-- Create indexes for machine_documents
CREATE INDEX IF NOT EXISTS idx_machine_documents_machine ON machine_documents(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_documents_uploaded_at ON machine_documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_machine_documents_name ON machine_documents USING gin (to_tsvector('english', coalesce(name, '')));

-- Enable RLS on machine_documents
ALTER TABLE machine_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for machine_documents
CREATE POLICY "Users with operations access can view machine documents"
  ON machine_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert machine documents"
  ON machine_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can update machine documents"
  ON machine_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can delete machine documents"
  ON machine_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- Ensure storage bucket exists for machine documents (reuse documents bucket or create machine-documents bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('machine-documents', 'machine-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Refresh PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
