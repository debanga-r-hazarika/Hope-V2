-- Update production_date for existing processed goods to match their batch's production_end_date
UPDATE processed_goods
SET production_date = pb.production_end_date
FROM production_batches pb
WHERE processed_goods.batch_id = pb.id
  AND pb.production_end_date IS NOT NULL
  AND processed_goods.production_date != pb.production_end_date;