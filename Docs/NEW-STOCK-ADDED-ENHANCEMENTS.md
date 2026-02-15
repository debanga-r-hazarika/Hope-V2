# New Stock Added Section - Enhanced with Usable/Unusable and Collected By

## Overview
Enhanced the "New Stock Added" section in the PDF report to show Usable/Unusable status and Collected By information for raw materials.

## Changes Made

### 1. Type Definition Update
**File**: `src/types/inventory-analytics.ts`

Added `collected_by` field to `NewStockArrival` interface:

```typescript
export interface NewStockArrival {
  inventory_type: InventoryType;
  item_name: string;
  lot_batch_id: string;
  quantity: number;
  unit: string;
  date: string;
  supplier?: string;
  usable?: boolean; // For raw materials
  collected_by?: string; // NEW - For raw materials
}
```

### 2. Data Fetching Enhancement
**File**: `src/lib/inventory-analytics.ts` - `fetchNewStockArrivals()` function

Updated raw materials query to fetch collected_by user name:

```typescript
.select(`
  name,
  lot_id,
  quantity_received,
  unit,
  received_date,
  usable,
  suppliers(name),
  created_by_user:users!raw_materials_created_by_fkey(full_name)  // NEW
`)
```

Maps to result:
```typescript
{
  // ... other fields
  usable: item.usable,
  collected_by: item.created_by_user?.full_name  // NEW
}
```

### 3. PDF Display Enhancement
**File**: `src/components/InventoryReportPDF.tsx`

Updated "New Stock Added" section to show different columns based on inventory type:

#### For Raw Materials:
**Columns**:
1. Date (12%)
2. Item (20%)
3. Lot ID (12%)
4. **Status (10%)** - "Usable" (green) or "Unusable" (amber)
5. Quantity (15%)
6. Supplier (15%)
7. **Collected By (16%)** - Name of user who collected/created

**Color Coding**:
```typescript
<Text style={{ color: item.usable ? '#10b981' : '#f59e0b' }}>
  {item.usable ? 'Usable' : 'Unusable'}
</Text>
```

#### For Other Inventory Types (Recurring Products, Produced Goods):
**Columns** (unchanged):
1. Date (25%)
2. Item / Description (35%)
3. Lot/Batch (20%)
4. Quantity (20%)

## Visual Comparison

### Before:
```
| Date       | Item / Description    | Lot/Batch  | Quantity      |
|------------|-----------------------|------------|---------------|
| 10 Feb 2026| Banana peel- 12/01/26 | LOT-RM-020 | 220.00 Pieces |
```

### After (Raw Materials):
```
| Date    | Item          | Lot ID     | Status   | Quantity      | Supplier | Collected By |
|---------|---------------|------------|----------|---------------|----------|--------------|
| 10 Feb  | Banana peel-  | LOT-RM-020 | Usable   | 220.00 Pieces | ABC Ltd  | John Doe     |
|         | 12/01/26      |            | (green)  |               |          |              |
```

## Benefits

1. **Complete Traceability**: Shows who collected each raw material lot
2. **Quality Visibility**: Immediately see which new stock is usable vs unusable
3. **Audit Trail**: Full information for compliance and quality control
4. **Consistent Information**: Same fields shown in both "New Stock Added" and "Detailed Breakdown" sections

## Database Requirements

The query joins with the `users` table to get the collector's name:
- Requires foreign key: `raw_materials.created_by` → `users.id`
- Requires RLS policy allowing read access to `users.full_name`

## Testing Checklist

- ✅ Type definition includes `collected_by` field
- ✅ `fetchNewStockArrivals()` fetches collected_by for raw materials
- ✅ PDF shows different columns for raw materials vs other types
- ✅ Status column shows "Usable" (green) or "Unusable" (amber)
- ✅ Collected By column shows user's full name
- ✅ Supplier column shows supplier name
- ✅ Other inventory types still show standard 4-column layout
- ✅ No TypeScript errors

## Files Modified

1. `src/types/inventory-analytics.ts` - Added `collected_by` field
2. `src/lib/inventory-analytics.ts` - Updated query to fetch collected_by
3. `src/components/InventoryReportPDF.tsx` - Enhanced PDF display with conditional columns

## Related Documentation

- `PDF-EXPORT-DETAILED-LOTS.md` - Detailed lot/batch breakdown section
- `INVENTORY-ANALYTICS-IMPROVEMENTS.md` - Overall inventory analytics enhancements
