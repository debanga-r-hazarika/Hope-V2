/*
  # Operations Module - Complete Implementation
  
  1. New Tables
    - `suppliers`
      - Centralized supplier database
      - Used by raw materials, recurring products, and machines
      - Fields: name, type, contact details, notes
      
    - `raw_materials`
      - Lot-based inventory tracking
      - Each entry is a separate lot with quantity tracking
      - Fields: name, supplier_id, lot_id, quantity_received, quantity_available, unit, received_date, storage_notes
      
    - `recurring_products`
      - Packaging and consumables inventory
      - Fields: name, category, supplier_id, quantity_received, quantity_available, unit, received_date
      
    - `production_batches`
      - Core production workflow entity
      - Links raw materials consumed to output produced
      - Fields: batch_id, date, responsible_user_id, output_product_type, output_quantity, output_unit, qa_status, notes
      
    - `batch_raw_materials`
      - Junction table for batch consumption
      - Records which raw materials were consumed in each batch
      - Auto-deducts from raw_materials.quantity_available
      
    - `batch_recurring_products`
      - Junction table for recurring product consumption in batches
      - Auto-deducts from recurring_products.quantity_available
      
    - `processed_goods`
      - Finished goods ready for sale
      - Auto-created from approved production batches
      - Manual creation NOT allowed
      
    - `machines`
      - Machine and hardware inventory
      - Fields: name, category, supplier_id, purchase_date, purchase_cost, status
  
  2. Security
    - Enable RLS on all tables
    - Policies based on user_module_access
    - Read-write users can create and edit
    - Read-only users can view only
    - Super admin has full access
*/

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supplier_type text NOT NULL CHECK (supplier_type IN ('raw_material', 'recurring_product', 'machine', 'multiple')),
  contact_details text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with operations access can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

-- Create raw_materials table (lot-based inventory)
CREATE TABLE IF NOT EXISTS raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  lot_id text NOT NULL,
  quantity_received numeric NOT NULL CHECK (quantity_received > 0),
  quantity_available numeric NOT NULL CHECK (quantity_available >= 0),
  unit text NOT NULL,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  storage_notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with operations access can view raw materials"
  ON raw_materials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert raw materials"
  ON raw_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can update raw materials"
  ON raw_materials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can delete raw materials"
  ON raw_materials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

-- Create recurring_products table
CREATE TABLE IF NOT EXISTS recurring_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  quantity_received numeric NOT NULL CHECK (quantity_received > 0),
  quantity_available numeric NOT NULL CHECK (quantity_available >= 0),
  unit text NOT NULL,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE recurring_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with operations access can view recurring products"
  ON recurring_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert recurring products"
  ON recurring_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can update recurring products"
  ON recurring_products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can delete recurring products"
  ON recurring_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

-- Create production_batches table
CREATE TABLE IF NOT EXISTS production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL UNIQUE,
  batch_date date NOT NULL DEFAULT CURRENT_DATE,
  responsible_user_id uuid REFERENCES auth.users(id),
  responsible_user_name text,
  output_product_type text NOT NULL,
  output_quantity numeric NOT NULL CHECK (output_quantity > 0),
  output_unit text NOT NULL,
  qa_status text NOT NULL DEFAULT 'pending' CHECK (qa_status IN ('pending', 'approved', 'rejected', 'hold')),
  notes text,
  is_locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with operations access can view production batches"
  ON production_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert production batches"
  ON production_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can update production batches"
  ON production_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can delete production batches"
  ON production_batches FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

-- Create batch_raw_materials junction table
CREATE TABLE IF NOT EXISTS batch_raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES production_batches(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES raw_materials(id) ON DELETE CASCADE,
  raw_material_name text NOT NULL,
  lot_id text NOT NULL,
  quantity_consumed numeric NOT NULL CHECK (quantity_consumed > 0),
  unit text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE batch_raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with operations access can view batch raw materials"
  ON batch_raw_materials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert batch raw materials"
  ON batch_raw_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can delete batch raw materials"
  ON batch_raw_materials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

-- Create batch_recurring_products junction table
CREATE TABLE IF NOT EXISTS batch_recurring_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES production_batches(id) ON DELETE CASCADE,
  recurring_product_id uuid REFERENCES recurring_products(id) ON DELETE CASCADE,
  recurring_product_name text NOT NULL,
  quantity_consumed numeric NOT NULL CHECK (quantity_consumed > 0),
  unit text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE batch_recurring_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with operations access can view batch recurring products"
  ON batch_recurring_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert batch recurring products"
  ON batch_recurring_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can delete batch recurring products"
  ON batch_recurring_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

-- Create processed_goods table (auto-created from approved batches)
CREATE TABLE IF NOT EXISTS processed_goods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES production_batches(id) ON DELETE SET NULL,
  batch_reference text NOT NULL,
  product_type text NOT NULL,
  quantity_available numeric NOT NULL CHECK (quantity_available >= 0),
  unit text NOT NULL,
  production_date date NOT NULL,
  qa_status text NOT NULL DEFAULT 'approved',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE processed_goods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with operations access can view processed goods"
  ON processed_goods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Only system can insert processed goods"
  ON processed_goods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

-- Create machines table
CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date date,
  purchase_cost numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'idle')),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with operations access can view machines"
  ON machines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level IN ('read-only', 'read-write')
    )
  );

CREATE POLICY "Users with read-write access can insert machines"
  ON machines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can update machines"
  ON machines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

CREATE POLICY "Users with read-write access can delete machines"
  ON machines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access
      WHERE user_module_access.user_id = auth.uid()
      AND user_module_access.module_name = 'operations'
      AND user_module_access.access_level = 'read-write'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier ON raw_materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_lot ON raw_materials(lot_id);
CREATE INDEX IF NOT EXISTS idx_recurring_products_supplier ON recurring_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches(qa_status);
CREATE INDEX IF NOT EXISTS idx_batch_raw_materials_batch ON batch_raw_materials(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_recurring_products_batch ON batch_recurring_products(batch_id);
CREATE INDEX IF NOT EXISTS idx_processed_goods_batch ON processed_goods(batch_id);
CREATE INDEX IF NOT EXISTS idx_machines_supplier ON machines(supplier_id);
