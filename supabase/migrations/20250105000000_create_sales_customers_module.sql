/*
  # Sales Module - Customer Management
  
  1. New Tables
    - `customers`
      - Unified customer database for sales and CRM
      - Fields: name, customer_type, contact_person, phone, address, status, notes
      - Soft delete via status field (no hard delete)
      
  2. Security
    - Enable RLS on all tables
    - Policies based on user_module_access
    - Read-write users can create and edit
    - Read-only users can view only
    - Super admin has full access
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  customer_type text NOT NULL CHECK (customer_type IN ('Hotel', 'Restaurant', 'Retail', 'Direct', 'Other')),
  contact_person text,
  phone text,
  address text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- RLS Policies
CREATE POLICY "Users with sales access can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'sales'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users with read-write access can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'sales'
      AND user_module_access.access_level = 'read-write'
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users with read-write access can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'sales'
      AND user_module_access.access_level = 'read-write'
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'sales'
      AND user_module_access.access_level = 'read-write'
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Note: No DELETE policy - customers are soft-deleted via status field

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();
