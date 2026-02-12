# Raw Material Unit Standardization Fix

## Problem
The system had two separate units for weight measurements:
- `gm` (grams)
- `Kg` (kilograms)

These were treated as completely separate units, causing accounting issues even though 1000 gm = 1 kg.

Additionally, there was a case sensitivity issue with "Kg" vs "kg".

## Solution Applied

### Migration 1: Standardize gm to kg
Converted all gram measurements to kilograms across all tables:

1. **raw_materials**: Converted `quantity_received` and `quantity_available` from gm to kg (÷ 1000)
2. **batch_raw_materials**: Converted `quantity_consumed` from gm to kg
3. **stock_movements**: Converted `quantity` from gm to kg for raw materials
4. **waste_tracking**: Converted `quantity_wasted` from gm to kg for raw materials
5. **transfer_tracking**: Converted `quantity_transferred` from gm to kg for raw materials
6. **raw_material_units**: Deactivated the "gm" unit with description: "Deprecated: Use kg instead. 1000 gm = 1 kg"

### Migration 2: Fix Case Sensitivity
Standardized all "Kg" references to lowercase "kg" across all tables.

## Results

### Before:
- 6 lots with "gm" unit (2000 gm total)
- 1 lot with "Kg" unit (36.5 Kg total)
- Total: 7 lots with inconsistent units

### After:
- 7 lots with "kg" unit (38.5 kg total)
- All weight measurements now use the same base unit
- Accounting is now accurate and consistent

## Impact on Frontend

The frontend should continue to work without changes because:
1. The unit field still exists and is populated
2. All quantities are now in a single standardized unit
3. The "gm" unit is marked as inactive, so it won't appear in dropdowns for new entries
4. Historical data with "gm" has been converted to "kg"

## Recommendations

1. **Display**: Consider showing "kg" as "Kg" in the UI for better readability (the database stores "kg")
2. **Input Validation**: Ensure new raw material entries use "kg" for weight measurements
3. **User Communication**: Inform users that all weight measurements are now in kilograms
4. **Conversion Helper**: If users want to enter in grams, add a UI helper that converts to kg (e.g., "Enter 500 gm → Stores as 0.5 kg")

## Database Changes Summary

```sql
-- All gm quantities converted to kg (divided by 1000)
-- All Kg references standardized to lowercase kg
-- gm unit marked as inactive
```

## Tables Affected
- raw_materials
- batch_raw_materials
- stock_movements
- waste_tracking
- transfer_tracking
- raw_material_units

## Analytics Fix

After the initial unit standardization, we discovered that the `stock_movements` table had some inconsistent data that wasn't properly converted:

1. Some records had unit "Pieces" when they should have been "kg"
2. Some quantities were stored as grams (e.g., 1400) instead of kilograms (1.4)

### Migration 3: Fix Stock Movements Inconsistencies
Applied a targeted fix to correct specific problematic records and a general rule to catch any remaining issues:

```sql
-- Fixed specific records with incorrect units/quantities
-- Applied general rule to convert large 'Pieces' values that are clearly grams
```

### Analytics Views Affected
The following views now show correct aggregated data:
- `inventory_raw_materials_by_tag` - Current inventory balances by tag
- `inventory_consumption_raw_materials` - Consumption and waste tracking
- `raw_material_analytics_by_tag` - Analytics metrics by tag

### Verification
After the fix:
- "Banana Peel Ash" now correctly shows 2.0 kg (was showing 2000 kg)
- All consumption data is now in consistent units
- Analytics charts and reports display accurate information

## Date Applied
February 13, 2026

## Migrations Applied
1. `standardize_raw_material_units_kg_gm` - Convert gm to kg across all tables
2. `fix_kg_case_sensitivity` - Standardize Kg to kg
3. `fix_stock_movements_unit_inconsistencies` - Fix analytics data inconsistencies
