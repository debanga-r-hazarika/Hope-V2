/*
  # Create Delivery Documents Storage Bucket
  
  Creates a storage bucket for third-party delivery documents (slips, photos, etc.)
  with appropriate RLS policies.
*/

-- Create the delivery-documents bucket (public for easy access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-documents',
  'delivery-documents',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- RLS Policies for delivery-documents bucket

-- Allow authenticated users with sales access to read delivery documents
DROP POLICY IF EXISTS "delivery_documents_read" ON storage.objects;
CREATE POLICY "delivery_documents_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-documents'
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

-- Allow authenticated users with read-write access to upload delivery documents
DROP POLICY IF EXISTS "delivery_documents_insert" ON storage.objects;
CREATE POLICY "delivery_documents_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-documents'
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

-- Allow authenticated users with read-write access to delete delivery documents
DROP POLICY IF EXISTS "delivery_documents_delete" ON storage.objects;
CREATE POLICY "delivery_documents_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-documents'
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

-- Add comment
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads';
