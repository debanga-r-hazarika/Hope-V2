# Sales Targets Feature

## Overview
The Sales Targets feature allows administrators to set and track sales goals within the Sales Analytics module. Targets can be based on quantity sold or revenue generated, with optional filtering by product tags.

## Features

### Target Types
1. **Sales Quantity**: Track total units sold within a date range
2. **Sales Revenue**: Track total revenue generated within a date range

### Target Parameters
- **Target Name**: Descriptive name for the target
- **Target Type**: Quantity or Revenue
- **Target Value**: Numeric goal to achieve
- **Product Tag** (Optional): Filter target to specific product
- **Date Range**: Start and end dates for the target period
- **Description** (Optional): Additional notes about the target
- **Status**: Active, Completed, or Cancelled

### Progress Tracking
Each target displays:
- Current progress percentage
- Current value vs target value
- Remaining value to achieve
- Days remaining in the period
- Visual progress bar with color coding:
  - Green: Achieved (100%+)
  - Blue: On track (75-99%)
  - Amber: Needs attention (50-74%)
  - Red: Behind (0-49%)

### Target Management
- **Create**: Set new sales targets
- **Edit**: Modify active targets
- **Complete**: Mark achieved targets as completed
- **Cancel**: Cancel targets that are no longer relevant
- **Delete**: Remove completed or cancelled targets

## Database Schema

### Table: `analytics_targets`
```sql
- id: uuid (PK)
- target_name: text
- target_type: text (sales_quantity | sales_revenue)
- target_value: numeric
- tag_type: text (produced_goods | null)
- tag_id: uuid (FK to produced_goods_tags)
- period_start: date
- period_end: date
- status: text (active | completed | cancelled)
- description: text
- created_at: timestamptz
- created_by: uuid (FK to users)
- updated_at: timestamptz
- updated_by: uuid (FK to users)
```

### Row Level Security (RLS) Policies

The `analytics_targets` table has RLS enabled with the following policies:

**SELECT (View) Policies:**
- `Admins can view analytics targets`: Allows admin users to view all targets
- `Users with analytics access can view targets`: Allows users with analytics module access (read-only, read-write, or admin) to view all targets

**INSERT (Create) Policies:**
- `Admins can create analytics targets`: Allows admin users to create targets
- `Users with analytics write access can create targets`: Allows users with read-write or admin analytics access to create targets

**UPDATE (Edit) Policies:**
- `Admins can update analytics targets`: Allows admin users to update targets
- `Users with analytics write access can update targets`: Allows users with read-write or admin analytics access to update targets

**DELETE (Remove) Policies:**
- `Admins can delete analytics targets`: Allows admin users to delete targets
- `Users with analytics write access can delete targets`: Allows users with read-write or admin analytics access to delete targets

These policies ensure that:
- Read-only users can view targets but cannot modify them
- Read-write users can view, create, edit, and delete targets
- Admin users have full access to all operations

## Files Created

### Types
- `src/types/sales-targets.ts`: TypeScript interfaces for targets

### Library Functions
- `src/lib/sales-targets.ts`: CRUD operations and progress calculations
  - `fetchSalesTargets()`: Get all targets
  - `createSalesTarget()`: Create new target
  - `updateSalesTarget()`: Update existing target
  - `deleteSalesTarget()`: Delete target
  - `updateTargetStatus()`: Change target status
  - `calculateTargetProgress()`: Calculate current progress
  - `fetchTargetsWithProgress()`: Get targets with progress data

### Components
- `src/components/SalesTargetModal.tsx`: Modal for creating/editing targets
- `src/components/SalesTargetCard.tsx`: Card displaying target progress

### Pages
- `src/pages/SalesAnalytics.tsx`: Added "Sales Targets" tab

## Usage

### Creating a Target
1. Navigate to Sales Analytics → Sales Targets tab
2. Click "Create Target" button
3. Fill in target details:
   - Name (e.g., "Q1 Sales Target")
   - Type (Quantity or Revenue)
   - Value (numeric goal)
   - Product Tag (optional - leave empty for all products)
   - Date range
   - Description (optional)
4. Click "Create Target"

### Tracking Progress
- Targets automatically calculate progress based on completed orders
- Progress updates in real-time as sales are recorded
- Color-coded progress bars provide visual feedback
- Days remaining countdown helps with time management

### Managing Targets
- **Edit**: Click "Edit" button on active targets
- **Complete**: Click "Complete" button when target is achieved
- **Cancel**: Click cancel icon to mark target as cancelled
- **Delete**: Delete completed or cancelled targets

## Migration
Migration files:
- `db/migrations/2025-03-03-update-analytics-targets-for-sales.sql` - Updates target_type constraint and adds performance index
- `db/migrations/2025-03-03-add-analytics-targets-module-access-policies.sql` - Adds RLS policies for module-based access control

The RLS policies migration:
- Adds SELECT policy for all users with analytics module access (R/O, R/W, admin)
- Adds INSERT, UPDATE, DELETE policies for users with write access (R/W, admin)
- Ensures proper access control based on user_module_access table

## Access Control

### Read/Write Access (R/W)
Users with Read/Write or Admin access to Sales Analytics can:
- View all sales targets and their progress
- Create new sales targets
- Edit existing active targets
- Mark targets as completed or cancelled
- Delete completed or cancelled targets

### Read-Only Access (R/O)
Users with Read-Only access to Sales Analytics can:
- View all sales targets and their progress
- See target status and fulfillment comments
- Track progress over time

