# Stock Movement Serial Ordering - Implementation Summary

## Overview

All stock movements (waste, transfer, production batch consumption) are now tracked with accurate timestamps to ensure proper serial/chronological ordering of transactions.

## Key Implementation Details

### 1. Movement Creation with Timestamp Control

**Function:** `createStockMovement()`
- Accepts optional `created_at` parameter for explicit timestamp control
- If not provided, uses current timestamp automatically
- Ensures all movements have accurate `created_at` timestamps

### 2. Serial Ordering Rules

**Ordering Priority:**
1. **Primary:** `effective_date` (business date) - ascending
2. **Secondary:** `created_at` (timestamp) - ascending
3. This ensures movements on the same date are ordered by creation time

### 3. Movement Creation Sequence

#### Waste Records
1. Create waste record in `waste_tracking` table
2. Get waste record's `created_at` timestamp
3. Create WASTE movement with `created_at = waste_record.created_at + 1ms`
4. **Result:** Movement comes immediately after waste record in chronological order

#### Transfer Records
1. Create transfer record in `transfer_tracking` table
2. Get transfer record's `created_at` timestamp
3. Create TRANSFER_OUT movement with `created_at = transfer_record.created_at + 1ms`
4. Create TRANSFER_IN movement with `created_at = transfer_record.created_at + 2ms`
5. **Result:** TRANSFER_OUT comes before TRANSFER_IN, both after transfer record

#### Production Batch Consumption
1. Create `batch_raw_materials` or `batch_recurring_products` record
2. Immediately create CONSUMPTION movement with current timestamp
3. **Result:** Movement is created right after batch material record

#### Initial Intake
1. Create raw material or recurring product record
2. Get record's `created_at` timestamp
3. Create IN movement with `created_at = record.created_at + 1ms`
4. **Result:** Movement comes immediately after lot creation

### 4. Complete Movement History Function

**New Function:** `getCompleteStockMovementHistory()`
- Returns all movements in chronological order
- Includes running balance calculation
- Properly ordered by `effective_date` then `created_at`
- Useful for audit logs and history displays

## Movement Types Tracked

All movement types are tracked in `stock_movements` table:

1. **IN** - Initial intake when lot is created
2. **CONSUMPTION** - Production batch consumption
3. **WASTE** - Waste records
4. **TRANSFER_OUT** - Transfer from source lot
5. **TRANSFER_IN** - Transfer to destination lot

## Chronological Ordering Example

For your scenario (240 bananas):

```
1. 2026-01-01 10:00:00 - IN (+240)           → Balance: 240
2. 2026-01-01 10:05:00 - CONSUMPTION (-30)   → Balance: 210
3. 2026-01-03 14:00:00 - WASTE (-40)         → Balance: 170
4. 2026-01-05 09:00:00 - CONSUMPTION (-50)   → Balance: 120
5. 2026-01-07 11:00:00 - TRANSFER_OUT (-20)  → Balance: 100
```

Each movement has:
- `effective_date`: Business date (2026-01-01, 2026-01-03, etc.)
- `created_at`: Exact timestamp for ordering (10:00:00, 10:05:00, etc.)
- `reference_id`: Links to waste_tracking.id, transfer_tracking.id, or production_batches.id
- `reference_type`: Type of reference for filtering

## Benefits

1. **Accurate Serial Ordering:** Movements are ordered by date and time
2. **Complete Audit Trail:** Every transaction is recorded immutably
3. **Proper Balance Calculation:** Running balances are accurate at every point
4. **Chronological History:** History displays show correct order of operations
5. **Reference Tracking:** Each movement links to its source record

## Database Query for Movement History

```sql
SELECT 
  movement_type,
  quantity,
  effective_date,
  created_at,
  reference_id,
  reference_type,
  notes
FROM stock_movements
WHERE item_type = 'raw_material'
  AND item_reference = 'lot-uuid'
ORDER BY effective_date ASC, created_at ASC;
```

This query ensures movements are returned in the exact order they occurred, maintaining serial transaction order.

## Testing the Serial Ordering

To verify movements are created in correct order:

1. Create a raw material lot → Check IN movement created
2. Add to production batch → Check CONSUMPTION movement created
3. Record waste → Check WASTE movement created
4. Transfer between lots → Check TRANSFER_OUT and TRANSFER_IN movements created

All movements should appear in chronological order when queried, and running balances should be accurate at each point.
