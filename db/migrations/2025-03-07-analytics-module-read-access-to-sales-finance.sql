-- Allow analytics module users to view sales data (orders, order_items, order_payments, customers)
-- This enables investors, auditors, and stakeholders to see business metrics without operational access

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users with sales access can view orders" ON orders;
DROP POLICY IF EXISTS "Users with sales access can view order items" ON order_items;
DROP POLICY IF EXISTS "Users with sales access can view order payments" ON order_payments;
DROP POLICY IF EXISTS "Users with sales access can view customers" ON customers;

DROP POLICY IF EXISTS "Finance users can view income" ON income;
DROP POLICY IF EXISTS "Finance users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Finance users can view contributions" ON contributions;

-- Recreate SELECT policies with analytics module access

-- Orders: Sales OR Analytics module access
CREATE POLICY "Users with sales or analytics access can view orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('sales', 'analytics')
        AND uma.access_level IN ('read-only', 'read-write')
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Order Items: Sales OR Analytics module access
CREATE POLICY "Users with sales or analytics access can view order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (
          EXISTS (
            SELECT 1 FROM user_module_access uma
            JOIN users u ON uma.user_id = u.id
            WHERE u.auth_user_id = auth.uid()
              AND uma.module_name IN ('sales', 'analytics')
              AND uma.access_level IN ('read-only', 'read-write')
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Order Payments: Sales OR Analytics module access
CREATE POLICY "Users with sales or analytics access can view order payments"
  ON order_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
        AND (
          EXISTS (
            SELECT 1 FROM user_module_access uma
            JOIN users u ON uma.user_id = u.id
            WHERE u.auth_user_id = auth.uid()
              AND uma.module_name IN ('sales', 'analytics')
              AND uma.access_level IN ('read-only', 'read-write')
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Customers: Sales OR Analytics module access
CREATE POLICY "Users with sales or analytics access can view customers"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('sales', 'analytics')
        AND uma.access_level IN ('read-only', 'read-write')
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Income: Finance OR Analytics module access
CREATE POLICY "Finance or analytics users can view income"
  ON income FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('finance', 'analytics')
        AND uma.has_access = true
    )
  );

-- Expenses: Finance OR Analytics module access
CREATE POLICY "Finance or analytics users can view expenses"
  ON expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('finance', 'analytics')
        AND uma.has_access = true
    )
  );

-- Contributions: Finance OR Analytics module access
CREATE POLICY "Finance or analytics users can view contributions"
  ON contributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('finance', 'analytics')
        AND uma.has_access = true
    )
  );
