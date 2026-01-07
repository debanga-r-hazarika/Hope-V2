-- Documents module: table and indexes
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

-- Ensure storage bucket exists (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Refresh PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');


