/*
  # Split Operations Module Access into Six Sub-Modules

  Updates RLS policies to check for new module names:
     - Suppliers → 'operations-suppliers'
     - Raw Materials → 'operations-raw-materials'
     - Recurring Products → 'operations-recurring-products'
     - Production Batches → 'operations-production-batches'
     - Processed Goods → 'operations-processed-goods'
     - Machines & Hardware → 'operations-machines'
  
  Maintains backward compatibility by also checking 'operations' module name.
  
  All policies include:
  - Admin bypass (admins can always access)
  - Fallback for legacy has_access column (when access_level is NULL)
  - Proper join through users table to match auth.uid() with users.auth_user_id
*/

-- ============================================
-- SUPPLIERS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view suppliers" ON suppliers;
CREATE POLICY "Users with operations access can view suppliers"
  ON suppliers FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-suppliers')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert suppliers" ON suppliers;
CREATE POLICY "Users with read-write access can insert suppliers"
  ON suppliers FOR INSERT
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
      AND uma.module_name IN ('operations', 'operations-suppliers')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can update suppliers" ON suppliers;
CREATE POLICY "Users with read-write access can update suppliers"
  ON suppliers FOR UPDATE
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
      AND uma.module_name IN ('operations', 'operations-suppliers')
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
      AND uma.module_name IN ('operations', 'operations-suppliers')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete suppliers" ON suppliers;
CREATE POLICY "Users with read-write access can delete suppliers"
  ON suppliers FOR DELETE
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
      AND uma.module_name IN ('operations', 'operations-suppliers')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- RAW MATERIALS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view raw materials" ON raw_materials;
CREATE POLICY "Users with operations access can view raw materials"
  ON raw_materials FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-raw-materials')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert raw materials" ON raw_materials;
CREATE POLICY "Users with read-write access can insert raw materials"
  ON raw_materials FOR INSERT
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
      AND uma.module_name IN ('operations', 'operations-raw-materials')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

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
      AND uma.module_name IN ('operations', 'operations-raw-materials')
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
      AND uma.module_name IN ('operations', 'operations-raw-materials')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete raw materials" ON raw_materials;
CREATE POLICY "Users with read-write access can delete raw materials"
  ON raw_materials FOR DELETE
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
      AND uma.module_name IN ('operations', 'operations-raw-materials')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- RECURRING PRODUCTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view recurring products" ON recurring_products;
CREATE POLICY "Users with operations access can view recurring products"
  ON recurring_products FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-recurring-products')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert recurring products" ON recurring_products;
