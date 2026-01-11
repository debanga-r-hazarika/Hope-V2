-- Add missing columns to processed_goods table to store output details
-- These columns will store data from batch outputs when batches are locked

ALTER TABLE processed_goods
ADD COLUMN IF NOT EXISTS output_size numeric,
ADD COLUMN IF NOT EXISTS output_size_unit text,
ADD COLUMN IF NOT EXISTS additional_information text,
ADD COLUMN IF NOT EXISTS custom_fields text; -- JSON string for custom fields

-- Add comments for documentation
COMMENT ON COLUMN processed_goods.output_size IS 'Size of the output product (e.g., 250, 500) from batch output';
COMMENT ON COLUMN processed_goods.output_size_unit IS 'Unit for output size (e.g., ml, g) from batch output';
COMMENT ON COLUMN processed_goods.additional_information IS 'Additional information about the processed good from the batch';
COMMENT ON COLUMN processed_goods.custom_fields IS 'JSON string storing key-value pairs for custom fields (e.g., temperature, pH, TDS) from the batch';
