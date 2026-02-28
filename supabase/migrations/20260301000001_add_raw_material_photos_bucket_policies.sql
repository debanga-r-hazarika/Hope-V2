-- RLS Policies for Raw Material Photos bucket

-- Allow authenticated users to upload photos
CREATE POLICY "Allow authenticated users to upload raw material photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Raw Material Photos');

-- Allow authenticated users to read photos
CREATE POLICY "Allow authenticated users to read raw material photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'Raw Material Photos');

-- Allow authenticated users to delete their uploaded photos
CREATE POLICY "Allow authenticated users to delete raw material photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'Raw Material Photos');

-- Allow authenticated users to update photos
CREATE POLICY "Allow authenticated users to update raw material photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'Raw Material Photos')
WITH CHECK (bucket_id = 'Raw Material Photos');
