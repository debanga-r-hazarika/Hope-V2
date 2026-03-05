-- Add archived_at and archived_by to raw_materials for log visibility
ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_raw_materials_archived_at ON raw_materials(archived_at) WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN raw_materials.archived_at IS 'When the lot was archived (soft delete). Used for raw material log.';
COMMENT ON COLUMN raw_materials.archived_by IS 'User who archived the lot.';

-- View: unified raw material log (created, archived, production use, waste, transfer, transform)
-- Event types: created, archived, production_use, waste, transfer_out, transfer_in, transform
CREATE OR REPLACE VIEW raw_material_log AS
-- 1) Created: from stock_movements (IN + initial_intake)
SELECT
  sm.id AS log_id,
  sm.item_reference AS raw_material_id,
  sm.lot_reference AS lot_id,
  rm.name AS lot_name,
  rm.raw_material_tag_id,
  'created' AS event_type,
  sm.quantity,
  sm.unit,
  sm.effective_date,
  sm.created_at,
  sm.created_by,
  sm.notes,
  sm.reference_id,
  sm.reference_type
FROM stock_movements sm
LEFT JOIN raw_materials rm ON rm.id = sm.item_reference
WHERE sm.item_type = 'raw_material'
  AND sm.reference_type = 'initial_intake'

UNION ALL

-- 2) Archived: from raw_materials
SELECT
  rm.id AS log_id,
  rm.id AS raw_material_id,
  rm.lot_id,
  rm.name AS lot_name,
  rm.raw_material_tag_id,
  'archived' AS event_type,
  rm.quantity_available AS quantity,
  rm.unit,
  (rm.archived_at)::date AS effective_date,
  rm.archived_at AS created_at,
  rm.archived_by AS created_by,
  'Lot archived' AS notes,
  NULL::uuid AS reference_id,
  'archived' AS reference_type
FROM raw_materials rm
WHERE rm.archived_at IS NOT NULL

UNION ALL

-- 3) Production use, waste, transfer, transform: from stock_movements with mapped event_type
SELECT
  sm.id AS log_id,
  sm.item_reference AS raw_material_id,
  sm.lot_reference AS lot_id,
  rm.name AS lot_name,
  rm.raw_material_tag_id,
  CASE
    WHEN sm.reference_type = 'production_batch' AND sm.movement_type = 'CONSUMPTION' THEN 'production_use'
    WHEN sm.movement_type = 'WASTE' THEN 'waste'
    WHEN sm.movement_type = 'TRANSFER_OUT' THEN 'transfer_out'
    WHEN sm.movement_type = 'TRANSFER_IN' THEN 'transfer_in'
    WHEN sm.reference_type = 'raw_material_transformation' THEN 'transform'
    ELSE NULL
  END AS event_type,
  sm.quantity,
  sm.unit,
  sm.effective_date,
  sm.created_at,
  sm.created_by,
  sm.notes,
  sm.reference_id,
  sm.reference_type
FROM stock_movements sm
LEFT JOIN raw_materials rm ON rm.id = sm.item_reference
WHERE sm.item_type = 'raw_material'
  AND (
    (sm.reference_type = 'production_batch' AND sm.movement_type = 'CONSUMPTION')
    OR sm.movement_type = 'WASTE'
    OR sm.movement_type IN ('TRANSFER_OUT', 'TRANSFER_IN')
    OR sm.reference_type = 'raw_material_transformation'
  );

COMMENT ON VIEW raw_material_log IS 'Unified log of raw material events: created, archived, production_use, waste, transfer_out, transfer_in, transform.';