CREATE POLICY "Users with read-write access can insert recurring products"
  ON recurring_products FOR INSERT
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
      AND uma.module_name IN ('operations', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

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
      AND uma.module_name IN ('operations', 'operations-recurring-products')
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
      AND uma.module_name IN ('operations', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete recurring products" ON recurring_products;
CREATE POLICY "Users with read-write access can delete recurring products"
  ON recurring_products FOR DELETE
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
      AND uma.module_name IN ('operations', 'operations-recurring-products')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- PRODUCTION BATCHES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view production batches" ON production_batches;
CREATE POLICY "Users with operations access can view production batches"
  ON production_batches FOR SELECT
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

DROP POLICY IF EXISTS "Users with read-write access can update production batches" ON production_batches;
CREATE POLICY "Users with read-write access can update production batches"
  ON production_batches FOR UPDATE
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
      AND uma.module_name IN ('operations', 'operations-production-batches')
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
      AND uma.module_name IN ('operations', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete production batches" ON production_batches;
CREATE POLICY "Users with read-write access can delete production batches"
  ON production_batches FOR DELETE
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
      AND uma.module_name IN ('operations', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- BATCH RAW MATERIALS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view batch raw materials" ON batch_raw_materials;
CREATE POLICY "Users with operations access can view batch raw materials"
  ON batch_raw_materials FOR SELECT
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
        'operations-raw-materials',
        'operations-production-batches'
      )
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert batch raw materials" ON batch_raw_materials;
CREATE POLICY "Users with read-write access can insert batch raw materials"
  ON batch_raw_materials FOR INSERT
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

DROP POLICY IF EXISTS "Users with read-write access can delete batch raw materials" ON batch_raw_materials;
CREATE POLICY "Users with read-write access can delete batch raw materials"
  ON batch_raw_materials FOR DELETE
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
      AND uma.module_name IN ('operations', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- BATCH RECURRING PRODUCTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view batch recurring products" ON batch_recurring_products;
CREATE POLICY "Users with operations access can view batch recurring products"
  ON batch_recurring_products FOR SELECT
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
        'operations-recurring-products',
        'operations-production-batches'
      )
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert batch recurring products" ON batch_recurring_products;
CREATE POLICY "Users with read-write access can insert batch recurring products"
  ON batch_recurring_products FOR INSERT
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

DROP POLICY IF EXISTS "Users with read-write access can delete batch recurring products" ON batch_recurring_products;
CREATE POLICY "Users with read-write access can delete batch recurring products"
  ON batch_recurring_products FOR DELETE
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
      AND uma.module_name IN ('operations', 'operations-production-batches')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- MACHINES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view machines" ON machines;
CREATE POLICY "Users with operations access can view machines"
  ON machines FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-machines')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert machines" ON machines;
CREATE POLICY "Users with read-write access can insert machines"
  ON machines FOR INSERT
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
      AND uma.module_name IN ('operations', 'operations-machines')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can update machines" ON machines;
CREATE POLICY "Users with read-write access can update machines"
  ON machines FOR UPDATE
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
      AND uma.module_name IN ('operations', 'operations-machines')
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
      AND uma.module_name IN ('operations', 'operations-machines')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete machines" ON machines;
CREATE POLICY "Users with read-write access can delete machines"
  ON machines FOR DELETE
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
      AND uma.module_name IN ('operations', 'operations-machines')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- MACHINE DOCUMENTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view machine documents" ON machine_documents;
CREATE POLICY "Users with operations access can view machine documents"
  ON machine_documents FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-machines')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert machine documents" ON machine_documents;
CREATE POLICY "Users with read-write access can insert machine documents"
  ON machine_documents FOR INSERT
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
      AND uma.module_name IN ('operations', 'operations-machines')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can update machine documents" ON machine_documents;
CREATE POLICY "Users with read-write access can update machine documents"
  ON machine_documents FOR UPDATE
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
      AND uma.module_name IN ('operations', 'operations-machines')
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
      AND uma.module_name IN ('operations', 'operations-machines')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete machine documents" ON machine_documents;
CREATE POLICY "Users with read-write access can delete machine documents"
  ON machine_documents FOR DELETE
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
      AND uma.module_name IN ('operations', 'operations-machines')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- PROCESSED GOODS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view processed goods" ON processed_goods;
CREATE POLICY "Users with operations access can view processed goods"
  ON processed_goods FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-processed-goods', 'sales')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can insert processed goods" ON processed_goods;
CREATE POLICY "Users with read-write access can insert processed goods"
  ON processed_goods FOR INSERT
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
      AND uma.module_name IN ('operations', 'operations-processed-goods')
      AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- PROCESSED GOODS HISTORY POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations or sales access can view processed goods history" ON processed_goods_history;
CREATE POLICY "Users with operations or sales access can view processed goods history"
  ON processed_goods_history FOR SELECT
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
      AND uma.module_name IN ('operations', 'operations-processed-goods', 'sales')
      AND (uma.access_level IN ('read-only', 'read-write') OR (uma.access_level IS NULL AND uma.has_access = true))
    )
  );

-- ============================================
-- BATCH OUTPUTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users with operations access can view batch outputs" ON batch_outputs;
CREATE POLICY "Users with operations access can view batch outputs"
  ON batch_outputs FOR SELECT
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

DROP POLICY IF EXISTS "Users with read-write access can insert batch outputs" ON batch_outputs;
CREATE POLICY "Users with read-write access can insert batch outputs"
  ON batch_outputs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('operations', 'operations-production-batches')
        AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
      )
      -- Only allow inserting outputs for unlocked batches (for non-admin users)
      AND EXISTS (
        SELECT 1 FROM production_batches pb
        WHERE pb.id = batch_id
        AND pb.is_locked = false
      )
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can update batch outputs" ON batch_outputs;
CREATE POLICY "Users with read-write access can update batch outputs"
  ON batch_outputs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('operations', 'operations-production-batches')
        AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
      )
      -- Only allow updating outputs for unlocked batches (for non-admin users)
      AND EXISTS (
        SELECT 1 FROM production_batches pb
        WHERE pb.id = batch_outputs.batch_id
        AND pb.is_locked = false
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('operations', 'operations-production-batches')
        AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
      )
      -- Only allow updating outputs for unlocked batches (for non-admin users)
      AND EXISTS (
        SELECT 1 FROM production_batches pb
        WHERE pb.id = batch_id
        AND pb.is_locked = false
      )
    )
  );

DROP POLICY IF EXISTS "Users with read-write access can delete batch outputs" ON batch_outputs;
CREATE POLICY "Users with read-write access can delete batch outputs"
  ON batch_outputs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('operations', 'operations-production-batches')
        AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
      )
      -- Only allow deleting outputs for unlocked batches (for non-admin users)
      AND EXISTS (
        SELECT 1 FROM production_batches pb
        WHERE pb.id = batch_outputs.batch_id
        AND pb.is_locked = false
      )
    )
  );
