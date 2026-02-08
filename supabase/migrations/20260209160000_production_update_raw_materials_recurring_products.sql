/*
  # Production batch deductions for Production-only users

  When a user has R/W access only to Production (operations-production-batches),
  adding raw materials or recurring products to a batch creates stock_movements
  but updateStockBalance() updates raw_materials.quantity_available and
  recurring_products.quantity_available. Those UPDATEs were blocked by RLS
  because only operations-raw-materials and operations-recurring-products had
  UPDATE permission.

  This migration allows users with operations-production-batches (read-write)
  to UPDATE raw_materials and recurring_products so that quantity_available
  is correctly reduced when they add materials to a production batch (and
  usage history in lots reflects the consumption).
*/

-- raw_materials: allow UPDATE for operations-production-batches (read-write)
DROP POLICY IF EXISTS "Users with read-write access can update raw materials" ON raw_materials;
CREATE POLICY "Users with read-write access can update raw materials"
  ON raw_materials FOR UPDATE
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
      AND uma.module_name IN ('operations', 'operations-raw-materials', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  )
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
      AND uma.module_name IN ('operations', 'operations-raw-materials', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- recurring_products: allow UPDATE for operations-production-batches (read-write)
DROP POLICY IF EXISTS "Users with read-write access can update recurring products" ON recurring_products;
CREATE POLICY "Users with read-write access can update recurring products"
  ON recurring_products FOR UPDATE
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
      AND uma.module_name IN ('operations', 'operations-recurring-products', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  )
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
      AND uma.module_name IN ('operations', 'operations-recurring-products', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );
