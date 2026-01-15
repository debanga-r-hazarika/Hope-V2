/*
  # Add DELETE Policy for Customer Types

  This migration adds a DELETE policy for the customer_types table to allow admins to delete customer types.
  The application code already checks for usage before attempting deletion, so this policy enables the feature.
*/

-- Add DELETE policy for customer_types table
CREATE POLICY "Admins can delete customer types"
  ON customer_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );