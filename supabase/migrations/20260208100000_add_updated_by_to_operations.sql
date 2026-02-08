/*
  # Add updated_by tracking to Operations Module
  
  Adds updated_by field to track who last edited records in:
  - suppliers
  - raw_materials
  - recurring_products
  - machines
*/

-- Add updated_by to suppliers
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add updated_by to raw_materials
ALTER TABLE raw_materials
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add updated_by to recurring_products
ALTER TABLE recurring_products
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add updated_by to machines
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill existing records with created_by as initial updated_by (only if user exists)
UPDATE suppliers 
SET updated_by = created_by 
WHERE updated_by IS NULL 
  AND created_by IS NOT NULL 
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = suppliers.created_by);

UPDATE raw_materials 
SET updated_by = created_by 
WHERE updated_by IS NULL 
  AND created_by IS NOT NULL 
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = raw_materials.created_by);

UPDATE recurring_products 
SET updated_by = created_by 
WHERE updated_by IS NULL 
  AND created_by IS NOT NULL 
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = recurring_products.created_by);

UPDATE machines 
SET updated_by = created_by 
WHERE updated_by IS NULL 
  AND created_by IS NOT NULL 
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = machines.created_by);

-- Create trigger function to automatically set updated_by on UPDATE
CREATE OR REPLACE FUNCTION set_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to set updated_by on INSERT (same as created_by initially)
CREATE OR REPLACE FUNCTION set_updated_by_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create UPDATE triggers for each table
DROP TRIGGER IF EXISTS set_suppliers_updated_by ON suppliers;
CREATE TRIGGER set_suppliers_updated_by
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

DROP TRIGGER IF EXISTS set_raw_materials_updated_by ON raw_materials;
CREATE TRIGGER set_raw_materials_updated_by
  BEFORE UPDATE ON raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

DROP TRIGGER IF EXISTS set_recurring_products_updated_by ON recurring_products;
CREATE TRIGGER set_recurring_products_updated_by
  BEFORE UPDATE ON recurring_products
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

DROP TRIGGER IF EXISTS set_machines_updated_by ON machines;
CREATE TRIGGER set_machines_updated_by
  BEFORE UPDATE ON machines
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

-- Create INSERT triggers to set updated_by initially
DROP TRIGGER IF EXISTS set_suppliers_updated_by_on_insert ON suppliers;
CREATE TRIGGER set_suppliers_updated_by_on_insert
  BEFORE INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by_on_insert();

DROP TRIGGER IF EXISTS set_raw_materials_updated_by_on_insert ON raw_materials;
CREATE TRIGGER set_raw_materials_updated_by_on_insert
  BEFORE INSERT ON raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by_on_insert();

DROP TRIGGER IF EXISTS set_recurring_products_updated_by_on_insert ON recurring_products;
CREATE TRIGGER set_recurring_products_updated_by_on_insert
  BEFORE INSERT ON recurring_products
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by_on_insert();

DROP TRIGGER IF EXISTS set_machines_updated_by_on_insert ON machines;
CREATE TRIGGER set_machines_updated_by_on_insert
  BEFORE INSERT ON machines
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by_on_insert();
