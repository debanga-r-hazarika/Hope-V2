# Finance Targets Feature

## Overview
The Finance Targets feature allows administrators to set and track financial goals within the Finance Analytics module. Targets can be based on revenue, expenses, cash flow, profit margins, collection periods, and expense ratios.

## Target Types

### 1. Revenue Target (`revenue_target`)
**Purpose**: Set a target for total revenue in a period  
**Metric**: Total income from all sources  
**Success Criteria**: Total income >= Target value  
**Use Case**: Track revenue growth and sales performance

**Example**: "Q1 Revenue Target - ₹500,000"

### 2. Expense Limit (`expense_limit`)
**Purpose**: Set a maximum limit for total expenses  
**Metric**: Total expenses across all categories  
**Success Criteria**: Total expenses <= Target value  
**Use Case**: Budget control, cost management

**Example**: "March Expense Limit - ₹300,000"

### 3. Cash Flow Target (`cash_flow_target`)
**Purpose**: Set a target for net cash flow  
**Metric**: Total income - Total expenses  
**Success Criteria**: Net cash flow >= Target value  
**Use Case**: Ensure positive cash flow, liquidity management

**Example**: "Q1 Cash Flow Target - ₹200,000"

### 4. Profit Margin Target (`profit_margin_target`)
**Purpose**: Set a target profit margin percentage  
**Metric**: (Income - Expenses) / Income * 100  
**Success Criteria**: Profit margin >= Target value  
**Use Case**: Profitability tracking, efficiency improvement

**Example**: "Target 25% Profit Margin"

### 5. Collection Period Target (`collection_period_target`)
**Purpose**: Set a target for average collection period  
**Metric**: Average days between order date and payment date  
**Success Criteria**: Average collection period <= Target value  
**Use Case**: Improve cash conversion, reduce receivables

**Example**: "Target 30-day Collection Period"

### 6. Expense Ratio Target (`expense_ratio_target`)
**Purpose**: Set a target for expense-to-revenue ratio  
**Metric**: Total Expenses / Total Income  
**Success Criteria**: Expense ratio <= Target value  
**Use Case**: Cost efficiency, operational optimization

**Example**: "Target 0.7 Expense Ratio (70%)"

## Target Parameters

### Required Fields
- **Target Name**: Descriptive name (e.g., "Q1 Revenue Target")
- **Target Type**: One of the six types above
- **Target Value**: Numeric goal (amount, percentage, days, or ratio)
- **Period Start**: Start date
- **Period End**: End date

### Optional Fields
- **Description**: Additional notes about the target

## Database Schema

### Table: `analytics_targets` (Extended)
The existing `analytics_targets` table is extended to support finance targets:

```sql
-- New target_type values added:
- 'revenue_target'           -- Target total revenue
- 'expense_limit'            -- Maximum expenses allowed
- 'cash_flow_target'         -- Target net cash flow
- 'profit_margin_target'     -- Target profit margin %
- 'collection_period_target' -- Target avg collection period (days)
- 'expense_ratio_target'     -- Target expense-to-revenue ratio

-- Finance targets don't use tag_type or tag_id (set to NULL)
```

## Progress Calculation

### Revenue Target
```
Current Value = SUM(income.amount) WHERE payment_date in period
Progress = (Current Value / Target Value) * 100
Achieved = Current Value >= Target Value
```

### Expense Limit
```
Current Value = SUM(expenses.amount) WHERE payment_date in period
Progress = (Target Value / Current Value) * 100 (inverse for "lower is better")
Achieved = Current Value <= Target Value
```

### Cash Flow Target
```
Total Income = SUM(income.amount) WHERE payment_date in period
Total Expenses = SUM(expenses.amount) WHERE payment_date in period
Current Value = Total Income - Total Expenses
Progress = (Current Value / Target Value) * 100
Achieved = Current Value >= Target Value
```

### Profit Margin Target
```
Total Income = SUM(income.amount) WHERE payment_date in period
Total Expenses = SUM(expenses.amount) WHERE payment_date in period
Current Value = ((Total Income - Total Expenses) / Total Income) * 100
Progress = (Current Value / Target Value) * 100
Achieved = Current Value >= Target Value
```

### Collection Period Target
```
For each payment in period:
  Days = (payment_date - order_date)
Current Value = AVG(Days) for all payments
Progress = (Target Value / Current Value) * 100 (inverse for "lower is better")
Achieved = Current Value <= Target Value
```

### Expense Ratio Target
```
Total Income = SUM(income.amount) WHERE payment_date in period
Total Expenses = SUM(expenses.amount) WHERE payment_date in period
Current Value = Total Expenses / Total Income
Progress = (Target Value / Current Value) * 100 (inverse for "lower is better")
Achieved = Current Value <= Target Value
```

## Files Structure

### Types
- `src/types/finance-targets.ts` - TypeScript interfaces

### Library Functions
- `src/lib/finance-targets.ts` - CRUD operations and progress calculations
  - `fetchFinanceTargets()` - Get all targets
  - `createFinanceTarget()` - Create new target
  - `updateFinanceTarget()` - Update existing target
  - `deleteFinanceTarget()` - Delete target
  - `updateFinanceTargetStatus()` - Change target status
  - `calculateFinanceTargetProgress()` - Calculate current progress
  - `fetchFinanceTargetsWithProgress()` - Get targets with progress data

### Components
- `src/components/FinanceTargetModal.tsx` - Modal for creating/editing targets ✅
- `src/components/FinanceTargetCard.tsx` - Card displaying target progress ✅

### Pages
- `src/pages/FinanceAnalytics.tsx` - Integrated "Finance Targets" tab ✅

## Migration Files
1. `db/migrations/2025-03-04-add-finance-target-types.sql` - Documents finance target types
2. `db/migrations/2025-03-03-add-analytics-targets-module-access-policies.sql` - RLS policies (already applied)

## Access Control

Same as Sales and Inventory Targets:

### Read/Write Access (R/W)
- View all finance targets and their progress
- Create new finance targets
- Edit existing active targets
- Mark targets as completed or cancelled
- Delete completed or cancelled targets

### Read-Only Access (R/O)
- View all finance targets and their progress
- See target status and progress
- Track progress over time
- Cannot create, edit, or delete targets

## Implementation Status

### ✅ Completed
- [x] Database migration for finance target types
- [x] TypeScript type definitions
- [x] Library functions for CRUD operations
- [x] Progress calculation logic for all 6 target types
- [x] RLS policies (inherited from analytics_targets)
- [x] FinanceTargetModal component
- [x] FinanceTargetCard component
- [x] Integration with FinanceAnalytics page
- [x] UI for creating/editing targets
- [x] Progress visualization
- [x] Access control implementation (R/O, R/W, Admin)
- [x] Responsive design (mobile, tablet, desktop)
- [x] Status management (active, expired, completed, cancelled)
- [x] Contextual fulfillment comments
- [x] Days remaining counter (supports negative values)

### 🎉 Feature Complete
All components have been implemented and integrated. The feature is ready for testing with real data.

## Usage Examples

### Example 1: Revenue Target
```
Target Name: "Q1 Revenue Target"
Target Type: Revenue Target
Target Value: 500000
Period: 2025-01-01 to 2025-03-31
Description: "Achieve ₹5 lakh revenue in Q1"
```

### Example 2: Expense Limit
```
Target Name: "March Expense Control"
Target Type: Expense Limit
Target Value: 300000
Period: 2025-03-01 to 2025-03-31
Description: "Keep total expenses under ₹3 lakh"
```

### Example 3: Cash Flow Target
```
Target Name: "Q1 Positive Cash Flow"
Target Type: Cash Flow Target
Target Value: 200000
Period: 2025-01-01 to 2025-03-31
Description: "Maintain ₹2 lakh positive cash flow"
```

### Example 4: Profit Margin Target
```
Target Name: "25% Profit Margin Goal"
Target Type: Profit Margin Target
Target Value: 25
Period: 2025-03-01 to 2025-03-31
Description: "Achieve 25% profit margin this month"
```

### Example 5: Collection Period Target
```
Target Name: "30-Day Collection Target"
Target Type: Collection Period Target
Target Value: 30
Period: 2025-03-01 to 2025-03-31
Description: "Reduce average collection period to 30 days"
```

### Example 6: Expense Ratio Target
```
Target Name: "70% Expense Ratio Target"
Target Type: Expense Ratio Target
Target Value: 0.7
Period: 2025-03-01 to 2025-03-31
Description: "Keep expenses at 70% of revenue"
```

## Technical Notes

- **Data Source**: Uses `income`, `expenses`, and `payments` tables
- **Real-time Calculation**: Progress is calculated on-demand when targets are fetched
- **Period-based**: All targets are time-bound with start and end dates
- **Status Management**: Active, Completed, Cancelled states
- **Access Control**: Inherits RLS policies from analytics_targets table
- **Currency Format**: Uses Indian Rupee (₹) formatting

## Integration with Finance Analytics

The Finance Targets feature is integrated into the Finance Analytics page as a fourth tab:

1. **Finance decision metrics** - KPI dashboard
2. **Finance reports** - Income, expense, cash flow reports
3. **Finance analytics** - Trends and analytics charts
4. **Finance Targets** - Target management and tracking ← NEW

The targets tab is accessible from the header navigation, consistent with the design pattern used in Sales and Inventory Analytics.

## Future Enhancements

- Email notifications when targets are at risk
- Target templates for recurring goals
- Historical target performance analytics
- Predictive alerts based on financial trends
- Bulk target creation
- Target vs actual comparison charts
- Integration with budget planning
- Multi-currency support
- Department-wise targets
- Automated target recommendations based on historical data

## Testing Checklist

### Basic Functionality
- [ ] Navigate to Finance Analytics page
- [ ] Click on "Finance Targets" tab
- [ ] Verify empty state displays correctly
- [ ] Create a new target (R/W or admin user)
- [ ] Verify target appears in the grid
- [ ] Edit an existing target
- [ ] Verify changes are saved
- [ ] Delete a target

### Target Types
- [ ] Create a Revenue Target and verify progress calculation
- [ ] Create an Expense Limit and verify progress calculation
- [ ] Create a Cash Flow Target and verify progress calculation
- [ ] Create a Profit Margin Target and verify progress calculation
- [ ] Create a Collection Period Target and verify progress calculation
- [ ] Create an Expense Ratio Target and verify progress calculation

### Access Control
- [ ] Login as R/O user and verify "Create Target" button is hidden
- [ ] Verify R/O user sees "View-only access" message
- [ ] Login as R/W user and verify full access
- [ ] Login as admin user and verify full access

### UI/UX
- [ ] Verify responsive layout on mobile, tablet, desktop
- [ ] Verify progress bars display correctly
- [ ] Verify status badges show correct colors
- [ ] Verify fulfillment comments are contextual
- [ ] Verify days remaining counter works
- [ ] Verify expired targets show "Expired" status

### Edge Cases
- [ ] Create target with no income/expense data
- [ ] Verify target with end date in past shows as expired
- [ ] Complete an achieved target
- [ ] Cancel an active target
- [ ] Verify deleted targets don't reappear

## Last Updated
March 4, 2026
