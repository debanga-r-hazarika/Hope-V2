# PDF Export - Detailed Lot/Batch Information

## Issue
The PDF export was only showing summary information (tag-level aggregates) but not the detailed lot/batch breakdown with Usable/Unusable status and Collected By information.

## Solution Implemented

### 1. Data Fetching Enhancement
**File**: `src/pages/InventoryAnalytics.tsx` - `handleExportReport()` function

Added comprehensive data fetching for all lot/batch details:

```typescript
// Fetch ALL lots for each unique tag
const allRawMaterialLots: any[] = [];
const processedTagIds = new Set<string>();

for (const tag of rawMaterialsData) {
  // Skip duplicates (usable/unusable are separate rows)
  if (processedTagIds.has(tag.tag_id)) continue;
  processedTagIds.add(tag.tag_id);
  
  // Fetch ALL lots (both usable and unusable)
  const lots = await fetchRawMaterialLotDetails(tag.tag_id);
  lots.forEach(lot => {
    allRawMaterialLots.push({
      tag_name: tag.tag_name,
      tag_id: tag.tag_id,
      ...lot // includes: lot_id, usable, collected_by_name, supplier_name, etc.
    });
  });
}
```

**Key Fix**: 
- Don't pass `tag.usable` filter to `fetchRawMaterialLotDetails()`
- Fetch ALL lots for each tag (both usable and unusable)
- Use `Set` to avoid processing same tag_id twice (since raw materials have separate rows for usable/unusable)

### 2. PDF Component Enhancement
**File**: `src/components/InventoryReportPDF.tsx`

Added new section after "Current Stock Status":

#### Raw Material Lots - Detailed Breakdown

**Columns**:
1. Tag - The tag name (e.g., "Banana Peel")
2. Lot ID - The lot identifier (e.g., "LOT-RM-020")
3. **Status** - "Usable" (green) or "Unusable" (amber)
4. Available - Current quantity available
5. Received - Date received
6. **Supplier / Collected By** - Shows supplier name OR collected_by_name

**Color Coding**:
- Usable: Green (#10b981)
- Unusable: Amber (#f59e0b)

```typescript
<Text style={[styles.col, { width: '10%', fontSize: 7, color: lot.usable ? '#10b981' : '#f59e0b' }]}>
    {lot.usable ? 'Usable' : 'Unusable'}
</Text>
```

**Collected By Display**:
```typescript
<Text style={[styles.col, styles.lastCol, { width: '25%', fontSize: 7 }]}>
    {lot.supplier_name || lot.collected_by_name || 'N/A'}
</Text>
```

### 3. Similar Sections for Other Inventory Types

#### Recurring Product Lots - Detailed Breakdown
Shows: Tag, Lot ID, Item Name, Available, Received

#### Produced Goods Batches - Detailed Breakdown
Shows: Tag, Batch ID, Total Created, Available (green), Production Date

## PDF Structure (After Fix)

For Raw Materials Report:

1. **Current Stock Status** (Summary by tag)
2. **Raw Material Lots - Detailed Breakdown** ⭐ NEW
   - Every lot with Usable/Unusable status
   - Collected By information
3. **New Stock Added** (Period-specific)
4. **Critical Alerts** (Out of Stock / Low Stock)
5. **Consumption & Waste**

## Testing Steps

1. **Clear browser cache** and reload the application
2. Navigate to Inventory Analytics
3. Click "Export Report" button
4. Check console for log: `PDF Export Data: { rawMaterialLots: X, recurringLots: Y, batches: Z }`
5. Open generated PDF
6. Verify "Raw Material Lots - Detailed Breakdown" section appears
7. Verify each lot shows:
   - ✅ Usable/Unusable status (color-coded)
   - ✅ Collected By name (if available)
   - ✅ Supplier name (if available)
   - ✅ All other lot details

## Debugging

If the detailed section still doesn't appear:

1. **Check Console Logs**:
   ```
   PDF Export Data: { rawMaterialLots: 0, recurringLots: 0, batches: 0 }
   ```
   If all are 0, the data fetching is failing.

2. **Check for Errors**:
   Look for console errors like:
   ```
   Failed to fetch lots for tag Banana Peel: [error details]
   ```

3. **Verify Database Query**:
   The `fetchRawMaterialLotDetails()` function queries:
   ```sql
   SELECT id, name, lot_id, quantity_available, unit, received_date, usable, 
          storage_notes, suppliers(name), 
          created_by_user:auth_users!raw_materials_created_by_fkey(full_name)
   FROM raw_materials
   WHERE raw_material_tag_id = ? AND quantity_available > 0
   ```

4. **Check RLS Policies**:
   Ensure the user has read access to:
   - `raw_materials` table
   - `auth_users` table (for collected_by_name)
   - `suppliers` table

## Files Modified

1. `src/pages/InventoryAnalytics.tsx`
   - Enhanced `handleExportReport()` to fetch all lot/batch details
   - Added console logging for debugging
   - Fixed duplicate tag processing

2. `src/components/InventoryReportPDF.tsx`
   - Added `rawMaterialLots`, `recurringProductLots`, `producedGoodsBatches` props
   - Added detailed breakdown sections for each inventory type
   - Implemented color-coded status display
   - Added Collected By field display

3. `src/lib/inventory-analytics.ts`
   - Already updated to fetch `collected_by_name` via auth_users join

4. `src/types/inventory-analytics.ts`
   - Already updated with `collected_by_name` field in `RawMaterialLotDetail`

## Expected Result

The PDF should now show comprehensive details for every lot/batch, making it a complete inventory report suitable for auditing, compliance, and detailed stock analysis.
