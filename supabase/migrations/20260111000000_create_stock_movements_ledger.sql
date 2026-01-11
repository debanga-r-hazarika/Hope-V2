-- Create stock_movements table - Ledger-based stock tracking
-- This table records all stock movements immutably for raw materials and recurring products
-- Current stock = sum of all movements in chronological order

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Item identification
  item_type text NOT NULL CHECK (item_type IN ('raw_material', 'recurring_product')),
  item_reference uuid NOT NULL, -- References raw_materials.id or recurring_products.id
  lot_reference text, -- References lot_id (nullable for non-lot items, but typically present)
  
  -- Movement details
  movement_type text NOT NULL CHECK (movement_type IN ('IN', 'CONSUMPTION', 'WASTE', 'TRANSFER_OUT', 'TRANSFER_IN')),
  quantity numeric NOT NULL CHECK (quantity > 0), -- Always positive, direction indicated by movement_type
  unit text NOT NULL,
  
  -- Date and reference tracking
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_id uuid, -- References waste_tracking.id, transfer_tracking.id, or production_batches.id
  reference_type text, -- 'waste_record', 'transfer_record', 'production_batch', 'initial_intake'
  
  -- Audit fields
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  
  -- Metadata for display
  notes text
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_reference ON stock_movements(item_type, item_reference);
CREATE INDEX IF NOT EXISTS idx_stock_movements_lot_reference ON stock_movements(lot_reference) WHERE lot_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_effective_date ON stock_movements(effective_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id ON stock_movements(reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);

-- Enable RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_movements
CREATE POLICY "Users with operations access can view stock movements"
  ON stock_movements FOR SELECT
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

CREATE POLICY "Users with read-write access can insert stock movements"
  ON stock_movements FOR INSERT
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

-- Prevent updates and deletes - movements are immutable
CREATE POLICY "No updates allowed on stock movements"
  ON stock_movements FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No deletes allowed on stock movements"
  ON stock_movements FOR DELETE
  TO authenticated
  USING (false);

-- Function to calculate current stock balance from movements
CREATE OR REPLACE FUNCTION calculate_stock_balance(
  p_item_type text,
  p_item_reference uuid,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_balance numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type = 'IN' THEN quantity
      WHEN movement_type = 'TRANSFER_IN' THEN quantity
      WHEN movement_type = 'CONSUMPTION' THEN -quantity
      WHEN movement_type = 'WASTE' THEN -quantity
      WHEN movement_type = 'TRANSFER_OUT' THEN -quantity
      ELSE 0
    END
  ), 0)
  INTO v_balance
  FROM stock_movements
  WHERE item_type = p_item_type
    AND item_reference = p_item_reference
    AND effective_date <= p_as_of_date;
  
  RETURN v_balance;
END;
$$;

