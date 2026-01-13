# Order Timer Visibility Guide

## Where to See the Timer

The 48-hour timer appears in the **Order Detail Page** when an order status is **"Order Completed"**.

### Location:
1. Navigate to **Orders** page
2. Click on any order with status **"Order Completed"** (purple badge)
3. The timer will appear **inside the Order Header Card**, right below the order number and customer information, and above the action buttons

### What You Should See:

**If Timer is Active (< 48 hours):**
- Large countdown timer showing: `HH:MM:SS`
- Progress bar showing time remaining
- Color-coded:
  - **Blue**: More than 12 hours remaining
  - **Amber**: Less than 12 hours remaining  
  - **Red**: Less than 6 hours remaining (with pulsing animation)

**If Order is Locked (> 48 hours):**
- Red banner with lock icon
- Message: "Order Locked - This order has been automatically locked after 48 hours"

### Troubleshooting:

**If you don't see the timer:**

1. **Check Order Status:**
   - The timer ONLY shows for orders with status **"Order Completed"**
   - Check the order status badge (should be purple with "Order Completed")

2. **Run Database Migration:**
   - Make sure the migration `20250225000007_add_completed_at_to_orders.sql` has been applied
   - The migration adds the `completed_at` column to track when orders were completed

3. **For Existing Orders:**
   - If an order was completed before the migration, it will automatically backfill `completed_at` when you view it
   - The timer will use `updated_at` as a fallback if `completed_at` is not set

4. **Check Browser Console:**
   - Open browser DevTools (F12)
   - Check for any errors in the Console tab
   - Look for messages about `completed_at` or timer

### Visual Location:

```
┌─────────────────────────────────────────┐
│  Order Header Card (Blue)                │
│  ┌───────────────────────────────────┐  │
│  │  ORD-000005                        │  │
│  │  Order Completed [Badge]          │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  ⏱️ TIMER DISPLAYS HERE            │  │ ← HERE!
│  │  47:23:15                          │  │
│  │  [Progress Bar]                    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  [Record Payment] [Generate Invoice]│  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Testing:

To test the timer:
1. Find or create an order
2. Complete delivery (all items delivered)
3. Ensure full payment is received
4. Order status should automatically change to "Order Completed"
5. Timer should appear immediately

If you still don't see it, please check:
- Order status is exactly "ORDER_COMPLETED" (case-sensitive)
- You're viewing the Order Detail page (not the Orders list)
- Browser console for any JavaScript errors
