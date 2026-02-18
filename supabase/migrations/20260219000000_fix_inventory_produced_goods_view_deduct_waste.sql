-- Fix inventory_produced_goods_by_tag view to deduct waste from current_balance
-- This ensures Analytics shows actual available quantity (quantity_available - waste)
-- 
-- Issue: The view was showing total quantity_available without deducting waste,
-- causing Analytics to show 76 bottles when only 8 were actually available
-- (68 bottles had been recorded as waste)

DROP VIEW IF EXISTS inventory_produced_goods_by_tag CASCADE;

CREATE VIEW inventory_produced_goods_by_tag AS
SELECT 
    pgt.id AS tag_id,
    pgt.tag_key,
    pgt.display_name AS tag_name,
    COALESCE(MAX(pg.unit), 'units') AS default_unit,
    -- Deduct waste from quantity_available to get actual current balance
    COALESCE(
        SUM(
            pg.quantity_available - COALESCE(
                (SELECT SUM(pgw.quantity_wasted) 
                 FROM processed_goods_waste pgw 
                 WHERE pgw.processed_good_id = pg.id),
                0
            )
        ),
        0
    ) AS current_balance,
    -- Count only items that have actual available quantity after waste deduction
    COUNT(DISTINCT pg.id) FILTER (
        WHERE (
            pg.quantity_available - COALESCE(
                (SELECT SUM(pgw.quantity_wasted) 
                 FROM processed_goods_waste pgw 
                 WHERE pgw.processed_good_id = pg.id),
                0
            )
        ) > 0
    ) AS item_count,
    MAX(pg.production_date) AS last_production_date
FROM produced_goods_tags pgt
LEFT JOIN processed_goods pg ON pg.produced_goods_tag_id = pgt.id
GROUP BY pgt.id, pgt.tag_key, pgt.display_name;
