/*
  # Processed Goods Waste/Damage tracking

  Table to record waste/damage for processed good lots (expired, unsold, damaged).
  Available quantity in UI = quantity_available - total_wasted.
*/

-- Create processed_goods_waste table
CREATE TABLE IF NOT EXISTS processed_goods_waste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_good_id uuid NOT NULL REFERENCES processed_goods(id) ON DELETE CASCADE,
  quantity_wasted numeric NOT NULL CHECK (quantity_wasted > 0),
  unit text NOT NULL,
  reason text NOT NULL,
  notes text,
  waste_type text NOT NULL CHECK (waste_type IN ('recycle', 'full_waste')),
  waste_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_processed_goods_waste_processed_good_id ON processed_goods_waste(processed_good_id);
CREATE INDEX IF NOT EXISTS idx_processed_goods_waste_waste_date ON processed_goods_waste(waste_date DESC);

ALTER TABLE processed_goods_waste ENABLE ROW LEVEL SECURITY;

-- RLS: users with operations (or processed-goods / production) can view and insert
CREATE POLICY "Users with operations access can view processed goods waste"
  ON processed_goods_waste FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-processed-goods', 'operations-production-batches', 'sales')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

CREATE POLICY "Users with operations read-write can insert processed goods waste"
  ON processed_goods_waste FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'operations-processed-goods', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

COMMENT ON TABLE processed_goods_waste IS 'Waste/damage records for processed good lots. Available = quantity_available - SUM(quantity_wasted).';
