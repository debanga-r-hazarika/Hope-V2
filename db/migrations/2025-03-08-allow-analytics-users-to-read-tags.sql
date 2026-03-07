-- Allow Analytics module users to read tag tables for creating targets
-- This enables users with Analytics R/W access to see available materials/products when creating targets

-- Update raw_material_tags SELECT policy
DROP POLICY IF EXISTS "Admins and operations users can view raw material tags" ON raw_material_tags;

CREATE POLICY "Admins, operations, and analytics users can view raw material tags"
ON raw_material_tags
FOR SELECT
TO authenticated
USING (
  -- Admins can see all tags
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
    AND users.role = 'admin'
  )
  OR
  -- Active tags visible to operations or analytics users
  (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND (
        -- Operations module access
        uma.module_name IN ('operations', 'operations-raw-materials')
        OR
        -- Analytics module access (for creating targets)
        uma.module_name = 'analytics'
      )
      AND (
        uma.access_level IN ('read-only', 'read-write')
        OR (uma.access_level IS NULL AND uma.has_access = true)
      )
    )
  )
);

-- Update recurring_product_tags SELECT policy
DROP POLICY IF EXISTS "Admins and operations users can view recurring product tags" ON recurring_product_tags;

CREATE POLICY "Admins, operations, and analytics users can view recurring product tags"
ON recurring_product_tags
FOR SELECT
TO authenticated
USING (
  -- Admins can see all tags
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
    AND users.role = 'admin'
  )
  OR
  -- Active tags visible to operations or analytics users
  (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND (
        -- Operations module access
        uma.module_name IN ('operations', 'operations-recurring-products')
        OR
        -- Analytics module access (for creating targets)
        uma.module_name = 'analytics'
      )
      AND (
        uma.access_level IN ('read-only', 'read-write')
        OR (uma.access_level IS NULL AND uma.has_access = true)
      )
    )
  )
);

-- Update produced_goods_tags SELECT policy
DROP POLICY IF EXISTS "Admins and operations users can view produced goods tags" ON produced_goods_tags;

CREATE POLICY "Admins, operations, and analytics users can view produced goods tags"
ON produced_goods_tags
FOR SELECT
TO authenticated
USING (
  -- Admins can see all tags
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
    AND users.role = 'admin'
  )
  OR
  -- Active tags visible to operations or analytics users
  (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND (
        -- Operations module access
        uma.module_name IN ('operations', 'operations-production-batches')
        OR
        -- Analytics module access (for creating targets)
        uma.module_name = 'analytics'
      )
      AND (
        uma.access_level IN ('read-only', 'read-write')
        OR (uma.access_level IS NULL AND uma.has_access = true)
      )
    )
  )
);
