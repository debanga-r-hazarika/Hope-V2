/*
  # Fix Operations Module Foreign Key References

  1. Issue
    - All operations tables have `created_by` column referencing `auth.users(id)`
    - However, the application passes user IDs from the `users` table (profile IDs)
    - This causes foreign key constraint violations when inserting data
    
  2. Fix
    - Drop existing foreign key constraints on `created_by` columns
    - Add new foreign key constraints referencing `users(id)` instead
    - This aligns with how the application manages user references
    
  3. Tables Updated
    - suppliers
    - raw_materials
    - production_batches
    - machines
*/

-- Fix suppliers table
ALTER TABLE suppliers 
  DROP CONSTRAINT IF EXISTS suppliers_created_by_fkey;

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

-- Fix raw_materials table
ALTER TABLE raw_materials 
  DROP CONSTRAINT IF EXISTS raw_materials_created_by_fkey;

ALTER TABLE raw_materials
  ADD CONSTRAINT raw_materials_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

-- Fix production_batches table
ALTER TABLE production_batches 
  DROP CONSTRAINT IF EXISTS production_batches_created_by_fkey;

ALTER TABLE production_batches
  ADD CONSTRAINT production_batches_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

-- Fix machines table
ALTER TABLE machines 
  DROP CONSTRAINT IF EXISTS machines_created_by_fkey;

ALTER TABLE machines
  ADD CONSTRAINT machines_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES users(id) 
  ON DELETE SET NULL;
