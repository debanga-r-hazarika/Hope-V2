-- Create production_documents table
CREATE TABLE IF NOT EXISTS production_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_name TEXT NOT NULL,
  description TEXT,
  author_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  file_url TEXT,
  file_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE production_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for production_documents
CREATE POLICY "Allow authenticated users to read production documents"
  ON production_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert production documents"
  ON production_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update production documents"
  ON production_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete production documents"
  ON production_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for production documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('production-documents', 'production-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for production-documents bucket
CREATE POLICY "Allow authenticated users to upload production documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'production-documents');

CREATE POLICY "Allow authenticated users to read production documents from storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'production-documents');

CREATE POLICY "Allow authenticated users to update production documents in storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'production-documents')
  WITH CHECK (bucket_id = 'production-documents');

CREATE POLICY "Allow authenticated users to delete production documents from storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'production-documents');

-- Allow public access to production documents (for download)
CREATE POLICY "Allow public read access to production documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'production-documents');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_production_documents_uploaded_at ON production_documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_documents_document_name ON production_documents(document_name);
