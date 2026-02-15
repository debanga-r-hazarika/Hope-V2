-- Add is_archived column to processed_goods table
-- This column indicates if the processed good has been archived (quantity <= 5 and fully utilized)

ALTER TABLE processed_goods 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN processed_goods.is_archived IS 'Indicates if the processed good has been archived (quantity <= 5 and fully utilized)';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_processed_goods_is_archived 
ON processed_goods(is_archived) 
WHERE is_archived = true;
