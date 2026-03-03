# Analytics Pages Layout Summary

## Overview
This document summarizes the layout structure of the Analytics pages in the application, specifically focusing on the header navigation placement.

## Current Layout Structure

### ✅ Finance Analytics (`src/pages/FinanceAnalytics.tsx`)
**Status**: Already correctly structured

**Header Section (Dark Background):**
- Finance decision metrics
- Finance reports
- Finance analytics

**Layout**: All navigation tabs are in the header section with the dark gradient background. No separate tab section below.

---

### ✅ Inventory Analytics (`src/pages/InventoryAnalytics.tsx`)
**Status**: Updated to match Finance Analytics structure

**Header Section (Dark Background):**
- Raw Materials
- Recurring Products
- Produced Goods
- **Inventory Targets** ← Moved here

**Tabs Section (White Background):**
- Current Stock
- Out of Stock
- Low Stock
- Consumption Analysis

**Changes Made**:
1. Moved "Inventory Targets" button from the tabs section to the header section
2. Removed "Inventory Targets" from the TABS array
3. Reverted grid layout from 5 columns back to 4 columns for the tabs section
4. Added logic to handle the targets button click in the header

---

### ✅ Sales Analytics (`src/pages/SalesAnalytics.tsx`)
**Status**: Already correctly structured

**Header Section (Dark Background):**
- Overview Summary
- Product Performance
- Customer Analytics
- Sales Trends
- Sales Targets

**Layout**: All navigation tabs are in the header section with the dark gradient background. No separate tab section below.

---

## Design Pattern

All Analytics pages now follow the same design pattern:

### Header Section (Dark Gradient Background)
- Contains primary navigation tabs/buttons
- Includes "Back to Analytics" button
- Page title and description
- Main navigation controls

### Content Area (White/Light Background)
- May contain secondary navigation (like Inventory Analytics tabs)
- Displays the actual content based on selected tab
- Filters and controls specific to the active view

## Benefits of This Layout

1. **Consistency**: All analytics pages have a similar structure
2. **Visual Hierarchy**: Primary navigation is clearly separated in the header
3. **Responsive**: Works well on mobile and desktop
4. **Scalable**: Easy to add new tabs or buttons
5. **User Experience**: Users can quickly understand the navigation structure

## Implementation Notes

### Header Button Pattern
```typescript
<div className="bg-slate-800/80 backdrop-blur-xl rounded-[1.25rem] p-1.5 flex overflow-x-auto scrollbar-hide gap-1.5 border border-slate-700/80 w-full xl:w-auto shadow-inner mt-6 xl:mt-0">
  {buttons.map(({ id, label, icon: Icon }) => (
    <button
      key={id}
      type="button"
      onClick={() => handleClick(id)}
      className={`flex-1 min-w-fit flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
        isActive(id)
          ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30'
          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 border border-transparent'
      }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive(id) ? 'text-indigo-100' : 'text-slate-500'}`} />
      {label}
    </button>
  ))}
</div>
```

### Key Features
- Gradient background with backdrop blur
- Rounded corners with border
- Horizontal scrolling on mobile
- Active state with gradient and shadow
- Hover effects for inactive buttons
- Icon + label layout
- Responsive sizing

## Future Considerations

If new analytics pages are added, they should follow this same pattern:
1. Place primary navigation in the header section
2. Use the same styling and interaction patterns
3. Maintain consistency with existing pages
4. Consider mobile responsiveness
5. Ensure accessibility (keyboard navigation, ARIA labels)

## Related Files

- `src/pages/FinanceAnalytics.tsx`
- `src/pages/InventoryAnalytics.tsx`
- `src/pages/SalesAnalytics.tsx`
- `src/components/ui/ModernCard.tsx`
- `src/components/ui/ModernButton.tsx`

## Last Updated
March 4, 2026
