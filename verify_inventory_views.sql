-- Verification Script for Inventory Analytics Views
-- Run this in Supabase SQL Editor to check if migration was successful

-- 1. Check if all views exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✓ Exists'
    ELSE '✗ Missing'
  END as status
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN (
  'inventory_raw_materials_by_tag',
  'inventory_recurring_products_by_tag',
  'inventory_produced_goods_by_tag',
  'inventory_out_of_stock',
  'inventory_low_stock',
  'inventory_consumption_raw_materials',
  'inventory_consumption_recurring_products',
  'inventory_consumption_produced_goods'
)
ORDER BY table_name;

-- 2. Check if threshold table exists
SELECT 
  'inventory_low_stock_thresholds' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'inventory_low_stock_thresholds'
    ) THEN '✓ Exists'
    ELSE '✗ Missing'
  END as status;

-- 3. Test a simple query on each view (should return 0 rows if no data, but no errors)
SELECT 'Testing inventory_raw_materials_by_tag' as test, COUNT(*) as row_count 
FROM inventory_raw_materials_by_tag
UNION ALL
SELECT 'Testing inventory_recurring_products_by_tag', COUNT(*) 
FROM inventory_recurring_products_by_tag
UNION ALL
SELECT 'Testing inventory_produced_goods_by_tag', COUNT(*) 
FROM inventory_produced_goods_by_tag
UNION ALL
SELECT 'Testing inventory_out_of_stock', COUNT(*) 
FROM inventory_out_of_stock
UNION ALL
SELECT 'Testing inventory_low_stock', COUNT(*) 
FROM inventory_low_stock
UNION ALL
SELECT 'Testing inventory_consumption_raw_materials', COUNT(*) 
FROM inventory_consumption_raw_materials
UNION ALL
SELECT 'Testing inventory_consumption_recurring_products', COUNT(*) 
FROM inventory_consumption_recurring_products
UNION ALL
SELECT 'Testing inventory_consumption_produced_goods', COUNT(*) 
FROM inventory_consumption_produced_goods;

-- If all queries above run without errors, the migration was successful!