-- Function to get stock movement history for an item
CREATE OR REPLACE FUNCTION get_stock_movement_history(
  p_item_type text,
  p_item_reference uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  movement_type text,
  quantity numeric,
  unit text,
  effective_date date,
  reference_id uuid,
  reference_type text,
  notes text,
  created_at timestamptz,
  running_balance numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
BEGIN
  v_start_date := COALESCE(p_start_date, '1900-01-01'::date);
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  RETURN QUERY
  SELECT 
    sm.id,
    sm.movement_type,
    sm.quantity,
    sm.unit,
    sm.effective_date,
    sm.reference_id,
    sm.reference_type,
    sm.notes,
    sm.created_at,
    SUM(
      CASE 
        WHEN sm2.movement_type = 'IN' THEN sm2.quantity
        WHEN sm2.movement_type = 'TRANSFER_IN' THEN sm2.quantity
        WHEN sm2.movement_type = 'CONSUMPTION' THEN -sm2.quantity
        WHEN sm2.movement_type = 'WASTE' THEN -sm2.quantity
        WHEN sm2.movement_type = 'TRANSFER_OUT' THEN -sm2.quantity
        ELSE 0
      END
    ) OVER (
      PARTITION BY sm.item_type, sm.item_reference 
      ORDER BY sm.effective_date, sm.created_at
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance
  FROM stock_movements sm
  LEFT JOIN stock_movements sm2 ON 
    sm2.item_type = sm.item_type 
    AND sm2.item_reference = sm.item_reference
    AND (
      sm2.effective_date < sm.effective_date 
      OR (sm2.effective_date = sm.effective_date AND sm2.created_at <= sm.created_at)
    )
  WHERE sm.item_type = p_item_type
    AND sm.item_reference = p_item_reference
    AND sm.effective_date BETWEEN v_start_date AND v_end_date
  ORDER BY sm.effective_date, sm.created_at;
END;
$$;

-- Create function to check if waste/transfer record can be edited/deleted
CREATE OR REPLACE FUNCTION can_edit_waste_transfer_record(
  p_record_date date,
  p_created_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Records older than 15 days cannot be edited
  RETURN (CURRENT_DATE - p_record_date) < 15;
END;
$$;

-- Add UPDATE and DELETE policies for waste_tracking that enforce 15-day rule
DROP POLICY IF EXISTS "Users with read-write access can update waste tracking" ON waste_tracking;
DROP POLICY IF EXISTS "Users with read-write access can delete waste tracking" ON waste_tracking;

CREATE POLICY "Users with read-write access can update waste tracking"
  ON waste_tracking FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    AND can_edit_waste_transfer_record(waste_tracking.waste_date, waste_tracking.created_at)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    AND can_edit_waste_transfer_record(waste_tracking.waste_date, waste_tracking.created_at)
  );

CREATE POLICY "Users with read-write access can delete waste tracking"
  ON waste_tracking FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    AND can_edit_waste_transfer_record(waste_tracking.waste_date, waste_tracking.created_at)
  );

-- Add UPDATE and DELETE policies for transfer_tracking that enforce 15-day rule
DROP POLICY IF EXISTS "Users with read-write access can update transfer tracking" ON transfer_tracking;
DROP POLICY IF EXISTS "Users with read-write access can delete transfer tracking" ON transfer_tracking;

CREATE POLICY "Users with read-write access can update transfer tracking"
  ON transfer_tracking FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    AND can_edit_waste_transfer_record(transfer_tracking.transfer_date, transfer_tracking.created_at)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    AND can_edit_waste_transfer_record(transfer_tracking.transfer_date, transfer_tracking.created_at)
  );

CREATE POLICY "Users with read-write access can delete transfer tracking"
  ON transfer_tracking FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
    AND can_edit_waste_transfer_record(transfer_tracking.transfer_date, transfer_tracking.created_at)
  );

COMMENT ON TABLE stock_movements IS 'Immutable ledger of all stock movements. Current stock = sum of movements in chronological order.';
COMMENT ON COLUMN stock_movements.item_type IS 'Type of item: raw_material or recurring_product';
COMMENT ON COLUMN stock_movements.item_reference IS 'UUID reference to raw_materials.id or recurring_products.id';
COMMENT ON COLUMN stock_movements.lot_reference IS 'Lot identifier (lot_id) - nullable but typically present';
COMMENT ON COLUMN stock_movements.movement_type IS 'Type of movement: IN, CONSUMPTION, WASTE, TRANSFER_OUT, TRANSFER_IN';
COMMENT ON COLUMN stock_movements.quantity IS 'Always positive. Direction determined by movement_type';
COMMENT ON COLUMN stock_movements.effective_date IS 'Business date when movement occurred';
COMMENT ON COLUMN stock_movements.reference_id IS 'UUID reference to waste_tracking.id, transfer_tracking.id, or production_batches.id';
COMMENT ON COLUMN stock_movements.reference_type IS 'Type of reference: waste_record, transfer_record, production_batch, initial_intake';
