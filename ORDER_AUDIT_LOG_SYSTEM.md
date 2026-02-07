# Order Audit Log System

## Overview
Comprehensive audit trail system that tracks ALL significant events in an order's lifecycle, not just lock/unlock events.

## Features

### Tracked Events
1. **ORDER_CREATED** - When order is first created
2. **ITEM_ADDED** - When item is added to order
3. **ITEM_UPDATED** - When item quantity/price is modified
4. **ITEM_DELETED** - When item is removed from order
5. **PAYMENT_RECEIVED** - When payment is recorded
6. **PAYMENT_DELETED** - When payment is deleted
7. **STATUS_CHANGED** - When order status changes (ORDER_CREATED → READY_FOR_PAYMENT → ORDER_COMPLETED)
8. **HOLD_PLACED** - When order is put on hold
9. **HOLD_REMOVED** - When hold is removed from order
10. **ORDER_LOCKED** - When order is manually locked
11. **ORDER_UNLOCKED** - When order is unlocked (with reason)
12. **DISCOUNT_APPLIED** - When discount is applied/changed
13. **ORDER_COMPLETED** - When order reaches completed status

### Database Schema

```sql
CREATE TABLE order_audit_log (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  event_type TEXT CHECK (event_type IN (...)),
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ,
  event_data JSONB,  -- Flexible field for event-specific data
  description TEXT,   -- Human-readable description
  created_at TIMESTAMPTZ
);
```

### Automatic Logging
- **Triggers** automatically log events when:
  - Orders are created
  - Order status changes
  - Discounts are applied
  - Items are added/updated/deleted
  - Payments are received/deleted
  - Orders are locked/unlocked
  - Orders are placed on hold/removed from hold

### UI Display
- **History Button** - Available in all order states (not locked, locked, permanently locked)
- **Activity Log Modal** - Shows chronological list of all events with:
  - Event-specific icons and colors
  - User who performed the action
  - Timestamp
  - Human-readable description
  - Event-specific data (JSON)

### Event Icons & Colors
- 📦 **Order Created** - Blue
- ➕ **Item Added** - Green
- ✏️ **Item Updated** - Amber
- ❌ **Item Deleted** - Red
- 💳 **Payment Received** - Green
- 🗑️ **Payment Deleted** - Red
- 📄 **Status Changed** - Purple
- ⏸️ **Hold Placed** - Amber
- ▶️ **Hold Removed** - Green
- 🔒 **Order Locked** - Red
- 🔓 **Order Unlocked** - Green
- 💰 **Discount Applied** - Blue
- ✅ **Order Completed** - Purple

## Implementation Files

### Database
- `supabase/migrations/20260207230000_create_order_audit_log.sql` - Main migration
  - Creates `order_audit_log` table
  - Creates triggers for automatic logging
  - Updates lock/unlock/hold functions to log events
  - Creates `get_order_audit_log()` RPC function

### Frontend
- `src/types/sales.ts` - Added `OrderAuditLog` interface
- `src/lib/sales.ts` - Added `getOrderAuditLog()` function
- `src/components/OrderLockTimer.tsx` - Updated to show comprehensive audit log

## Usage

### Viewing Order History
1. Navigate to any completed order
2. Click the "History" button (available in all states)
3. View chronological list of all order events

### Event Data Structure
Each event includes:
```typescript
{
  id: string;
  event_type: string;
  performed_by_name: string;
  performed_at: string;
  description: string;
  event_data?: {
    // Event-specific data
    // e.g., for PAYMENT_RECEIVED:
    amount: number;
    payment_mode: string;
    payment_date: string;
  };
}
```

## Benefits
1. **Complete Transparency** - Full visibility into order lifecycle
2. **Audit Compliance** - Track who did what and when
3. **Debugging** - Easily trace order issues
4. **User Accountability** - All actions are logged with user info
5. **Historical Analysis** - Understand order patterns and workflows

## Future Enhancements
- Export audit log to PDF/Excel
- Filter events by type
- Search within audit log
- Email notifications for specific events
- Retention policies for old logs
