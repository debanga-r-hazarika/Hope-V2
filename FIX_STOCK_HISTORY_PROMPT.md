# PROMPT: Fix Stock Movement History Display - Chronological Ledger Accuracy

## Problem Statement

The stock movement history is displaying incorrect "Quantity Before" and "Quantity After" values in multiple sections of the application. The ledger-based stock system records all movements correctly, but the history display calculations are wrong.

## Expected Behavior (Example Scenario)

**Scenario:** Raw Material Lot LOT-01 with 240 bananas

1. **1-1-2026**: Initial intake of 240 bananas
   - Movement: IN (+240)
   - Balance After: 240

2. **1-1-2026**: Used 30 bananas in production batch
   - Movement: CONSUMPTION (-30)
   - Balance Before: 240
   - Balance After: 210

3. **3-1-2026**: Wasted 40 bananas (overripeness)
   - Movement: WASTE (-40)
   - Balance Before: 210
   - Balance After: 170

4. **5-1-2026**: Used 50 bananas in production batch
   - Movement: CONSUMPTION (-50)
   - Balance Before: 170
   - Balance After: 120

5. **7-1-2026**: Transferred 20 bananas to LOT-02
   - Movement: TRANSFER_OUT (-20)
   - Balance Before: 120
   - Balance After: 100

**Key Requirement:** Each history entry must show the correct running balance BEFORE and AFTER that specific movement, calculated from ALL movements in chronological order up to that point.

## Current Issues

### Issue 1: Wrong Quantity Before Calculations
- **Location 1:** `src/pages/WasteTransferManagement.tsx` - Waste Records table and card views
- **Location 2:** `src/pages/WasteTransferManagement.tsx` - Transfer Records table and card views  
- **Location 3:** `src/components/LotDetailsModal.tsx` - Waste/Transfer history in lot details
- **Problem:** Calculations are not properly accounting for:
  - Production batch consumptions (CONSUMPTION movements)
  - Chronological order of all movements
  - Movements that occurred on the same date but at different times

### Issue 2: Missing Production Batch Movements in History
- Production batch consumptions create CONSUMPTION movements in `stock_movements` table
- These movements are not being included when calculating "Quantity Before" for waste/transfer records
- The calculation should query `stock_movements` table directly, not reconstruct from waste/transfer records only

### Issue 3: Incorrect Date/Time Ordering
- When multiple movements occur on the same date, they must be ordered by `created_at` timestamp
- The current code may not be properly ordering movements that happen on the same day

## Required Fixes

### Fix 1: Use Stock Movements Table for Accurate Calculations

**Instead of:** Calculating from `quantity_received` and manually subtracting operations

**Do this:** Query `stock_movements` table directly and calculate running balance chronologically

```typescript
// Pseudo-code for correct calculation
async function getQuantityBefore(
  itemType: 'raw_material' | 'recurring_product',
  itemReference: string,
  effectiveDate: string,
  createdAt: string
): Promise<number> {
  // Get ALL movements up to (but not including) this specific movement
  // Order by effective_date, then created_at
  // Sum: IN/TRANSFER_IN = +quantity, CONSUMPTION/WASTE/TRANSFER_OUT = -quantity
}
```

### Fix 2: Include Production Batch Movements

**Current Problem:** Only waste and transfer records are considered when calculating history

**Required:** Query `stock_movements` table which includes:
- IN movements (initial intake)
- CONSUMPTION movements (production batches)
- WASTE movements (waste records)
- TRANSFER_OUT movements (transfers)
- TRANSFER_IN movements (transfers)

### Fix 3: Proper Chronological Ordering

**Required Ordering:**
1. First by `effective_date` (ascending)
2. Then by `created_at` (ascending) for same-date movements
3. This ensures movements are processed in the exact order they occurred

### Fix 4: Fix All Display Locations

**Locations to fix:**

1. **WasteTransferManagement.tsx - Waste Records Table** (around line 1020-1040)
   - Fix quantity before/after calculation for waste records in table view

