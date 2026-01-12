/*
  # Customer Types System - Admin-Controlled Customer Type Management
  
  This migration creates the customer_types table for admin-controlled customer type management.
  
  Customer types are metadata that can be created/updated by admins.
  Only Admins can create/update customer types.
  Customer types cannot be deleted if used by customers.
  Inactive customer types cannot be selected for new customers but remain for historical data.
*/

-- ============================================
-- CUSTOMER TYPES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE customer_types ENABLE ROW LEVEL SECURITY;

-- Admins can view all customer types (including inactive)
-- Sales users can view active customer types for selection
CREATE POLICY "Admins and sales users can view customer types"
  ON customer_types FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all customer types
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- Sales users can see active customer types only
    (
      status = 'active' AND
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level IN ('read-only', 'read-write')
      )
    )
  );

CREATE POLICY "Admins can create customer types"
  ON customer_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update customer types"
  ON customer_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_customer_types_status ON customer_types(status);
CREATE INDEX IF NOT EXISTS idx_customer_types_key ON customer_types(type_key);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_customer_types_updated_at
  BEFORE UPDATE ON customer_types
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_types_updated_at();

-- Insert default customer types
INSERT INTO customer_types (type_key, display_name, description, status) VALUES
  ('hotel', 'Hotel', 'Hotel customers', 'active'),
  ('restaurant', 'Restaurant', 'Restaurant customers', 'active'),
  ('retail', 'Retail', 'Retail customers', 'active'),
  ('direct', 'Direct', 'Direct customers', 'active'),
  ('other', 'Other', 'Other customer types', 'active')
ON CONFLICT (type_key) DO NOTHING;

-- ============================================
-- UPDATE CUSTOMERS TABLE TO REFERENCE CUSTOMER_TYPES
-- ============================================

-- First, add a new column for customer_type_id
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type_id uuid REFERENCES customer_types(id);

-- Migrate existing customer_type values to customer_type_id
UPDATE customers c
SET customer_type_id = ct.id
FROM customer_types ct
WHERE LOWER(c.customer_type) = ct.type_key;

-- Make customer_type_id NOT NULL after migration (but allow NULL temporarily for migration)
-- We'll keep the old customer_type column for now to ensure backward compatibility

-- Add index for customer_type_id
CREATE INDEX IF NOT EXISTS idx_customers_customer_type_id ON customers(customer_type_id);
