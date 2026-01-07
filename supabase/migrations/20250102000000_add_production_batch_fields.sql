-- Add new fields to production_batches table
-- These fields are needed for the enhanced production workflow

ALTER TABLE production_batches
ADD COLUMN IF NOT EXISTS qa_reason text,
ADD COLUMN IF NOT EXISTS production_start_date date,
ADD COLUMN IF NOT EXISTS production_end_date date,
ADD COLUMN IF NOT EXISTS additional_information text,
ADD COLUMN IF NOT EXISTS custom_fields text;

-- Add comments for documentation
COMMENT ON COLUMN production_batches.qa_reason IS 'Reason provided when QA status is set to hold or rejected';
COMMENT ON COLUMN production_batches.production_start_date IS 'Date when production of this batch started';
COMMENT ON COLUMN production_batches.production_end_date IS 'Date when production of this batch ended';
COMMENT ON COLUMN production_batches.additional_information IS 'Additional information about the production batch';
COMMENT ON COLUMN production_batches.custom_fields IS 'JSON string storing key-value pairs for custom fields (e.g., temperature, pH, TDS)';

