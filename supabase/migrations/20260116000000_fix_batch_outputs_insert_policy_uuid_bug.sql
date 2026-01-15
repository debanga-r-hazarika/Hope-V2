/*
  # Fix Batch Outputs INSERT Policy UUID Bug
  
  Issue:
  The RLS policy for batch_outputs INSERT has a critical bug where it tries to cast
  pb.batch_id (TEXT field like "BATCH-0007") to UUID, which causes the policy evaluation
  to fail and can lead to UUID validation errors.
  
  Current broken policy:
  WHERE (pb.id = (pb.batch_id)::uuid)
  
  This is wrong because:
  1. pb.batch_id is TEXT (e.g., "BATCH-0007"), not UUID
  2. pb.id is UUID (the actual primary key)
  3. We should compare pb.id = batch_id (where batch_id is the UUID column from batch_outputs)
  
  Fix:
  Replace the broken condition with the correct comparison:
  WHERE pb.id = batch_id AND pb.is_locked = false
*/

-- Drop the broken policy
DROP POLICY IF EXISTS "Users with read-write access can insert batch outputs" ON batch_outputs;

-- Create the corrected policy
CREATE POLICY "Users with read-write access can insert batch outputs"
  ON batch_outputs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_module_access uma
        JOIN users u ON uma.user_id = u.id
        WHERE u.auth_user_id = auth.uid()
        AND uma.module_name IN ('operations', 'operations-production-batches')
        AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
      )
      -- Only allow inserting outputs for unlocked batches (for non-admin users)
      -- In WITH CHECK, we need to explicitly reference batch_outputs.batch_id (UUID)
      -- Compare pb.id (UUID) with batch_outputs.batch_id (UUID from batch_outputs table)
      AND EXISTS (
        SELECT 1 FROM production_batches pb
        WHERE pb.id = batch_outputs.batch_id
        AND pb.is_locked = false
      )
    )
  );
