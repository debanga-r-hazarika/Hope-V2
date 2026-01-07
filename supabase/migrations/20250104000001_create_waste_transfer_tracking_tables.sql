-- Create waste_tracking and transfer_tracking tables with RLS policies
-- These tables track waste and transfer operations for accountability

-- Create waste_tracking table
CREATE TABLE IF NOT EXISTS waste_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_type text NOT NULL CHECK (lot_type IN ('raw_material', 'recurring_product')),
  lot_id uuid NOT NULL,
  lot_identifier text NOT NULL,
  quantity_wasted numeric NOT NULL CHECK (quantity_wasted > 0),
  unit text NOT NULL,
  reason text NOT NULL,
  notes text,
  waste_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create transfer_tracking table
CREATE TABLE IF NOT EXISTS transfer_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_type text NOT NULL CHECK (lot_type IN ('raw_material', 'recurring_product')),
  from_lot_id uuid NOT NULL,
  from_lot_identifier text NOT NULL,
  to_lot_id uuid NOT NULL,
  to_lot_identifier text NOT NULL,
  quantity_transferred numeric NOT NULL CHECK (quantity_transferred > 0),
  unit text NOT NULL,
  reason text NOT NULL,
  notes text,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on both tables
ALTER TABLE waste_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users with operations access can view waste tracking" ON waste_tracking;
DROP POLICY IF EXISTS "Users with read-write access can insert waste tracking" ON waste_tracking;
DROP POLICY IF EXISTS "Users with operations access can view transfer tracking" ON transfer_tracking;
DROP POLICY IF EXISTS "Users with read-write access can insert transfer tracking" ON transfer_tracking;

-- RLS Policies for waste_tracking
-- Users with operations access can view waste records
CREATE POLICY "Users with operations access can view waste tracking"
  ON waste_tracking FOR SELECT
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

-- Users with read-write access can insert waste records
CREATE POLICY "Users with read-write access can insert waste tracking"
  ON waste_tracking FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- RLS Policies for transfer_tracking
-- Users with operations access can view transfer records
CREATE POLICY "Users with operations access can view transfer tracking"
  ON transfer_tracking FOR SELECT
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

-- Users with read-write access can insert transfer records
CREATE POLICY "Users with read-write access can insert transfer tracking"
  ON transfer_tracking FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_waste_tracking_lot_id ON waste_tracking(lot_id);
CREATE INDEX IF NOT EXISTS idx_waste_tracking_lot_type ON waste_tracking(lot_type);
CREATE INDEX IF NOT EXISTS idx_waste_tracking_waste_date ON waste_tracking(waste_date);
CREATE INDEX IF NOT EXISTS idx_transfer_tracking_from_lot ON transfer_tracking(from_lot_id);
CREATE INDEX IF NOT EXISTS idx_transfer_tracking_to_lot ON transfer_tracking(to_lot_id);
CREATE INDEX IF NOT EXISTS idx_transfer_tracking_lot_type ON transfer_tracking(lot_type);
CREATE INDEX IF NOT EXISTS idx_transfer_tracking_transfer_date ON transfer_tracking(transfer_date);

