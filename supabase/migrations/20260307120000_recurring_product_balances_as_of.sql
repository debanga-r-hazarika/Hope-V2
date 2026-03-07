-- Return recurring product balances as of a given date (for Packaging step: show availability for batch date)
CREATE OR REPLACE FUNCTION get_recurring_product_balances_as_of(p_as_of_date date)
RETURNS TABLE (id uuid, balance numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    rp.id,
    COALESCE(SUM(
      CASE
        WHEN sm.movement_type IN ('IN', 'TRANSFER_IN') THEN sm.quantity
        WHEN sm.movement_type IN ('CONSUMPTION', 'WASTE', 'TRANSFER_OUT') THEN -sm.quantity
        ELSE 0
      END
    ), 0)::numeric AS balance
  FROM recurring_products rp
  LEFT JOIN stock_movements sm
    ON sm.item_type = 'recurring_product'
   AND sm.item_reference = rp.id
   AND sm.effective_date <= p_as_of_date
  GROUP BY rp.id;
$$;

COMMENT ON FUNCTION get_recurring_product_balances_as_of(date) IS 'Used by Production Packaging step to show availability as of batch date';
