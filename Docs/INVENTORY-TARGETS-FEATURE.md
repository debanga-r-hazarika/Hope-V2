# Inventory Targets Feature

## Overview
The Inventory Targets feature allows administrators to set and track inventory management goals within the Inventory Analytics module. Targets can be based on stock levels, consumption limits, waste reduction, and stock turnover rates.

## Target Types

### 1. Stock Level Target (`stock_level`)
**Purpose**: Maintain minimum stock levels for specific inventory items  
**Metric**: Current stock balance  
**Success Criteria**: Current stock >= Target value  
**Use Case**: Ensure critical raw materials or products never run out

**Example**: "Maintain at least 500 kg of Banana Peel in stock"

### 2. Consumption Limit Target (`consumption_limit`)
**Purpose**: Control consumption within specified limits  
**Metric**: Total consumption in period  
**Success Criteria**: Total consumption <= Target value  
**Use Case**: Budget control, prevent overuse of expensive materials

**Example**: "Limit Bottle 250ml consumption to 1000 units this month"

### 3. Waste Reduction Target (`waste_reduction`)
**Purpose**: Reduce waste percentage  
**Metric**: (Total Waste / Total Usage) * 100  
**Success Criteria**: Waste percentage <= Target value  
**Use Case**: Improve efficiency, reduce costs

**Example**: "Keep waste below 5% for all raw materials"

### 4. Stock Turnover Target (`stock_turnover`)
**Purpose**: Improve inventory turnover rate  
**Metric**: Consumption / Average Stock  
**Success Criteria**: Turnover rate >= Target value  
**Use Case**: Optimize inventory levels, reduce holding costs

**Example**: "Achieve turnover rate of 2.0 for recurring products"

### 5. New Stock Arrival Target (`new_stock_arrival`)
**Purpose**: Ensure adequate new inventory is added  
**Metric**: Total new stock added (IN movements or production)  
**Success Criteria**: New stock added >= Target value  
**Use Case**: Maintain supply chain, ensure production continuity

**Example**: "Add at least 1000 kg of Banana Peel this month"

## Target Parameters

### Required Fields
- **Target Name**: Descriptive name (e.g., "Q1 Stock Level - Banana Peel")
- **Target Type**: One of the four types above
- **Target Value**: Numeric goal
- **Inventory Type**: raw_material, recurring_product, or produced_goods
- **Tag ID**: Specific item tag (optional - leave empty for all items of that type)
- **Period Start**: Start date
- **Period End**: End date

### Optional Fields
- **Description**: Additional notes about the target

## Database Schema

### Table: `analytics_targets` (Extended)
The existing `analytics_targets` table is extended to support inventory targets:

```sql
-- New target_type values added:
- 'stock_level'          -- Minimum stock level to maintain
- 'consumption_limit'    -- Maximum consumption allowed
- 'waste_reduction'      -- Target waste percentage
- 'stock_turnover'       -- Target turnover rate
- 'new_stock_arrival'    -- Target for new inventory additions

-- tag_type now supports:
- 'raw_material'
- 'recurring_product'
- 'produced_goods'
```

## Progress Calculation

### Stock Level
```
Current Value = SUM(quantity_available) for all items with matching tag
Progress = (Current Value / Target Value) * 100
Achieved = Current Value >= Target Value
```

### Consumption Limit
```
Current Value = SUM(consumption) from stock_movements in period
Progress = (Current Value / Target Value) * 100
Achieved = Current Value <= Target Value (lower is better)
```

### Waste Reduction
```
Total Consumption = SUM(CONSUMPTION movements)
Total Waste = SUM(WASTE movements)
Current Value = (Total Waste / (Total Consumption + Total Waste)) * 100
Progress = (Current Value / Target Value) * 100
Achieved = Current Value <= Target Value (lower is better)
```

### Stock Turnover
```
Total Consumption = SUM(CONSUMPTION movements) in period
Average Stock = AVG(quantity_available) for items with tag
Current Value = Total Consumption / Average Stock
Progress = (Current Value / Target Value) * 100
Achieved = Current Value >= Target Value
```

### New Stock Arrival
```
For Raw Materials & Recurring Products:
  Current Value = SUM(IN movements) in period for items with tag
  
For Produced Goods:
  Current Value = SUM(produced_quantity) from batch_outputs in period for tag

Progress = (Current Value / Target Value) * 100
Achieved = Current Value >= Target Value
```

## Files Structure

### Types
- `src/types/inventory-targets.ts` - TypeScript interfaces

### Library Functions
- `src/lib/inventory-targets.ts` - CRUD operations and progress calculations
  - `fetchInventoryTargets()` - Get all targets
  - `createInventoryTarget()` - Create new target
  - `updateInventoryTarget()` - Update existing target
  - `deleteInventoryTarget()` - Delete target
  - `updateInventoryTargetStatus()` - Change target status
  - `calculateInventoryTargetProgress()` - Calculate current progress
  - `fetchInventoryTargetsWithProgress()` - Get targets with progress data

