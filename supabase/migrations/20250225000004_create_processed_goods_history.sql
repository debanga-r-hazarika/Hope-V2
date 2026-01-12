/*
  # Create processed_goods_history table
  
  This table tracks all quantity changes for processed goods, including:
  - Sales deliveries (quantity reductions)
  - Any other future quantity adjustments
  
  This provides a complete audit trail for processed goods inventory.
*/

-- Create processed_goods_history table
CREATE TABLE IF NOT EXISTS processed_goods_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_good_id uuid NOT NULL REFERENCES processed_goods(id) ON DELETE CASCADE,
  
  -- Quantity change details
  quantity_before numeric NOT NULL,
  quantity_after numeric NOT NULL,
  quantity_change numeric NOT NULL, -- Positive for increases, negative for decreases
  
  -- Change reason/type
  change_type text NOT NULL CHECK (change_type IN ('delivery', 'adjustment', 'correction', 'other')),
  change_reason text,
  
  -- Reference to related records
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  delivery_dispatch_id uuid REFERENCES delivery_dispatches(id) ON DELETE SET NULL,
  
  -- Audit fields
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  
  -- Metadata
  notes text
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_processed_goods_history_processed_good ON processed_goods_history(processed_good_id);
CREATE INDEX IF NOT EXISTS idx_processed_goods_history_effective_date ON processed_goods_history(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_processed_goods_history_change_type ON processed_goods_history(change_type);
CREATE INDEX IF NOT EXISTS idx_processed_goods_history_order ON processed_goods_history(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processed_goods_history_delivery_dispatch ON processed_goods_history(delivery_dispatch_id) WHERE delivery_dispatch_id IS NOT NULL;

-- Enable RLS
ALTER TABLE processed_goods_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for processed_goods_history
CREATE POLICY "Users with operations or sales access can view processed goods history"
  ON processed_goods_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name IN ('operations', 'sales')
      AND uma.access_level IN ('read-only', 'read-write')
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can insert processed goods history"
  ON processed_goods_history FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow system triggers to insert

-- Add comment
COMMENT ON TABLE processed_goods_history IS 'Audit trail of all quantity changes for processed goods. Tracks deliveries, adjustments, and other inventory movements.';
