/*
  # Fix Production Batch Access Issues
  
  Fixes two issues:
  1. Users with R/W access to Production Batches cannot add outputs in Step 4
  2. Stock movements are not created when raw materials/recurring products are added to batches
  
  Root Cause:
  - The batch_outputs INSERT policy may have issues with the batch lock check
  - The stock_movements INSERT policy needs to allow production batch users to create
    CONSUMPTION movements even if they only have R/O access to raw materials/recurring products
  
  Solution:
  - Ensure batch_outputs INSERT policy correctly checks for operations-production-batches access
  - Update stock_movements INSERT policy to explicitly allow production batch consumption movements
    when user has R/W access to operations-production-batches, regardless of raw material/recurring
    product module access levels
*/

-- ============================================
-- FIX 1: Batch Outputs INSERT Policy
-- ============================================
-- Ensure the policy correctly allows users with R/W access to operations-production-batches
-- The batch_id column is already UUID type, so no casting needed
DROP POLICY IF EXISTS "Users with read-write access can insert batch outputs" ON batch_outputs;

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
      -- In WITH CHECK, batch_id refers to the new row's column value
      AND EXISTS (
        SELECT 1 FROM production_batches pb
        WHERE pb.id = batch_id
        AND pb.is_locked = false
      )
    )
  );

-- ============================================
-- FIX 2: Stock Movements INSERT Policy
-- ============================================
-- Allow users with R/W access to operations-production-batches to create stock movements
-- for production batch consumption, even if they only have R/O access to raw materials/recurring products
-- 
-- Key insight: Users with R/W Production Batch access should be able to create CONSUMPTION movements
-- when adding materials to batches, regardless of their access level to Raw Materials/Recurring Products
DROP POLICY IF EXISTS "Users with read-write access can insert stock movements" ON stock_movements;

CREATE POLICY "Users with read-write access can insert stock movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND (
        -- Allow if user has R/W access to any operations sub-module
        (uma.module_name IN (
          'operations',
          'operations-suppliers',
          'operations-raw-materials',
          'operations-recurring-products',
          'operations-production-batches',
          'operations-processed-goods',
          'operations-machines'
        )
        AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true)))
        -- OR if user has R/W access to production batches AND this is a production batch consumption/reversal
        -- Note: In WITH CHECK, columns are referenced directly without table prefix
        OR (
          uma.module_name IN ('operations', 'operations-production-batches')
          AND (uma.access_level = 'read-write' OR (uma.access_level IS NULL AND uma.has_access = true))
          AND (
            -- Allow CONSUMPTION movements for production batches
            (movement_type = 'CONSUMPTION' AND reference_type = 'production_batch')
            -- Allow IN movements for production batch reversals (when batch is deleted)
            OR (movement_type = 'IN' AND reference_type = 'production_batch')
          )
        )
      )
    )
  );