### Components
- `src/components/InventoryTargetModal.tsx` - Modal for creating/editing targets ✅
- `src/components/InventoryTargetCard.tsx` - Card displaying target progress ✅

### Pages
- `src/pages/InventoryAnalytics.tsx` - Add "Inventory Targets" tab

## Migration Files
1. `db/migrations/2025-03-03-add-inventory-target-types.sql` - Adds initial 4 target types
2. `db/migrations/2025-03-03-add-new-stock-arrival-target.sql` - Adds new_stock_arrival target type
3. `db/migrations/2025-03-03-add-analytics-targets-module-access-policies.sql` - RLS policies (already applied)

## Access Control

Same as Sales Targets:

### Read/Write Access (R/W)
- View all inventory targets and their progress
- Create new inventory targets
- Edit existing active targets
- Mark targets as completed or cancelled
- Delete completed or cancelled targets

### Read-Only Access (R/O)
- View all inventory targets and their progress
- See target status and progress
- Track progress over time
- Cannot create, edit, or delete targets

## Implementation Status

### ✅ Completed
- [x] Database migration for new target types (4 initial types)
- [x] Database migration for new_stock_arrival target type (5th type)
- [x] TypeScript type definitions
- [x] Library functions for CRUD operations
- [x] Progress calculation logic for all 5 target types
- [x] RLS policies (inherited from sales targets)
- [x] InventoryTargetModal component
- [x] InventoryTargetCard component
- [x] Integration with InventoryAnalytics page
- [x] UI for creating/editing targets
- [x] Progress visualization
- [x] Access control implementation (R/O, R/W, Admin)
- [x] Responsive design (mobile, tablet, desktop)
- [x] Status management (active, expired, completed, cancelled)
- [x] Contextual fulfillment comments
- [x] Days remaining counter (supports negative values)

### 🎉 Feature Complete
All components have been implemented and integrated. The feature is ready for testing with real data.

## Next Steps

1. ✅ ~~Create `InventoryTargetModal.tsx` component~~ - DONE
2. ✅ ~~Create `InventoryTargetCard.tsx` component~~ - DONE
3. ✅ ~~Add "Targets" tab to InventoryAnalytics page~~ - DONE
4. ⏳ Test all 5 target types with sample data
5. ⏳ Verify access control with different user roles
6. ⏳ Test responsive design on various devices
7. ⏳ Deploy to production after successful testing

## Usage Examples

### Example 1: Stock Level Target
```
Target Name: "Maintain Banana Peel Stock"
Target Type: Stock Level
Target Value: 500
Inventory Type: Raw Material
Tag: Banana Peel
Period: 2025-03-01 to 2025-03-31
Description: "Ensure we never run out of banana peel for production"
```

### Example 2: Waste Reduction Target
```
Target Name: "Q1 Waste Reduction - All Raw Materials"
Target Type: Waste Reduction
Target Value: 5
Inventory Type: Raw Material
Tag: (All - leave empty)
Period: 2025-01-01 to 2025-03-31
Description: "Keep waste below 5% for all raw materials"
```

### Example 3: Consumption Limit Target
```
Target Name: "March Bottle Usage Limit"
Target Type: Consumption Limit
Target Value: 1000
Inventory Type: Recurring Product
Tag: Bottle 250ml
Period: 2025-03-01 to 2025-03-31
Description: "Control bottle consumption to stay within budget"
```

### Example 4: New Stock Arrival Target
```
Target Name: "March Raw Material Procurement"
Target Type: New Stock Arrival
Target Value: 2000
Inventory Type: Raw Material
Tag: Banana Peel
Period: 2025-03-01 to 2025-03-31
Description: "Ensure we receive at least 2000 kg of banana peel this month"
```

## Technical Notes

- **Data Source**: Uses `stock_movements` table for consumption and waste tracking
- **Real-time Calculation**: Progress is calculated on-demand when targets are fetched
- **Tag Flexibility**: Targets can apply to specific tags or all items of a type
- **Period-based**: All targets are time-bound with start and end dates
- **Status Management**: Active, Completed, Cancelled states
- **Access Control**: Inherits RLS policies from analytics_targets table

## Known Limitations

1. **Historical Data**: Targets only track forward from creation date
2. **Complex Calculations**: Stock turnover calculation uses current average, not historical average
3. **Performance**: Progress calculation requires multiple queries per target
4. **Produced Goods**: Consumption tracking for produced goods is limited (mainly for raw materials and recurring products)

## Future Enhancements

- Email notifications when targets are at risk
- Target templates for recurring goals
- Historical target performance analytics
- Predictive alerts based on consumption trends
- Bulk target creation
- Target vs actual comparison charts
