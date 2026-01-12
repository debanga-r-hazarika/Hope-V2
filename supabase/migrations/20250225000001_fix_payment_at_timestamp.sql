/*
  # Fix payment_at timestamp in income entries from sales payments
  
  The trigger was using payment_date (date only) for payment_at (timestamptz),
  which caused all income entries to have the same time (defaulting to midnight/5:30 AM).
  
  This migration updates the trigger to use created_at (actual payment record time)
  for payment_at, ensuring proper sorting and unique payment records.
*/

-- Update the trigger function to use created_at for payment_at
CREATE OR REPLACE FUNCTION create_income_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  order_data record;
  customer_data record;
  income_transaction_id text;
  payment_method_map text;
  income_reason text;
  payment_to_value text;
  paid_to_user_value text; -- Changed to text to match income table structure
  recorded_by_user_id uuid; -- Profile user ID for income.recorded_by
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
  
  -- Get payment_to and paid_to_user from order_payments (default to organization_bank if not set)
  payment_to_value := COALESCE(NEW.payment_to, 'organization_bank');
  -- Convert UUID to text for income table (paid_to_user in income is text, not uuid)
  paid_to_user_value := CASE 
    WHEN NEW.paid_to_user IS NOT NULL THEN NEW.paid_to_user::text 
    ELSE NULL 
  END;
  
  -- Convert auth user ID (created_by) to profile user ID (for income.recorded_by)
  -- order_payments.created_by references auth.users(id), but income.recorded_by references users(id)
  IF NEW.created_by IS NOT NULL THEN
    SELECT id INTO recorded_by_user_id
    FROM users
    WHERE auth_user_id = NEW.created_by;
  ELSE
    recorded_by_user_id := NULL;
  END IF;
  
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
  
  -- Create Income entry in Finance module with sales tracking fields
  INSERT INTO income (
    amount,
    source,
    income_type,
    reason,
    transaction_id,
    payment_to,
    paid_to_user,
    payment_date,
    payment_at,
    payment_method,
    description,
    category,
    bank_reference,
    evidence_url,
    recorded_by,
    from_sales_payment,
    order_payment_id,
    order_id,
    order_number
  )
  VALUES (
    NEW.amount_received,
    COALESCE(order_data.customer_name, 'Sales'),
    'sales',
    income_reason,
    income_transaction_id,
    payment_to_value,
    paid_to_user_value,
    NEW.payment_date,
    NEW.created_at, -- Use created_at (actual payment record time) instead of payment_date
    payment_method_map,
    'Auto-generated from Order Payment: ' || order_data.order_number || 
    CASE WHEN NEW.transaction_reference IS NOT NULL THEN ' | Transaction: ' || NEW.transaction_reference ELSE '' END ||
    CASE WHEN NEW.notes IS NOT NULL THEN ' | Notes: ' || NEW.notes ELSE '' END,
    'Sales',
    NEW.transaction_reference,
    NEW.evidence_url,
    recorded_by_user_id,
    true, -- from_sales_payment
    NEW.id, -- order_payment_id
    NEW.order_id, -- order_id
    order_data.order_number -- order_number
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
