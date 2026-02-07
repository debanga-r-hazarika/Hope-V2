/*
  # Third-Party Delivery Tracking Tables
  
  This migration creates tables for optional third-party delivery tracking:
  1. third_party_deliveries - Main delivery tracking table
  2. third_party_delivery_documents - Links delivery records to uploaded documents
  
  Note: This is for record-keeping only and does NOT affect inventory
*/

-- Create third_party_deliveries table
CREATE TABLE IF NOT EXISTS third_party_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  quantity_delivered numeric CHECK (quantity_delivered >= 0),
  delivery_partner_name text,
  delivery_notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(order_id) -- One delivery record per order
);

-- Create third_party_delivery_documents table
-- This links delivery records to documents in the documents table
CREATE TABLE IF NOT EXISTS third_party_delivery_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  third_party_delivery_id uuid REFERENCES third_party_deliveries(id) ON DELETE CASCADE NOT NULL,
  document_url text NOT NULL, -- URL to the uploaded document
  document_name text NOT NULL, -- Original filename
  document_type text NOT NULL, -- MIME type (e.g., 'application/pdf', 'image/jpeg')
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_third_party_deliveries_order ON third_party_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_third_party_delivery_documents_delivery ON third_party_delivery_documents(third_party_delivery_id);

-- Enable RLS
ALTER TABLE third_party_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE third_party_delivery_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for third_party_deliveries
CREATE POLICY "Users with sales access can view third-party deliveries"
  ON third_party_deliveries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = third_party_deliveries.order_id
      AND EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level IN ('read-only', 'read-write')
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users with read-write access can manage third-party deliveries"
  ON third_party_deliveries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = third_party_deliveries.order_id
      AND EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level = 'read-write'
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = third_party_deliveries.order_id
      AND EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level = 'read-write'
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for third_party_delivery_documents
CREATE POLICY "Users with sales access can view delivery documents"
  ON third_party_delivery_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM third_party_deliveries tpd
      JOIN orders o ON o.id = tpd.order_id
      WHERE tpd.id = third_party_delivery_documents.third_party_delivery_id
      AND EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level IN ('read-only', 'read-write')
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users with read-write access can manage delivery documents"
  ON third_party_delivery_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM third_party_deliveries tpd
      JOIN orders o ON o.id = tpd.order_id
      WHERE tpd.id = third_party_delivery_documents.third_party_delivery_id
      AND EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level = 'read-write'
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM third_party_deliveries tpd
      JOIN orders o ON o.id = tpd.order_id
      WHERE tpd.id = third_party_delivery_documents.third_party_delivery_id
      AND EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name = 'sales'
        AND uma.access_level = 'read-write'
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_third_party_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_third_party_deliveries_updated_at
  BEFORE UPDATE ON third_party_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_third_party_deliveries_updated_at();

-- Add comments
COMMENT ON TABLE third_party_deliveries IS 
'Tracks third-party delivery information for orders. This is for record-keeping only and does NOT affect inventory.';

COMMENT ON TABLE third_party_delivery_documents IS 
'Links delivery records to uploaded documents (delivery slips, proof of delivery, etc.)';