Read-only users will see a "View-only access • Contact admin to modify targets" message instead of action buttons on target cards.

### Access Level Implementation
- Access levels are determined by the `user_module_access` table
- The `accessLevel` prop is passed from the Analytics module access check
- Valid access levels: `'read-write'`, `'read-only'`, `'admin'`, `'no-access'`
- Admin users have the same permissions as Read/Write users for targets

## Future Enhancements
- Email notifications when targets are achieved
- Target templates for recurring goals
- Team-based targets with individual contributions
- Historical target performance analytics
- Target vs actual comparison charts


## Implementation Status

### ✅ COMPLETED (2025-03-03)

All features have been implemented and verified. The following issues were identified and fixed during final verification:

### Final Fixes Applied

1. **Revenue Calculation Bug** (CRITICAL FIX)
   - **Issue**: Tag-filtered revenue targets only included `ORDER_COMPLETED` status
   - **Fix**: Updated query to include both `ORDER_COMPLETED` and `READY_FOR_PAYMENT` statuses
   - **Location**: `src/lib/sales-targets.ts` line 206
   - **Impact**: Revenue targets now correctly count all sold orders, not just completed ones

2. **Days Remaining Calculation** (CRITICAL FIX)
   - **Issue**: `Math.max(0, ...)` prevented negative values, breaking expired status detection
   - **Fix**: Removed the wrapper to allow negative values for expired targets
   - **Location**: `src/lib/sales-targets.ts` line 242
   - **Impact**: Targets now properly show "Expired" status when period ends

3. **Row Level Security (RLS) Policies** (CRITICAL FIX)
   - **Issue**: Only admin users could view targets; R/O and R/W users with analytics access couldn't see any targets
   - **Fix**: Added RLS policies based on `user_module_access` table
   - **Location**: `db/migrations/2025-03-03-add-analytics-targets-module-access-policies.sql`
   - **Impact**: 
     - R/O users can now view all targets
     - R/W users can view, create, edit, and delete targets
     - Admin users retain full access
   - **Policies Added**:
     - SELECT: Users with any analytics access (read-only, read-write, admin)
     - INSERT/UPDATE/DELETE: Users with write access (read-write, admin)

4. **Code Quality**
   - **Issue**: Unused React import in SalesTargetCard component
   - **Fix**: Removed unused import
   - **Location**: `src/components/SalesTargetCard.tsx` line 1

### Verified Features

✅ **User Profile ID Handling**: Correctly uses `profile.id` from AuthContext for all database operations  
✅ **Order Status Inclusion**: Both quantity and revenue calculations include `ORDER_COMPLETED` and `READY_FOR_PAYMENT` statuses  
✅ **Target Expiration**: Targets show "Expired" when `days_remaining <= 0`  
✅ **Product Display**: Shows "All Products" when `tag_id` is null  
✅ **Intelligent Fulfillment Comments**: Properly considers both progress percentage AND time remaining percentage  
✅ **Access Control**: Read/Write users can create/edit targets, Read-Only users can only view

### Intelligent Fulfillment Comments Logic

The fulfillment comments system provides context-aware feedback based on two factors:

1. **Progress Percentage**: How much of the target has been achieved
2. **Time Remaining Percentage**: How much time is left in the target period

**Calculation**:
```typescript
const totalPeriodDays = Math.ceil((period_end - period_start) / (1000 * 60 * 60 * 24));
const daysRemainingPercent = (days_remaining / totalPeriodDays) * 100;
```

**Comment Examples**:
- Progress 90%+ → "🔥 Almost there! Just a little more to go!"
- Progress 75%+, Time < 25% → "⏰ Good progress but time is running out! Sprint to finish!"
- Progress 50%+, Time < 30% → "🚨 Halfway but running out of time! Urgent action needed!"
- Progress 25%+, Time < 50% → "🚨 Critical! Behind schedule - immediate action required!"
- Achieved early (days > 7) → "🎉 Target Achieved Early! Outstanding performance!"
- Expired, Progress 90%+ → "😔 So close! Target missed by a small margin."

### Testing Checklist

- [x] Create quantity target for all products
- [x] Create quantity target for specific product tag
- [x] Create revenue target for all products
- [x] Create revenue target for specific product tag
- [x] Edit active target
- [x] Complete achieved target
- [x] Cancel target
- [x] Delete completed/cancelled target
- [x] Verify progress calculation includes both order statuses
- [x] Verify expired targets show correct status
- [x] Verify "All Products" displays when no tag selected
- [x] Verify intelligent comments adjust based on progress and time
- [x] All TypeScript diagnostics pass
- [x] Read/Write users can create and edit targets
- [x] Read-Only users can only view targets (no action buttons)

### Known Limitations

1. **Real-time Updates**: Progress updates when page is loaded/refreshed, not in real-time
2. **Historical Data**: Targets only track forward from creation date
3. **Partial Period Targets**: If a target period has already started, it includes all sales from period_start, not from creation date

### Technical Notes

- **Order Status Logic**: Orders are considered "sold" when created (status: READY_FOR_PAYMENT) or completed (status: ORDER_COMPLETED), not when fully paid
- **Date Calculations**: All date comparisons use UTC timezone
- **Progress Calculation**: Runs on-demand when targets are fetched, not cached
- **Performance**: Each target requires 1-3 database queries depending on filters
