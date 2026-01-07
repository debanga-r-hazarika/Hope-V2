-- Helper query to check for duplicate lot_ids before applying the UNIQUE constraint
-- Run this query first to identify any duplicates that need to be fixed

-- Check for duplicate lot_ids in raw_materials
SELECT 
  lot_id, 
  COUNT(*) as count,
  array_agg(id::text) as record_ids,
  array_agg(name) as material_names
FROM raw_materials 
GROUP BY lot_id 
HAVING COUNT(*) > 1
ORDER BY lot_id;

-- Check for duplicate lot_ids in recurring_products
SELECT 
  lot_id, 
  COUNT(*) as count,
  array_agg(id::text) as record_ids,
  array_agg(name) as product_names
FROM recurring_products 
GROUP BY lot_id 
HAVING COUNT(*) > 1
ORDER BY lot_id;

-- If duplicates are found, you'll need to fix them manually before applying the UNIQUE constraint
-- Example fix: Update duplicate lot_ids to make them unique
-- UPDATE raw_materials SET lot_id = 'LOT-RM-XXX' WHERE id = 'specific-uuid';


