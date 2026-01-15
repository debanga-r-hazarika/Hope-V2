/*
  # Fix Production Batches INSERT Policy
  
  Updates the INSERT policy for production_batches to check for 
  'operations-production-batches' module access instead of just 'operations'.
  
  This ensures users with read-write access to the Production Batches sub-module
  can create new production batches.
*/

DROP POLICY IF EXISTS "Users with read-write access can insert production batches" ON production_batches;

CREATE POLICY "Users with read-write access can insert production batches"
  ON production_batches FOR INSERT
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
      AND uma.module_name IN ('operations', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );
