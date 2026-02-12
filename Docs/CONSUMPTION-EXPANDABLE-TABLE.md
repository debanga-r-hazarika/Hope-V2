# Consumption Expandable Table Feature

## Overview
Improved the consumption history table to show aggregated data per tag with expandable rows for detailed daily breakdown.

## Changes Made

### 1. Table Structure

**Before:**
- One row per date per tag
- Repetitive tag names
- Hard to see total consumption per tag
- Cluttered view with many rows

**After:**
- One row per tag (aggregated summary)
- Click to expand and see daily details
- Clean, organized view
- Easy to compare tags at a glance

### 2. Summary Row (Collapsed State)

Each tag shows:
- **Expand/Collapse Icon**: Chevron right (collapsed) or down (expanded)
- **Tag Name**: Bold, prominent display
- **Total Consumed**: Sum of all consumption for the month (indigo color)
- **Total Wasted**: Sum of all waste for the month (rose color)
- **Total Transactions**: Count of all consumption transactions

**Visual Design:**
- Hover effect: Light indigo background
- Cursor: Pointer to indicate clickability
- Bold font for totals to emphasize summary nature

### 3. Detail Rows (Expanded State)

When you click a summary row, it expands to show:
- **Date**: Each day's consumption date
- **Consumed**: Daily consumption amount
- **Wasted**: Daily waste amount
- **Transactions**: Daily transaction count

**Visual Design:**
- Light gray background (slate-50) to differentiate from summary
- Indented date column for visual hierarchy
- Smaller font size (text-xs) for detail rows
- Lighter text colors to show secondary importance

### 4. Interaction

**Click to Expand:**
```
▶ Flour                    150.00    5.00    25
```

**Click to Collapse:**
```
▼ Flour                    150.00    5.00    25
    2026-02-01            50.00     2.00    10
    2026-02-05            75.00     2.00    10
    2026-02-10            25.00     1.00    5
```

### 5. State Management

```typescript
const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

const toggleExpand = (tagId: string) => {
  setExpandedTags(prev => {
    const newSet = new Set(prev);
    if (newSet.has(tagId)) {
      newSet.delete(tagId);
    } else {
      newSet.add(tagId);
    }
    return newSet;
  });
};
```

### 6. Data Aggregation Logic

```typescript
// Group by tag and accumulate totals
const groupedByTag = filteredConsumptionData.reduce((acc, item) => {
  const key = item.tag_id;
  if (!acc[key]) {
    acc[key] = {
      tag_id: item.tag_id,
      tag_name: item.tag_name,
      total_consumed: 0,
      total_wasted: 0,
      total_transactions: 0,
      details: []
    };
  }
  acc[key].total_consumed += item.total_consumed || 0;
  acc[key].total_wasted += item.total_wasted || 0;
  acc[key].total_transactions += item.consumption_transactions || 0;
  acc[key].details.push(item);
  return acc;
}, {});
```

### 7. Benefits

**For Users:**
- Quick overview of total consumption per tag
- Drill down into details only when needed
- Less scrolling required
- Easier to compare tags
- Cleaner, more professional appearance

**For Performance:**
- Fewer DOM elements rendered initially
- Lazy rendering of detail rows
- Better performance with large datasets

**For Analysis:**
- Totals immediately visible
- Easy to identify high-consumption items
- Quick waste rate comparison
- Better data hierarchy

### 8. Color Coding

- **Consumed**: Indigo (#6366f1) - represents productive use
- **Wasted**: Rose/Red (#ef4444) - highlights waste
- **Summary Row Hover**: Light indigo background
- **Detail Rows**: Light gray background for differentiation

### 9. Responsive Design

- Works on mobile and desktop
- Touch-friendly click targets
- Proper spacing for readability
- Scrollable on small screens

### 10. Integration

- Works with inventory type filter
- Works with month-year switcher
- Filters out out-of-stock items
- Maintains all existing functionality

## User Guide

### How to Use

1. **View Summary**: See total consumption for each tag at a glance
2. **Expand Details**: Click any row to see daily breakdown
3. **Collapse Details**: Click the expanded row again to hide details
4. **Multiple Expansions**: You can expand multiple tags simultaneously
5. **Filter by Type**: Use inventory type buttons to filter tags
6. **Change Month**: Use month switcher to view different periods

### Example Workflow

1. Select "Raw Materials" filter
2. Navigate to "Consumption" tab
3. See summary of all raw material consumption
4. Click "Flour" row to see daily flour consumption
5. Click "Sugar" row to compare with flour
6. Use month switcher to see previous month
7. Summaries automatically recalculate

## Technical Details

### State
- `expandedTags`: Set<string> - Tracks which tag IDs are expanded
- Persists during filter/month changes
- Resets when component unmounts

### Performance
- O(n) aggregation complexity
- Minimal re-renders
- Efficient Set operations for expand/collapse

### Accessibility
- Keyboard accessible (Enter/Space to toggle)
- Screen reader friendly
- Clear visual indicators
- Semantic HTML structure

## Future Enhancements

1. Add "Expand All" / "Collapse All" buttons
2. Remember expanded state in localStorage
3. Add sorting by total consumed/wasted
4. Add export functionality for expanded view
5. Add visual indicators for high waste rates
6. Add comparison mode between tags
7. Add trend indicators (up/down arrows)
