# Usable/Unusable Raw Materials Feature

## Overview

The Inventory Analytics module now separates raw materials into two distinct categories: **Usable** and **Unusable**. This feature helps track materials that are fit for production versus those that are damaged, expired, or otherwise unsuitable for use.

## Feature Details

### Database Layer

**Migration**: `supabase/migrations/20260210000000_create_inventory_analytics.sql`

The `inventory_raw_materials_by_tag` view has been updated to include the `usable` field from the `raw_materials` table:

```sql
CREATE OR REPLACE VIEW inventory_raw_materials_by_tag AS
SELECT
  rmt.id as tag_id,
  rmt.tag_key,
  rmt.display_name as tag_name,
  COALESCE(MAX(rm.unit), 'units') as default_unit,
  rm.usable,  -- Added field
  COALESCE(SUM(...), 0) as current_balance,
  COUNT(DISTINCT rm.id) as item_count,
  MAX(sm.effective_date) as last_movement_date
FROM raw_material_tags rmt
LEFT JOIN raw_materials rm ON rm.raw_material_tag_id = rmt.id
LEFT JOIN stock_movements sm ON sm.item_reference = rm.id AND sm.item_type = 'raw_material'
GROUP BY rmt.id, rmt.tag_key, rmt.display_name, rm.usable;
```

### TypeScript Types

**File**: `src/types/inventory-analytics.ts`

The `CurrentInventoryByTag` interface now includes an optional `usable` field:

```typescript
export interface CurrentInventoryByTag {
  tag_id: string;
  tag_key: string;
  tag_name: string;
  default_unit: string;
  usable?: boolean; // Only for raw materials
  current_balance: number;
  item_count: number;
  last_movement_date?: string;
  last_production_date?: string;
}
```

### UI Implementation

**File**: `src/pages/InventoryAnalytics.tsx`

#### Current Inventory Tab

When viewing Raw Materials, the inventory is now displayed in two separate sections:

1. **Usable Raw Materials** (Green theme)
   - Header with emerald color scheme
   - Shows all raw materials where `usable = true`
   - Emerald-tinted table headers and hover effects

2. **Unusable Raw Materials** (Amber theme)
   - Header with amber color scheme
   - Shows all raw materials where `usable = false`
   - Amber-tinted table headers and hover effects

#### Bar Chart

The stock bar chart now uses color coding for raw materials:
- **Green bars** (#10b981): Usable raw materials
- **Amber bars** (#f59e0b): Unusable raw materials
- **Indigo bars** (#6366f1): Other inventory types (recurring products, produced goods)

A legend is displayed when viewing raw materials to explain the color coding.

## Scope

**Important**: This feature applies ONLY to Raw Materials. It does NOT affect:
- Recurring Products
- Produced Goods

These inventory types continue to display in a single unified table without usable/unusable separation.

## User Experience

### When Raw Materials is Selected:

1. The bar chart shows color-coded bars (green for usable, amber for unusable)
2. A legend appears above the chart explaining the colors
3. The table section splits into two distinct sections with clear visual separation
4. Each section has its own color-themed header and styling

### When Other Inventory Types are Selected:

1. The bar chart shows standard indigo bars
2. No legend is displayed
3. The table displays in a single unified section
4. Standard slate color scheme is used

## Benefits

1. **Clear Visibility**: Instantly see which materials are ready for production
2. **Inventory Management**: Track damaged or expired materials separately
3. **Decision Support**: Make informed decisions about material usage and disposal
4. **Visual Distinction**: Color coding makes it easy to distinguish usable from unusable materials

## Technical Notes

- The `usable` field is a boolean in the `raw_materials` table
- The view groups by `usable`, so each tag may appear twice (once for usable, once for unusable)
- Chart data includes the `usable` property only for raw materials (undefined for other types)
- TypeScript types properly handle the optional nature of the `usable` field
