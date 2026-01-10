/*
  # Sales Module - Payment Tracking
  
  1. New Tables
    - `order_payments`
      - Payment records linked to orders
      - Fields: order_id, payment_date, payment_mode, transaction_reference, evidence_url, amount_received
      - Auto-calculates order payment status
      
  2. Payment Status Logic
    - Pending: No payments received
    - Partial: Some payments received but not full amount
    - Paid: Total payments >= order total
    
  3. Finance Integration
    - Auto-creates Income entry when payment is recorded
    - Links to Finance module automatically
*/

-- Create order_payments table
CREATE TABLE IF NOT EXISTS order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  payment_mode text NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank')),
  transaction_reference text,
  evidence_url text,
  amount_received numeric(15,2) NOT NULL CHECK (amount_received > 0),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_date ON order_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_payments_reference ON order_payments(transaction_reference);

-- Enable RLS
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_payments
CREATE POLICY "Users with sales access can view order payments"
  ON order_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
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

CREATE POLICY "Users with read-write access can insert order payments"
  ON order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
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

CREATE POLICY "Users with read-write access can update order payments"
  ON order_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
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
      WHERE o.id = order_payments.order_id
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

CREATE POLICY "Users with read-write access can delete order payments"
  ON order_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
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

-- Function to calculate order payment status
CREATE OR REPLACE FUNCTION calculate_order_payment_status(order_uuid uuid)
RETURNS text AS $$
DECLARE
  order_total numeric;
  total_paid numeric;
BEGIN
  -- Get order total
  SELECT total_amount INTO order_total
  FROM orders
  WHERE id = order_uuid;
  
  -- Get total payments
  SELECT COALESCE(SUM(amount_received), 0) INTO total_paid
  FROM order_payments
  WHERE order_id = order_uuid;
  
  -- Calculate status
  IF total_paid = 0 THEN
    RETURN 'Pending';
  ELSIF total_paid >= order_total THEN
    RETURN 'Paid';
  ELSE
    RETURN 'Partial';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_order_payments_updated_at
  BEFORE UPDATE ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_payments_updated_at();

-- Function to auto-create Income entry when payment is recorded
CREATE OR REPLACE FUNCTION create_income_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  order_data record;
  customer_data record;
  income_transaction_id text;
  payment_method_map text;
  income_reason text;
BEGIN
  -- Get order and customer data
  SELECT o.*, c.name as customer_name, c.id as customer_id
  INTO order_data
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  WHERE o.id = NEW.order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  -- Map payment_mode to payment_method for Finance module
  payment_method_map := CASE
    WHEN NEW.payment_mode = 'Cash' THEN 'cash'
    WHEN NEW.payment_mode = 'UPI' THEN 'upi'
    WHEN NEW.payment_mode = 'Bank' THEN 'bank_transfer'
    ELSE 'bank_transfer'
  END;
  
  -- Generate transaction ID for income entry
  SELECT 'TXN-INC-' || LPAD(
    (COALESCE(
      (SELECT MAX(CAST(SUBSTRING(transaction_id FROM 'TXN-INC-(\d+)') AS INTEGER)) FROM income WHERE transaction_id ~ '^TXN-INC-\d+$'),
      0
    ) + 1)::text,
    3,
    '0'
  ) INTO income_transaction_id;
  
  -- Create reason text with order and customer reference
  income_reason := 'Payment for Order ' || order_data.order_number;
  IF order_data.customer_name IS NOT NULL THEN
    income_reason := income_reason || ' - Customer: ' || order_data.customer_name;
  END IF;
  
  -- Create Income entry in Finance module
  INSERT INTO income (
    amount,
    source,
    income_type,
    reason,
    transaction_id,
    payment_to,
    payment_date,
    payment_at,
    payment_method,
    description,
    category,
    bank_reference,
    evidence_url,
    recorded_by
  )
  VALUES (
    NEW.amount_received,
    COALESCE(order_data.customer_name, 'Sales'),
    'sales',
    income_reason,
    income_transaction_id,
    'organization_bank',
    NEW.payment_date,
    NEW.payment_date,
    payment_method_map,
    'Auto-generated from Order Payment: ' || order_data.order_number || 
    CASE WHEN NEW.transaction_reference IS NOT NULL THEN ' | Transaction: ' || NEW.transaction_reference ELSE '' END ||
    CASE WHEN NEW.notes IS NOT NULL THEN ' | Notes: ' || NEW.notes ELSE '' END,
    'Sales',
    NEW.transaction_reference,
    NEW.evidence_url,
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create Income entry when payment is inserted
CREATE TRIGGER create_income_on_payment_insert
  AFTER INSERT ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_income_from_payment();

-- Note: We don't create income on UPDATE because that would create duplicates
-- If payment is updated, the original income entry should be updated separately if needed
