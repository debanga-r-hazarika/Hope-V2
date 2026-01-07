-- Enable RLS on documents and add basic policies for authenticated users
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'documents_select_authenticated'
  ) THEN
    CREATE POLICY "documents_select_authenticated"
    ON documents
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'documents_insert_authenticated'
  ) THEN
    CREATE POLICY "documents_insert_authenticated"
    ON documents
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'documents_delete_authenticated'
  ) THEN
    CREATE POLICY "documents_delete_authenticated"
    ON documents
    FOR DELETE
    TO authenticated
    USING (true);
  END IF;
END
$$;

-- Storage bucket policies for documents bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_bucket_read_public'
  ) THEN
    CREATE POLICY "documents_bucket_read_public"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_bucket_insert_authenticated'
  ) THEN
    CREATE POLICY "documents_bucket_insert_authenticated"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_bucket_delete_authenticated'
  ) THEN
    CREATE POLICY "documents_bucket_delete_authenticated"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'documents');
  END IF;
END
$$;

-- Refresh PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');


