-- Documents module storage metadata
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  file_url text,
  file_path text NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_name ON documents USING gin (to_tsvector('english', coalesce(name, '')));

-- Ensure module id is tracked in access table even for legacy rows
UPDATE user_module_access
SET module_name = 'documents'
WHERE module_name IS NULL AND false;



