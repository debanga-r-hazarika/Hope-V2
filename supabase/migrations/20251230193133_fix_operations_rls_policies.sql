/*
  # Fix Operations Module RLS Policies

  1. Issue
    - RLS policies were comparing auth.uid() directly with user_module_access.user_id
    - However, user_module_access.user_id stores the profile ID (users.id)
    - auth.uid() returns the auth user ID (users.auth_user_id)
    - This mismatch caused all operations to fail with 403 Forbidden

  2. Fix
    - Update all operations-related RLS policies to join through users table
    - Match auth.uid() with users.auth_user_id, then check user_module_access with users.id

  3. Tables Updated
    - suppliers (SELECT, INSERT, UPDATE, DELETE policies)
    - raw_materials (SELECT, INSERT, UPDATE, DELETE policies)
    - recurring_products (SELECT, INSERT, UPDATE, DELETE policies)
    - production_batches (SELECT, INSERT, UPDATE, DELETE policies)
    - processed_goods (SELECT, INSERT policies)
    - machines (SELECT, INSERT, UPDATE, DELETE policies)
    - batch_raw_materials (SELECT, INSERT, DELETE policies)
    - batch_recurring_products (SELECT, INSERT, DELETE policies)
*/

-- Drop existing policies for suppliers
DROP POLICY IF EXISTS "Users with operations access can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users with read-write access can insert suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users with read-write access can update suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users with read-write access can delete suppliers" ON suppliers;

-- Create new policies for suppliers with correct auth check
CREATE POLICY "Users with operations access can view suppliers"
  ON suppliers FOR SELECT
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

CREATE POLICY "Users with read-write access can insert suppliers"
  ON suppliers FOR INSERT
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

CREATE POLICY "Users with read-write access can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
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
  );

CREATE POLICY "Users with read-write access can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- Drop existing policies for raw_materials
DROP POLICY IF EXISTS "Users with operations access can view raw materials" ON raw_materials;
DROP POLICY IF EXISTS "Users with read-write access can insert raw materials" ON raw_materials;
DROP POLICY IF EXISTS "Users with read-write access can update raw materials" ON raw_materials;
DROP POLICY IF EXISTS "Users with read-write access can delete raw materials" ON raw_materials;

-- Create new policies for raw_materials
CREATE POLICY "Users with operations access can view raw materials"
  ON raw_materials FOR SELECT
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

CREATE POLICY "Users with read-write access can insert raw materials"
  ON raw_materials FOR INSERT
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

CREATE POLICY "Users with read-write access can update raw materials"
  ON raw_materials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
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
  );

CREATE POLICY "Users with read-write access can delete raw materials"
  ON raw_materials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- Drop existing policies for recurring_products
DROP POLICY IF EXISTS "Users with operations access can view recurring products" ON recurring_products;
DROP POLICY IF EXISTS "Users with read-write access can insert recurring products" ON recurring_products;
DROP POLICY IF EXISTS "Users with read-write access can update recurring products" ON recurring_products;
DROP POLICY IF EXISTS "Users with read-write access can delete recurring products" ON recurring_products;

-- Create new policies for recurring_products
CREATE POLICY "Users with operations access can view recurring products"
  ON recurring_products FOR SELECT
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

CREATE POLICY "Users with read-write access can insert recurring products"
  ON recurring_products FOR INSERT
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

CREATE POLICY "Users with read-write access can update recurring products"
  ON recurring_products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
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
  );

CREATE POLICY "Users with read-write access can delete recurring products"
  ON recurring_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- Drop existing policies for production_batches
DROP POLICY IF EXISTS "Users with operations access can view production batches" ON production_batches;
DROP POLICY IF EXISTS "Users with read-write access can insert production batches" ON production_batches;
DROP POLICY IF EXISTS "Users with read-write access can update production batches" ON production_batches;
DROP POLICY IF EXISTS "Users with read-write access can delete production batches" ON production_batches;

-- Create new policies for production_batches
CREATE POLICY "Users with operations access can view production batches"
  ON production_batches FOR SELECT
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

CREATE POLICY "Users with read-write access can insert production batches"
  ON production_batches FOR INSERT
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

CREATE POLICY "Users with read-write access can update production batches"
  ON production_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
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
  );

CREATE POLICY "Users with read-write access can delete production batches"
  ON production_batches FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- Drop existing policies for processed_goods
DROP POLICY IF EXISTS "Users with operations access can view processed goods" ON processed_goods;
DROP POLICY IF EXISTS "Only system can insert processed goods" ON processed_goods;

-- Create new policies for processed_goods
CREATE POLICY "Users with operations access can view processed goods"
  ON processed_goods FOR SELECT
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

CREATE POLICY "Users with read-write access can insert processed goods"
  ON processed_goods FOR INSERT
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

-- Drop existing policies for machines
DROP POLICY IF EXISTS "Users with operations access can view machines" ON machines;
DROP POLICY IF EXISTS "Users with read-write access can insert machines" ON machines;
DROP POLICY IF EXISTS "Users with read-write access can update machines" ON machines;
DROP POLICY IF EXISTS "Users with read-write access can delete machines" ON machines;

-- Create new policies for machines
CREATE POLICY "Users with operations access can view machines"
  ON machines FOR SELECT
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

CREATE POLICY "Users with read-write access can insert machines"
  ON machines FOR INSERT
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

CREATE POLICY "Users with read-write access can update machines"
  ON machines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
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
  );

CREATE POLICY "Users with read-write access can delete machines"
  ON machines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- Drop existing policies for batch_raw_materials
DROP POLICY IF EXISTS "Users with operations access can view batch raw materials" ON batch_raw_materials;
DROP POLICY IF EXISTS "Users with read-write access can insert batch raw materials" ON batch_raw_materials;
DROP POLICY IF EXISTS "Users with read-write access can delete batch raw materials" ON batch_raw_materials;

-- Create new policies for batch_raw_materials
CREATE POLICY "Users with operations access can view batch raw materials"
  ON batch_raw_materials FOR SELECT
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

CREATE POLICY "Users with read-write access can insert batch raw materials"
  ON batch_raw_materials FOR INSERT
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

CREATE POLICY "Users with read-write access can delete batch raw materials"
  ON batch_raw_materials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );

-- Drop existing policies for batch_recurring_products
DROP POLICY IF EXISTS "Users with operations access can view batch recurring products" ON batch_recurring_products;
DROP POLICY IF EXISTS "Users with read-write access can insert batch recurring product" ON batch_recurring_products;
DROP POLICY IF EXISTS "Users with read-write access can delete batch recurring product" ON batch_recurring_products;

-- Create new policies for batch_recurring_products
CREATE POLICY "Users with operations access can view batch recurring products"
  ON batch_recurring_products FOR SELECT
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

CREATE POLICY "Users with read-write access can insert batch recurring products"
  ON batch_recurring_products FOR INSERT
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

CREATE POLICY "Users with read-write access can delete batch recurring products"
  ON batch_recurring_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'operations'
      AND uma.access_level = 'read-write'
    )
  );
