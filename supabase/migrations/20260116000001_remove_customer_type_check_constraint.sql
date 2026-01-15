/*
  # Remove Customer Type Check Constraint

  This migration removes the hardcoded CHECK constraint from the customers.customer_type column
  to allow admin-defined customer types to be used.

  The system uses customer_type_id as the primary reference to customer_types table for validation,
  while keeping customer_type for backward compatibility and display purposes.
*/

-- Drop the CHECK constraint from customer_type column
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_customer_type_check;