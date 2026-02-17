-- Fix the inventory_consumption_produced_goods view to include waste data
-- Previously, total_wasted was hardcoded as 0, now it properly aggregates from processed_goods_waste table

DROP VIEW IF EXISTS inventory_consumption_produced_goods;

CREATE VIEW inventory_consumption_produced_goods AS
SELECT 
    pgt.id AS tag_id,
    pgt.tag_key,
    pgt.display_name AS tag_name,
    COALESCE(MAX(pg.unit), 'units') AS default_unit,
    COALESCE(consumption.consumption_date, waste.waste_date) AS consumption_date,
    COALESCE(consumption.total_consumed, 0) AS total_consumed,
    COALESCE(waste.total_wasted, 0) AS total_wasted,
    COALESCE(consumption.consumption_transactions, 0) AS consumption_transactions,
    COALESCE(waste.waste_transactions, 0) AS waste_transactions
FROM produced_goods_tags pgt
LEFT JOIN processed_goods pg ON pg.produced_goods_tag_id = pgt.id
LEFT JOIN (
    -- Consumption from orders
    SELECT 
        pg.produced_goods_tag_id,
        DATE_TRUNC('day', o.order_date) AS consumption_date,
        SUM(oi.quantity) AS total_consumed,
        COUNT(DISTINCT oi.id) AS consumption_transactions
    FROM order_items oi
    JOIN processed_goods pg ON oi.processed_good_id = pg.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status <> 'CANCELLED'
    GROUP BY pg.produced_goods_tag_id, DATE_TRUNC('day', o.order_date)
) consumption ON consumption.produced_goods_tag_id = pgt.id
LEFT JOIN (
    -- Waste from processed_goods_waste
    SELECT 
        pg.produced_goods_tag_id,
        pgw.waste_date::timestamp with time zone AS waste_date,
        SUM(pgw.quantity_wasted) AS total_wasted,
        COUNT(DISTINCT pgw.id) AS waste_transactions
    FROM processed_goods_waste pgw
    JOIN processed_goods pg ON pgw.processed_good_id = pg.id
    GROUP BY pg.produced_goods_tag_id, pgw.waste_date
) waste ON waste.produced_goods_tag_id = pgt.id AND DATE_TRUNC('day', waste.waste_date) = consumption.consumption_date
WHERE consumption.consumption_date IS NOT NULL OR waste.waste_date IS NOT NULL
GROUP BY pgt.id, pgt.tag_key, pgt.display_name, consumption.consumption_date, waste.waste_date, consumption.total_consumed, waste.total_wasted, consumption.consumption_transactions, waste.waste_transactions;
