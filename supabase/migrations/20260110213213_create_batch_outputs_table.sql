-- Create batch_outputs table to support multiple outputs per production batch
-- This replaces the single output fields in production_batches table
CREATE TABLE IF NOT EXISTS batch_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  output_name text NOT NULL,
  output_size numeric,
  output_size_unit text,
  produced_quantity numeric NOT NULL CHECK (produced_quantity > 0),
  produced_unit text NOT NULL,
  produced_goods_tag_id uuid NOT NULL REFERENCES produced_goods_tags(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient batch lookups
CREATE INDEX IF NOT EXISTS idx_batch_outputs_batch_id ON batch_outputs(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_outputs_tag_id ON batch_outputs(produced_goods_tag_id);

-- Enable RLS
ALTER TABLE batch_outputs ENABLE ROW LEVEL SECURITY;

-- Policies for batch_outputs
CREATE POLICY "Users with operations access can view batch outputs"
  ON batch_outputs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert batch outputs"
  ON batch_outputs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    -- Only allow inserting outputs for unlocked batches
    AND EXISTS (
      SELECT 1 FROM production_batches pb
      WHERE pb.id = batch_id
      AND pb.is_locked = false
    )
  );

CREATE POLICY "Users with read-write access can update batch outputs"
  ON batch_outputs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    -- Only allow updating outputs for unlocked batches
    AND EXISTS (
      SELECT 1 FROM production_batches pb
      WHERE pb.id = batch_outputs.batch_id
      AND pb.is_locked = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    -- Only allow updating outputs for unlocked batches
    AND EXISTS (
      SELECT 1 FROM production_batches pb
      WHERE pb.id = batch_id
      AND pb.is_locked = false
    )
  );

CREATE POLICY "Users with read-write access can delete batch outputs"
  ON batch_outputs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    -- Only allow deleting outputs for unlocked batches
    AND EXISTS (
      SELECT 1 FROM production_batches pb
      WHERE pb.id = batch_outputs.batch_id
      AND pb.is_locked = false
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_batch_outputs_updated_at
  BEFORE UPDATE ON batch_outputs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE batch_outputs IS 'Stores multiple outputs per production batch. Each output represents a separate sellable product with its own tag, quantity, and size.';
COMMENT ON COLUMN batch_outputs.output_name IS 'Name of the output product (e.g., Banana Alkyl Liquid)';
COMMENT ON COLUMN batch_outputs.output_size IS 'Size of the output product (e.g., 250, 500)';
COMMENT ON COLUMN batch_outputs.output_size_unit IS 'Unit for output size (e.g., ml, g)';
COMMENT ON COLUMN batch_outputs.produced_quantity IS 'Quantity produced for this output (e.g., 150 bottles, 80 pouches)';
COMMENT ON COLUMN batch_outputs.produced_unit IS 'Unit for produced quantity (e.g., bottles, pouches)';
COMMENT ON COLUMN batch_outputs.produced_goods_tag_id IS 'Mandatory tag assigned to this output (from produced_goods_tags)';
