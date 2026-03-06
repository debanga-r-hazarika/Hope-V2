-- Fix stock_movements.created_by to reference users(id) instead of auth.users(id)
-- Aligns with other operations tables (raw_materials, suppliers, etc.) and how the app passes user IDs

-- 1. Drop old FK so we can change column values
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;

-- 2. Migrate existing data: convert auth.users.id to users.id where mappable
UPDATE stock_movements sm
SET created_by = u.id
FROM users u
WHERE u.auth_user_id = sm.created_by
  AND sm.created_by IS NOT NULL;

-- 3. Set to NULL where we couldn't map (orphaned auth user ids or invalid refs)
UPDATE stock_movements
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = stock_movements.created_by);

-- 4. Add new FK to users(id)
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;