2. **WasteTransferManagement.tsx - Waste Records Card View** (around line 1150-1170)
   - Fix quantity before/after calculation for waste records in card view

3. **WasteTransferManagement.tsx - Transfer Records Table** (around line 1820-1870)
   - Fix quantity before/after for FROM lot
   - Fix quantity before/after for TO lot

4. **WasteTransferManagement.tsx - Transfer Records Card View** (around line 2010-2070)
   - Fix quantity before/after for FROM lot
   - Fix quantity before/after for TO lot

5. **LotDetailsModal.tsx - Waste/Transfer History** (around line 130-160)
   - Fix quantity before/after calculation
   - Ensure production batch consumptions are included

## Implementation Approach

### Step 1: Create Helper Function

Create a reusable function that calculates balance at a specific point in time:

```typescript
// In src/lib/operations.ts
export async function getStockBalanceAt(
  itemType: 'raw_material' | 'recurring_product',
  itemReference: string,
  asOfDate: string,
  asOfCreatedAt?: string // For same-date ordering
): Promise<number> {
  // Query stock_movements table
  // Filter: item_type, item_reference, effective_date <= asOfDate
  // If asOfCreatedAt provided: also filter created_at <= asOfCreatedAt
  // Sum movements: IN/TRANSFER_IN = +, CONSUMPTION/WASTE/TRANSFER_OUT = -
  // Return calculated balance
}
```

### Step 2: Update All History Calculations

Replace all manual calculations with calls to `getStockBalanceAt()`:

```typescript
// For waste record
const quantityBefore = await getStockBalanceAt(
  record.lot_type,
  record.lot_id,
  record.waste_date,
  record.created_at // Use created_at - 1ms to exclude this waste movement
);

const quantityAfter = quantityBefore - record.quantity_wasted;
```

### Step 3: Ensure Production Batches Are Included

Verify that when production batches consume materials, they create CONSUMPTION movements in `stock_movements` table. The helper function will automatically include them.

## Testing Requirements

After fixes, verify:

1. **Initial Intake:** Shows correct quantity (e.g., 240)
2. **After Production Batch 1:** Shows 210 (240 - 30)
3. **After Waste:** Shows 170 (210 - 40)
4. **After Production Batch 2:** Shows 120 (170 - 50)
5. **After Transfer:** Shows 100 (120 - 20)

6. **Same Date Movements:** If multiple movements occur on same date, they must be ordered correctly by `created_at`

7. **All Sections:** Verify correct display in:
   - Waste & Transfer Management → Waste Records table
   - Waste & Transfer Management → Waste Records cards
   - Waste & Transfer Management → Transfer Records table
   - Waste & Transfer Management → Transfer Records cards
   - Raw Materials → Lot Details → History tab
   - Recurring Products → Lot Details → History tab

## Database Query Example

```sql
-- Get all movements up to a specific point in time
SELECT 
  movement_type,
  quantity,
  effective_date,
  created_at
FROM stock_movements
WHERE item_type = 'raw_material'
  AND item_reference = 'lot-uuid'
  AND (
    effective_date < '2026-01-03'
    OR (effective_date = '2026-01-03' AND created_at < '2026-01-03 10:00:00')
  )
ORDER BY effective_date ASC, created_at ASC;

-- Then calculate: SUM(CASE WHEN movement_type IN ('IN', 'TRANSFER_IN') THEN quantity ELSE -quantity END)
```

## Expected Outcome

After fixes:
- ✅ All history entries show correct "Quantity Before" (balance before that movement)
- ✅ All history entries show correct "Quantity After" (balance after that movement)
- ✅ Production batch consumptions are included in calculations
- ✅ Movements are ordered chronologically (date, then time)
- ✅ Running balance is accurate at every point in time
- ✅ Same behavior across all display locations (tables, cards, modals)

## Additional Notes

- The `stock_movements` table is the source of truth
- All movements are immutable (cannot be edited/deleted)
- Current `quantity_available` in `raw_materials`/`recurring_products` tables is calculated from movements
- History display should always query `stock_movements` directly, not rely on `quantity_available` field
