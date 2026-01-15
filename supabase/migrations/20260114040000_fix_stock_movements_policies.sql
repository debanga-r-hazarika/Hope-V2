/*
  # Fix Stock Movements RLS Policies for Operations Sub-Modules
  
  Updates stock_movements RLS policies to check for all Operations sub-modules
  instead of just 'operations'. This allows users with sub-module access
  (e.g., operations-production-batches) to create stock movements when
  adding raw materials or recurring products to production batches.
  
  This fixes the "failed to create" error when users with R/W access to
  Production Batch try to add materials to batches.
*/

-- Update SELECT policy to allow all operations sub-modules
DROP POLICY IF EXISTS "Users with operations access can view stock movements" ON stock_movements;
CREATE POLICY "Users with operations access can view stock movements"
  ON stock_movements FOR SELECT
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
      AND uma.module_name IN (
        'operations',
        'operations-suppliers',
        'operations-raw-materials',
        'operations-recurring-products',
        'operations-production-batches',
        'operations-processed-goods',
        'operations-machines'
      )
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- Update INSERT policy to allow all operations sub-modules with read-write access
DROP POLICY IF EXISTS "Users with read-write access can insert stock movements" ON stock_movements;
CREATE POLICY "Users with read-write access can insert stock movements"
  ON stock_movements FOR INSERT
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
      AND uma.module_name IN (
        'operations',
        'operations-suppliers',
        'operations-raw-materials',
        'operations-recurring-products',
        'operations-production-batches',
        'operations-processed-goods',
        'operations-machines'
      )
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );
