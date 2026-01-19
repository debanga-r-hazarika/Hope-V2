/*
  # Add Customer Photo Support

  Add photo_url column to customers table for storing customer/shop photos
  This will help identify customers visually and improve customer management
*/

-- Add photo_url column to customers table
ALTER TABLE customers
ADD COLUMN photo_url text;

-- Add index for photo_url (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_customers_photo_url ON customers(photo_url);

-- Comment on the column
COMMENT ON COLUMN customers.photo_url IS 'URL to customer/shop photo stored in Supabase Storage';