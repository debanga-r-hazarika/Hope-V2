/*
  # Configure Transport Document Bucket
  
  Updates the existing 'Transport Document' bucket with proper configuration
  and RLS policies for delivery documents in the Sales module.
*/

-- Update the Transport Document bucket configuration
UPDATE storage.buckets 
SET 
  file_size_limit = 10485760, -- 10MB limit
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'Transport Document';

-- Drop old policies if they exist
DROP POLICY IF EXISTS "delivery_documents_read" ON storage.objects;
DROP POLICY IF EXISTS "delivery_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "delivery_documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "transport_documents_read" ON storage.objects;
DROP POLICY IF EXISTS "transport_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "transport_documents_delete" ON storage.objects;

-- Allow authenticated users with sales access to read transport documents
CREATE POLICY "transport_documents_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'Transport Document'
  AND (
    -- Users with sales module access can view
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'sales'
      AND uma.access_level IN ('read-only', 'read-write')
    )
    OR
    -- Admins can view
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
);

-- Allow authenticated users with read-write access to upload transport documents
CREATE POLICY "transport_documents_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Transport Document'
  AND (
    -- Users with read-write sales access can upload
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'sales'
      AND uma.access_level = 'read-write'
    )
    OR
    -- Admins can upload
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
);

-- Allow authenticated users with read-write access to delete transport documents
CREATE POLICY "transport_documents_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'Transport Document'
  AND (
    -- Users with read-write sales access can delete
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'sales'
      AND uma.access_level = 'read-write'
    )
    OR
    -- Admins can delete
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
);
