-- Apply the delete policy for orders table
-- This policy allows authenticated users to delete unlocked orders

-- First, ensure we can drop any existing policy
DROP POLICY IF EXISTS "Users with read-write access can delete orders" ON orders;
DROP POLICY IF EXISTS "Users can delete unlocked orders" ON orders;

-- Create the delete policy
CREATE POLICY "Users can delete unlocked orders"
  ON orders FOR DELETE
  TO authenticated
  USING (is_locked = false);

-- Log that the policy was created
DO $$
BEGIN
  RAISE NOTICE 'Delete policy for orders table has been created';
END $$;