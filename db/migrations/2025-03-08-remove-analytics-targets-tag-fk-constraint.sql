-- Remove restrictive foreign key constraint on analytics_targets.tag_id
-- The tag_id column needs to reference different tables based on tag_type:
-- - raw_material_tags when tag_type = 'raw_material'
-- - recurring_product_tags when tag_type = 'recurring_product'  
-- - produced_goods_tags when tag_type = 'produced_goods'
--
-- PostgreSQL doesn't support conditional foreign keys, so we remove the constraint
-- and rely on application-level validation to ensure referential integrity.

ALTER TABLE analytics_targets 
DROP CONSTRAINT IF EXISTS analytics_targets_tag_id_fkey;

-- Add a comment to document the polymorphic relationship
COMMENT ON COLUMN analytics_targets.tag_id IS 
'Polymorphic reference to tag tables. References:
- raw_material_tags.id when tag_type = ''raw_material''
- recurring_product_tags.id when tag_type = ''recurring_product''
- produced_goods_tags.id when tag_type = ''produced_goods''
Application code must validate referential integrity.';
