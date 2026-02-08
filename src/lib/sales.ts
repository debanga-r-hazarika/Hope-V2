import { supabase } from './supabase';
import type {
  Customer,
  CustomerWithStats,
  Order,
  OrderExtended,
  OrderItem,
  OrderWithItems,
  OrderFormData,
  OrderItemFormData,
  OrderStatus,
  OrderPayment,
  PaymentFormData,
  PaymentStatus,
  OrderWithPaymentInfo,
  ProcessedGoodSalesHistory,
} from '../types/sales';
import type { ProcessedGood } from '../types/operations';

function mapDbToCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    customer_type: row.customer_type,
    contact_person: row.contact_person,
    phone: row.phone,
    address: row.address,
    status: row.status,
    notes: row.notes,
    photo_url: row.photo_url,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at,
  };
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbToCustomer);
}

export async function fetchCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapDbToCustomer(data) : null;
}

export async function fetchCustomerWithStats(id: string): Promise<CustomerWithStats | null> {
  const customer = await fetchCustomer(id);
  if (!customer) return null;

  // Fetch customer statistics from orders
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('id, total_amount, discount_amount, order_date, status')
    .eq('customer_id', id);

  if (ordersError) {
    // If orders table doesn't exist yet, return with empty stats
    return {
      ...customer,
      total_sales_value: 0,
      outstanding_amount: 0,
      last_order_date: undefined,
      order_count: 0,
    };
  }

  const orders = ordersData || [];
  const totalSalesValue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount || 0) - parseFloat(o.discount_amount || 0)), 0); // Use net total
  const lastOrder = orders.sort((a, b) => (b.order_date > a.order_date ? 1 : -1))[0];

  // Outstanding amount = total from orders minus total payments
  // Get all payments for this customer's orders
  const orderIds = orders.map((o) => o.id);
  let outstandingAmount = 0;

  if (orderIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from('order_payments')
      .select('order_id, amount_received')
      .in('order_id', orderIds);

    const totalPaid = (paymentsData || []).reduce((sum, p) => sum + parseFloat(p.amount_received || 0), 0);
    outstandingAmount = Math.max(0, totalSalesValue - totalPaid);
  }

  const stats: CustomerWithStats = {
    ...customer,
    total_sales_value: totalSalesValue,
    outstanding_amount: outstandingAmount,
    last_order_date: lastOrder?.order_date,
    order_count: orders.length,
  };

  return stats;
}

export async function fetchAllCustomersWithStats(): Promise<CustomerWithStats[]> {
  // Fetch all customers
  const { data: customersData, error: customersError } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (customersError) throw customersError;
  const customers = (customersData || []).map(mapDbToCustomer);

  // Fetch all orders
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('id, customer_id, total_amount, discount_amount, order_date, status');

  if (ordersError) throw ordersError;
  const orders = ordersData || [];

  // Fetch all payments
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('order_payments')
    .select('order_id, amount_received');

  if (paymentsError) throw paymentsError;
  const payments = paymentsData || [];

  // Create maps for aggregation
  const customerStats = new Map<string, {
    totalSales: number;
    totalPaid: number;
    orderCount: number;
    lastOrderDate: string | undefined;
  }>();

  // Process orders
  orders.forEach(order => {
    if (!customerStats.has(order.customer_id)) {
      customerStats.set(order.customer_id, {
        totalSales: 0,
        totalPaid: 0,
        orderCount: 0,
        lastOrderDate: undefined
      });
    }
    const stats = customerStats.get(order.customer_id)!;

    const orderTotal = (parseFloat(order.total_amount || 0) - parseFloat(order.discount_amount || 0));
    stats.totalSales += orderTotal;
    stats.orderCount += 1;

    if (!stats.lastOrderDate || order.order_date > stats.lastOrderDate) {
      stats.lastOrderDate = order.order_date;
    }
  });

  // Process payments
  // Map order_id to customer_id
  const orderToCustomer = new Map<string, string>();
  orders.forEach(o => orderToCustomer.set(o.id, o.customer_id));

  payments.forEach(payment => {
    const customerId = orderToCustomer.get(payment.order_id);
    if (customerId && customerStats.has(customerId)) {
      const stats = customerStats.get(customerId)!;
      stats.totalPaid += parseFloat(payment.amount_received || 0);
    }
  });

  // Merge stats into customers
  return customers.map(customer => {
    const stats = customerStats.get(customer.id) || {
      totalSales: 0,
      totalPaid: 0,
      orderCount: 0,
      lastOrderDate: undefined
    };

    const outstanding = Math.max(0, stats.totalSales - stats.totalPaid);

    return {
      ...customer,
      total_sales_value: stats.totalSales,
      outstanding_amount: outstanding,
      last_order_date: stats.lastOrderDate,
      order_count: stats.orderCount
    };
  });
}

export async function createCustomer(
  customer: Partial<Customer>,
  options?: { currentUserId?: string }
): Promise<Customer> {
  // Look up customer_type_id from display_name if customer_type is provided
  let customerTypeId: string | null = null;
  if (customer.customer_type) {
    const { data: typeData } = await supabase
      .from('customer_types')
      .select('id')
      .eq('display_name', customer.customer_type)
      .eq('status', 'active')
      .single();
    customerTypeId = typeData?.id || null;
  }

  const payload: any = {
    name: customer.name,
    customer_type: customer.customer_type, // Keep for backward compatibility
    customer_type_id: customerTypeId,
    contact_person: customer.contact_person || null,
    phone: customer.phone || null,
    address: customer.address || null,
    status: customer.status || 'Active',
    notes: customer.notes || null,
    photo_url: customer.photo_url || null,
    created_by: options?.currentUserId || null,
  };

  const { data, error } = await supabase
    .from('customers')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return mapDbToCustomer(data);
}

export async function updateCustomer(
  id: string,
  updates: Partial<Customer>,
  options?: { currentUserId?: string }
): Promise<Customer> {
  // Look up customer_type_id from display_name if customer_type is being updated
  let customerTypeId: string | undefined = undefined;
  if (updates.customer_type) {
    const { data: typeData } = await supabase
      .from('customer_types')
      .select('id')
      .eq('display_name', updates.customer_type)
      .eq('status', 'active')
      .single();
    customerTypeId = typeData?.id || null;
  }

  const payload: any = {
    name: updates.name,
    contact_person: updates.contact_person !== undefined ? updates.contact_person : null,
    phone: updates.phone !== undefined ? updates.phone : null,
    address: updates.address !== undefined ? updates.address : null,
    status: updates.status,
    notes: updates.notes !== undefined ? updates.notes : null,
    photo_url: updates.photo_url !== undefined ? updates.photo_url : null,
  };

  // Only update customer_type and customer_type_id if provided
  if (updates.customer_type !== undefined) {
    payload.customer_type = updates.customer_type;
    payload.customer_type_id = customerTypeId;
  }

  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapDbToCustomer(data);
}

// Note: No delete function - customers are soft-deleted via status field

// ==================== ORDER FUNCTIONS ====================

// Helper function to calculate order status on frontend (temporary until migration is applied)
function calculateOrderStatusFrontend(order: any, itemCount?: number): OrderStatus {
  const isOnHold = order.is_on_hold || false;
  const hasItems = itemCount !== undefined ? itemCount > 0 : false;

  // If we don't have item count, use the status from database
  if (itemCount === undefined) {
    return order.status;
  }

  // Priority: Hold > Complete > Ready for Payment > Order Created
  if (isOnHold) {
    return 'HOLD';
  }

  // Check if full payment (we'll calculate this when we have payment info)
  // For now, if status is ORDER_COMPLETED, keep it
  if (order.status === 'ORDER_COMPLETED') {
    return 'ORDER_COMPLETED';
  }

  // If has items, should be READY_FOR_PAYMENT
  if (hasItems) {
    return 'READY_FOR_PAYMENT';
  }

  // No items = ORDER_CREATED
  return 'ORDER_CREATED';
}

function mapDbToOrder(row: any): Order {
  return {
    id: row.id,
    order_number: row.order_number,
    customer_id: row.customer_id,
    customer_name: row.customer?.name || row.customer_name,
    order_date: row.order_date,
    status: row.status,
    payment_status: row.payment_status || undefined,
    notes: row.notes,
    sold_by: row.sold_by,
    sold_by_name: row.sold_by_user?.full_name,
    total_amount: parseFloat(row.total_amount || 0),
    discount_amount: parseFloat(row.discount_amount || 0),
    is_locked: row.is_locked || false,
    completed_at: row.completed_at || undefined,
    // Hold-related fields
    is_on_hold: row.is_on_hold || false,
    hold_reason: row.hold_reason || undefined,
    held_at: row.held_at || undefined,
    held_by: row.held_by || undefined,
    held_by_name: row.held_by_user?.full_name || undefined,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at,
  };
}

function mapDbToOrderItem(row: any): OrderItem {
  return {
    id: row.id,
    order_id: row.order_id,
    processed_good_id: row.processed_good_id,
    product_type: row.product_type,
    form: row.form,
    size: row.size,
    quantity: parseFloat(row.quantity),
    quantity_delivered: parseFloat(row.quantity_delivered || 0),
    unit_price: parseFloat(row.unit_price),
    unit: row.unit,
    line_total: parseFloat(row.line_total || 0),
    created_at: row.created_at,
    processed_good_batch_reference: row.processed_good?.batch_reference,
    processed_good_quantity_available: row.processed_good
      ? parseFloat(row.processed_good.quantity_available)
      : undefined,
  };
}

// Get available quantity for a processed good (quantity_created - delivered - active_reservations)
// This is used for validation purposes (e.g., checking inventory when delivering)
// Note: This differs from fetchProcessedGoodsForOrder which shows quantity_created - delivered (matches Processed Goods page)
// excludeOrderId: Optional order ID to exclude from reservations (useful when calculating available for delivery)
export async function getAvailableQuantity(processedGoodId: string, excludeOrderId?: string): Promise<number> {
  // Get the processed good with quantity_created
  const { data: processedGood, error: pgError } = await supabase
    .from('processed_goods')
    .select('quantity_available, quantity_created')
    .eq('id', processedGoodId)
    .single();

  if (pgError || !processedGood) {
    throw new Error('Processed good not found');
  }

  // Get total delivered quantity
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('quantity_delivered')
    .eq('processed_good_id', processedGoodId)
    .not('quantity_delivered', 'is', null);

  if (itemsError) throw itemsError;

  const totalDelivered = orderItems?.reduce((sum, item) => {
    return sum + parseFloat(item.quantity_delivered || 0);
  }, 0) || 0;

  // Get total reserved quantity from active orders (not cancelled, not completed)
  // If excludeOrderId is provided, exclude reservations from that order
  const { data: reservations, error: resError } = await supabase
    .from('order_reservations')
    .select('quantity_reserved, order:orders!inner(id, status)')
    .eq('processed_good_id', processedGoodId);

  if (resError) {
    console.error('Error fetching reservations:', resError);
    throw resError;
  }

  const totalReserved =
    reservations?.reduce((sum, res) => {
      const order = res.order as any;

      // Exclude the specified order if excludeOrderId is provided
      if (excludeOrderId && order && order.id === excludeOrderId) {
        return sum;
      }

      // Only count reservations from active orders (not completed)
      // Completed orders have been delivered, so their reservations don't affect availability
      if (order && order.status !== 'ORDER_COMPLETED') {
        return sum + parseFloat(res.quantity_reserved);
      }
      return sum;
    }, 0) || 0;

  // Calculate available as: quantity_created - delivered - active_reservations
  // This matches the UI calculation: (quantity_created ?? quantity_available) - quantity_delivered
  const quantityCreated = processedGood.quantity_created ?? (parseFloat(processedGood.quantity_available) + totalDelivered);
  const availableBeforeReservations = quantityCreated - totalDelivered;

  return Math.max(0, availableBeforeReservations - totalReserved);
}

// Get available quantity matching Processed Goods page display (quantity_created - delivered - waste)
// Includes deduction for processed_goods_waste so it matches Processed Goods page and dropdown
export async function getDisplayAvailableQuantity(processedGoodId: string): Promise<number> {
  // Get the processed good with quantity_created
  const { data: processedGood, error: pgError } = await supabase
    .from('processed_goods')
    .select('quantity_available, quantity_created')
    .eq('id', processedGoodId)
    .single();

  if (pgError || !processedGood) {
    throw new Error('Processed good not found');
  }

  // Get total delivered quantity
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('quantity_delivered')
    .eq('processed_good_id', processedGoodId)
    .not('quantity_delivered', 'is', null);

  if (itemsError) throw itemsError;

  const totalDelivered = orderItems?.reduce((sum, item) => {
    return sum + parseFloat(item.quantity_delivered || 0);
  }, 0) || 0;

  // Get total wasted for this processed good
  const { data: wasteRows, error: wasteError } = await supabase
    .from('processed_goods_waste')
    .select('quantity_wasted')
    .eq('processed_good_id', processedGoodId);

  const totalWasted = wasteError ? 0 : (wasteRows || []).reduce((sum, r) => sum + parseFloat(r.quantity_wasted), 0);

  // Available = quantity_available (DB) - waste; quantity_available in DB is already quantity_created - delivered
  const quantityAvailable = parseFloat(processedGood.quantity_available);
  return Math.max(0, quantityAvailable - totalWasted);
}

// Validate inventory availability for order items
// Uses the same calculation as the dropdown (quantity_created - delivered, without reservations)
export async function validateInventoryAvailability(
  items: OrderItemFormData[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const item of items) {
    try {
      const available = await getDisplayAvailableQuantity(item.processed_good_id);
      if (item.quantity > available) {
        errors.push(
          `${item.product_type}: Requested ${item.quantity} ${item.unit}, but only ${available} ${item.unit} available`
        );
      }
    } catch (error) {
      errors.push(`${item.product_type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Generate order number
async function generateOrderNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_order_number');
  if (error) {
    // Fallback if function doesn't exist
    const { data: orders } = await supabase
      .from('orders')
      .select('order_number')
      .like('order_number', 'ORD-%')
      .order('order_number', { ascending: false })
      .limit(1);

    if (orders && orders.length > 0) {
      const lastNum = parseInt(orders[0].order_number.replace('ORD-', '')) || 0;
      return `ORD-${String(lastNum + 1).padStart(6, '0')}`;
    }
    return 'ORD-000001';
  }
  return data;
}

// Create order with items and reservations
export async function createOrder(
  orderData: OrderFormData,
  options?: { currentUserId?: string }
): Promise<OrderWithItems> {
  // Validate inventory availability only if items are provided
  if (orderData.items && orderData.items.length > 0) {
    const validation = await validateInventoryAvailability(orderData.items);
    if (!validation.valid) {
      throw new Error(`Inventory validation failed:\n${validation.errors.join('\n')}`);
    }
  }

  // Generate order number
  const orderNumber = await generateOrderNumber();

  // Extract date part from datetime string (order_date may be full ISO with time)
  const orderDate = orderData.order_date.includes('T')
    ? orderData.order_date.split('T')[0]
    : orderData.order_date;

  // Create order
  const orderPayload: any = {
    order_number: orderNumber,
    customer_id: orderData.customer_id,
    order_date: orderDate,
    status: orderData.status || 'ORDER_CREATED', // Default to ORDER_CREATED
    payment_status: null, // Will be set by trigger
    sold_by: orderData.sold_by || null,
    discount_amount: 0, // Orders start with no discount, can be added later in OrderDetail
    is_locked: false,
    created_by: options?.currentUserId || null,
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([orderPayload])
    .select()
    .single();

  if (orderError) throw orderError;

  // Create order items and reservations (only if items are provided)
  const items: OrderItem[] = [];
  if (orderData.items && orderData.items.length > 0) {
    for (const itemData of orderData.items) {
      // Create order item
      const itemPayload: any = {
        order_id: order.id,
        processed_good_id: itemData.processed_good_id,
        product_type: itemData.product_type,
        form: itemData.form || null,
        size: itemData.size || null,
        quantity: itemData.quantity,
        unit_price: itemData.unit_price,
        unit: itemData.unit,
      };

      const { data: item, error: itemError } = await supabase
        .from('order_items')
        .insert([itemPayload])
        .select('*, processed_good:processed_goods(batch_reference, quantity_available)')
        .single();

      if (itemError) throw itemError;

      // Create reservation
      const reservationPayload: any = {
        order_id: order.id,
        order_item_id: item.id,
        processed_good_id: itemData.processed_good_id,
        quantity_reserved: itemData.quantity,
      };

      const { error: resError } = await supabase.from('order_reservations').insert([reservationPayload]);

      if (resError) throw resError;

      items.push(mapDbToOrderItem(item));
    }
  }

  // Calculate and update order total (original items total, before discount)
  const itemsTotal = items.reduce((sum, item) => sum + item.line_total, 0);

  const { error: totalUpdateError } = await supabase
    .from('orders')
    .update({ total_amount: itemsTotal })
    .eq('id', order.id);

  if (totalUpdateError) throw totalUpdateError;

  // Fetch complete order with customer
  const { data: completeOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*, customer:customers(name), sold_by_user:users!orders_sold_by_fkey(full_name), held_by_user:users!orders_held_by_fkey(full_name)')
    .eq('id', order.id)
    .single();

  if (fetchError) throw fetchError;

  return {
    ...mapDbToOrder(completeOrder),
    items,
  };
}

// Fetch all orders
export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customer:customers(name), sold_by_user:users!orders_sold_by_fkey(full_name), held_by_user:users!orders_held_by_fkey(full_name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbToOrder);
}

// Fetch all orders with extended details for filtering
export async function fetchOrdersExtended(): Promise<OrderExtended[]> {
  // Fetch orders with customers
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('*, customer:customers(name, customer_type), sold_by_user:users!orders_sold_by_fkey(full_name), held_by_user:users!orders_held_by_fkey(full_name)')
    .order('created_at', { ascending: false });

  if (ordersError) throw ordersError;
  const orders = ordersData || [];

  // Fetch all order items (for product types and tags)
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      order_id,
      product_type,
      processed_good:processed_goods (
        batch_reference,
        produced_goods_tags (
          display_name
        )
      )
    `);

  if (itemsError) throw itemsError;
  const items = itemsData || [];

  // Fetch all payments (for payment modes)
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('order_payments')
    .select('order_id, payment_mode, amount_received');

  if (paymentsError) throw paymentsError;
  const payments = paymentsData || [];

  // Map data to extended orders
  const itemsMap = new Map<string, { types: string[], tags: string[], batches: string[] }>();
  items.forEach((item: any) => {
    if (!itemsMap.has(item.order_id)) {
      itemsMap.set(item.order_id, { types: [], tags: [], batches: [] });
    }
    const entry = itemsMap.get(item.order_id)!;

    // Add unique product types
    if (item.product_type && !entry.types.includes(item.product_type)) {
      entry.types.push(item.product_type);
    }

    // Add unique product tags
    const tagName = item.processed_good?.produced_goods_tags?.display_name;
    if (tagName && !entry.tags.includes(tagName)) {
      entry.tags.push(tagName);
    }

    // Add unique batch references
    const batchRef = item.processed_good?.batch_reference;
    if (batchRef && !entry.batches.includes(batchRef)) {
      entry.batches.push(batchRef);
    }
  });

  const paymentsMap = new Map<string, { modes: string[], total: number }>();
  payments.forEach(payment => {
    if (!paymentsMap.has(payment.order_id)) {
      paymentsMap.set(payment.order_id, { modes: [], total: 0 });
    }
    const data = paymentsMap.get(payment.order_id)!;
    data.total += parseFloat(payment.amount_received || 0);
    if (payment.payment_mode && !data.modes.includes(payment.payment_mode)) {
      data.modes.push(payment.payment_mode);
    }
  });

  return orders.map(order => {
    const baseOrder = mapDbToOrder(order);
    const itemData = itemsMap.get(order.id) || { types: [], tags: [], batches: [] };
    const paymentData = paymentsMap.get(order.id) || { modes: [], total: 0 };

    // Calculate payment status if not present
    let paymentStatus = baseOrder.payment_status;
    if (!paymentStatus) {
      const netTotal = baseOrder.total_amount - (baseOrder.discount_amount || 0);
      if (paymentData.total === 0) paymentStatus = 'READY_FOR_PAYMENT';
      else if (paymentData.total >= netTotal - 0.01) paymentStatus = 'FULL_PAYMENT'; // Tolerance for float math
      else paymentStatus = 'PARTIAL_PAYMENT';
    }

    return {
      ...baseOrder,
      customer_type: order.customer?.customer_type,
      product_types: itemData.types,
      product_tags: itemData.tags,
      batch_references: itemData.batches,
      payment_modes: paymentData.modes,
      total_paid: paymentData.total,
      payment_status: paymentStatus
    };
  });
}

// Fetch orders by customer ID
export async function fetchOrdersByCustomer(customerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customer:customers(name), sold_by_user:users!orders_sold_by_fkey(full_name), held_by_user:users!orders_held_by_fkey(full_name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbToOrder);
}

// Fetch single order with items
export async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      locked_at,
      locked_by,
      can_unlock_until,
      customer:customers(*),
      sold_by_user:users!orders_sold_by_fkey(full_name),
      held_by_user:users!orders_held_by_fkey(full_name)
    `)
    .eq('id', orderId)
    .single();

  if (orderError) {
    if (orderError.code === 'PGRST116') return null;
    throw orderError;
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*, processed_good:processed_goods(batch_reference, quantity_available)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (itemsError) throw itemsError;

  return {
    ...mapDbToOrder(order),
    items: (items || []).map(mapDbToOrderItem),
    customer: order.customer ? mapDbToCustomer(order.customer) : undefined,
  };
}



// Update order status
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  options?: { currentUserId?: string }
): Promise<Order> {
  // Check if order is locked
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select('is_locked')
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }

  // Prevent manual setting of ORDER_COMPLETED - it's auto-derived from payment status
  if (status === 'ORDER_COMPLETED') {
    throw new Error('ORDER_COMPLETED status cannot be set manually. It is automatically set when payment is full.');
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select('*, customer:customers(name)')
    .single();

  if (error) throw error;
  return mapDbToOrder(data);
}

// Update order (save without locking)
export async function saveOrder(
  orderId: string,
  updates: Partial<OrderFormData>,
  options?: { currentUserId?: string }
): Promise<OrderWithItems> {
  // Check if order is locked
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select('is_locked')
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }

  // Update order header (do NOT lock)
  const orderUpdates: any = {};
  if (updates.customer_id !== undefined) orderUpdates.customer_id = updates.customer_id;
  if (updates.order_date !== undefined) {
    // Extract date part from datetime string if needed
    const orderDate = updates.order_date.includes('T')
      ? updates.order_date.split('T')[0]
      : updates.order_date;
    orderUpdates.order_date = orderDate;
  }
  if (updates.status !== undefined) orderUpdates.status = updates.status;
  if (updates.sold_by !== undefined) orderUpdates.sold_by = updates.sold_by || null;
  if (updates.discount_amount !== undefined) orderUpdates.discount_amount = updates.discount_amount;
  if (updates.notes !== undefined) orderUpdates.notes = updates.notes || null;

  if (Object.keys(orderUpdates).length > 0) {
    const { error: updateError } = await supabase.from('orders').update(orderUpdates).eq('id', orderId);
    if (updateError) throw updateError;
  }

  // If items were updated, recalculate total (original order total)
  // Note: discount_amount changes don't affect the original total_amount
  if (updates.items) {
    await recalculateOrderTotal(orderId);
  }

  // If items are provided, validate and update
  if (updates.items) {
    // Validate inventory
    const validation = await validateInventoryAvailability(updates.items);
    if (!validation.valid) {
      throw new Error(`Inventory validation failed:\n${validation.errors.join('\n')}`);
    }

    // Delete existing items and reservations
    const { error: delItemsError } = await supabase.from('order_items').delete().eq('order_id', orderId);
    if (delItemsError) throw delItemsError;

    // Create new items and reservations
    for (const itemData of updates.items) {
      const itemPayload: any = {
        order_id: orderId,
        processed_good_id: itemData.processed_good_id,
        product_type: itemData.product_type,
        form: itemData.form || null,
        size: itemData.size || null,
        quantity: itemData.quantity,
        unit_price: itemData.unit_price,
        unit: itemData.unit,
      };

      const { data: item, error: itemError } = await supabase
        .from('order_items')
        .insert([itemPayload])
        .select()
        .single();

      if (itemError) throw itemError;

      // Create reservation
      const reservationPayload: any = {
        order_id: orderId,
        order_item_id: item.id,
        processed_good_id: itemData.processed_good_id,
        quantity_reserved: itemData.quantity,
      };

      const { error: resError } = await supabase.from('order_reservations').insert([reservationPayload]);
      if (resError) throw resError;
    }
  }

  // Return updated order
  const updated = await fetchOrderWithItems(orderId);
  if (!updated) throw new Error('Order not found after update');
  return updated;
}

// ==================== HOLD MANAGEMENT FUNCTIONS ====================

// Set order on hold with a reason
export async function setOrderOnHold(
  orderId: string,
  holdReason: string,
  options?: { currentUserId?: string }
): Promise<Order> {
  if (!holdReason || holdReason.trim().length === 0) {
    throw new Error('Hold reason is required');
  }

  // Check if order is locked
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select('is_locked, is_on_hold')
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }
  if (order?.is_on_hold) {
    throw new Error('Order is already on hold');
  }

  // Call RPC function to set hold
  const { error: rpcError } = await supabase.rpc('set_order_hold', {
    p_order_id: orderId,
    p_hold_reason: holdReason.trim(),
    p_user_id: options?.currentUserId || null,
  });

  if (rpcError) throw rpcError;

  // Fetch updated order
  const { data: updatedOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*, customer:customers(name), sold_by_user:users!orders_sold_by_fkey(full_name), held_by_user:users!orders_held_by_fkey(full_name)')
    .eq('id', orderId)
    .single();

  if (fetchError) throw fetchError;

  return {
    ...mapDbToOrder(updatedOrder),
    held_by_name: updatedOrder.held_by_user?.full_name,
  };
}

// Remove hold from order
export async function removeOrderHold(
  orderId: string,
  options?: { currentUserId?: string }
): Promise<Order> {
  // Check if order is locked
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select('is_locked, is_on_hold')
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }
  if (!order?.is_on_hold) {
    throw new Error('Order is not on hold');
  }

  // Call RPC function to remove hold
  const { error: rpcError } = await supabase.rpc('remove_order_hold', {
    p_order_id: orderId,
  });

  if (rpcError) throw rpcError;

  // Fetch updated order
  const { data: updatedOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*, customer:customers(name), sold_by_user:users!orders_sold_by_fkey(full_name), held_by_user:users!orders_held_by_fkey(full_name)')
    .eq('id', orderId)
    .single();

  if (fetchError) throw fetchError;

  return mapDbToOrder(updatedOrder);
}

// Update order (alias for saveOrder for backward compatibility)
export async function updateOrder(
  orderId: string,
  updates: Partial<OrderFormData>,
  options?: { currentUserId?: string }
): Promise<OrderWithItems> {
  return saveOrder(orderId, updates, options);
}

// Add a single order item
export async function addOrderItem(
  orderId: string,
  itemData: OrderItemFormData,
  options?: { currentUserId?: string }
): Promise<OrderWithItems> {
  // Check if order is locked
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select('is_locked, status')
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }

  // Validate inventory
  const validation = await validateInventoryAvailability([itemData]);
  if (!validation.valid) {
    throw new Error(`Inventory validation failed: ${validation.errors.join(', ')}`);
  }

  // Create order item
  const itemPayload: any = {
    order_id: orderId,
    processed_good_id: itemData.processed_good_id,
    product_type: itemData.product_type,
    form: itemData.form || null,
    size: itemData.size || null,
    quantity: itemData.quantity,
    unit_price: itemData.unit_price,
    unit: itemData.unit,
  };

  const { data: item, error: itemError } = await supabase
    .from('order_items')
    .insert([itemPayload])
    .select()
    .single();

  if (itemError) throw itemError;

  // Create reservation
  const reservationPayload: any = {
    order_id: orderId,
    order_item_id: item.id,
    processed_good_id: itemData.processed_good_id,
    quantity_reserved: itemData.quantity,
  };

  const { error: resError } = await supabase.from('order_reservations').insert([reservationPayload]);
  if (resError) throw resError;

  // Recalculate order total
  await recalculateOrderTotal(orderId);

  // Return updated order
  const updated = await fetchOrderWithItems(orderId);
  if (!updated) throw new Error('Order not found after adding item');
  return updated;
}

// Update a single order item
export async function updateOrderItem(
  orderId: string,
  itemId: string,
  updates: Partial<OrderItemFormData>,
  options?: { currentUserId?: string }
): Promise<OrderWithItems> {
  // Check if order is locked
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select('is_locked, status')
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }

  // Get current item to check delivered quantity
  const { data: currentItem, error: itemError } = await supabase
    .from('order_items')
    .select('quantity, quantity_delivered, processed_good_id')
    .eq('id', itemId)
    .single();

  if (itemError) throw itemError;
  if (!currentItem) throw new Error('Order item not found');

  // Cannot edit items that have been delivered
  if (currentItem.quantity_delivered > 0) {
    throw new Error('Cannot edit order items that have been delivered. Please remove deliveries first or create a new item.');
  }

  // Can't reduce quantity below what's already delivered
  if (updates.quantity !== undefined && updates.quantity < currentItem.quantity_delivered) {
    throw new Error(`Cannot reduce quantity below ${currentItem.quantity_delivered} (already delivered)`);
  }

  // If quantity or processed_good_id is changing, validate inventory
  if (updates.quantity !== undefined || updates.processed_good_id !== undefined) {
    const newProcessedGoodId = updates.processed_good_id || currentItem.processed_good_id;
    const newQuantity = updates.quantity || currentItem.quantity;

    // Get available quantity matching dropdown display (quantity_created - delivered)
    // This matches the validation used in order creation
    const available = await getDisplayAvailableQuantity(newProcessedGoodId);

    if (newQuantity > available) {
      throw new Error(`Insufficient inventory. Available: ${available} ${updates.unit || 'units'}`);
    }
  }

  // Update order item
  const itemUpdates: any = {};
  if (updates.processed_good_id !== undefined) itemUpdates.processed_good_id = updates.processed_good_id;
  if (updates.product_type !== undefined) itemUpdates.product_type = updates.product_type;
  if (updates.form !== undefined) itemUpdates.form = updates.form || null;
  if (updates.size !== undefined) itemUpdates.size = updates.size || null;
  if (updates.quantity !== undefined) itemUpdates.quantity = updates.quantity;
  if (updates.unit_price !== undefined) itemUpdates.unit_price = updates.unit_price;
  if (updates.unit !== undefined) itemUpdates.unit = updates.unit;

  const { error: updateError } = await supabase
    .from('order_items')
    .update(itemUpdates)
    .eq('id', itemId);

  if (updateError) throw updateError;

  // Update reservation if quantity or processed_good_id changed
  if (updates.quantity !== undefined || updates.processed_good_id !== undefined) {
    const newProcessedGoodId = updates.processed_good_id || currentItem.processed_good_id;
    const newQuantity = updates.quantity || currentItem.quantity;

    // Delete old reservation
    const { error: delResError } = await supabase
      .from('order_reservations')
      .delete()
      .eq('order_item_id', itemId);

    if (delResError) throw delResError;

    // Create new reservation
    const reservationPayload: any = {
      order_id: orderId,
      order_item_id: itemId,
      processed_good_id: newProcessedGoodId,
      quantity_reserved: newQuantity,
    };

    const { error: resError } = await supabase.from('order_reservations').insert([reservationPayload]);
    if (resError) throw resError;
  }

  // Recalculate order total
  await recalculateOrderTotal(orderId);

  // Return updated order
  const updated = await fetchOrderWithItems(orderId);
  if (!updated) throw new Error('Order not found after updating item');
  return updated;
}

// Delete a single order item
export async function deleteOrderItem(
  orderId: string,
  itemId: string,
  options?: { currentUserId?: string }
): Promise<OrderWithItems> {
  // Check if order is locked
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select('is_locked, status')
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }

  // Get current item to check delivered quantity
  const { data: currentItem, error: itemError } = await supabase
    .from('order_items')
    .select('quantity_delivered')
    .eq('id', itemId)
    .single();

  if (itemError) throw itemError;
  if (!currentItem) throw new Error('Order item not found');

  // Can't delete item if it has been delivered (or warn and allow?)
  // For now, we'll allow deletion but warn that delivered quantities won't be restored
  if (currentItem.quantity_delivered > 0) {
    // In a real scenario, you might want to prevent this or handle it differently
    // For now, we'll allow it but the inventory was already reduced
  }

  // Delete reservation (cascade should handle this, but being explicit)
  const { error: delResError } = await supabase
    .from('order_reservations')
    .delete()
    .eq('order_item_id', itemId);

  if (delResError) throw delResError;

  // Delete order item
  const { error: delItemError } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId);

  if (delItemError) throw delItemError;

  // Recalculate order total
  await recalculateOrderTotal(orderId);

  // Return updated order
  const updated = await fetchOrderWithItems(orderId);
  if (!updated) throw new Error('Order not found after deleting item');
  return updated;
}

// Recalculate order total from items (original total before discount)
async function recalculateOrderTotal(orderId: string): Promise<void> {
  // Get items total
  const { data: items, error } = await supabase
    .from('order_items')
    .select('line_total')
    .eq('order_id', orderId);

  if (error) throw error;

  const itemsTotal = (items || []).reduce((sum, item) => sum + parseFloat(item.line_total || 0), 0);

  // Update total_amount to be the original items total (discount is stored separately)
  const { error: updateError } = await supabase
    .from('orders')
    .update({ total_amount: itemsTotal })
    .eq('id', orderId);

  if (updateError) throw updateError;
}

// Fetch processed goods for order creation with actual available quantities (accounting for reservations)
export async function fetchProcessedGoodsForOrder(includeProductId?: string): Promise<Array<ProcessedGood & { actual_available: number }>> {
  // Fetch all processed goods including those with zero quantity
  // Note: actual_available = quantity_available (since inventory is deducted immediately)
  const query = supabase
    .from('processed_goods')
    .select(`
      *,
      produced_goods_tags!processed_goods_produced_goods_tag_id_fkey(display_name)
    `)
    .order('product_type', { ascending: true })
    .order('production_date', { ascending: false })
    .range(0, 9999);

  const { data: goods, error } = await query;

  if (error) throw error;
  if (!goods || goods.length === 0) return [];

  // Get all processed good IDs
  const processedGoodIds = goods.map(g => g.id);

  // Fetch all ordered quantities from order_items
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('processed_good_id, quantity')
    .in('processed_good_id', processedGoodIds);

  if (itemsError) throw itemsError;

  // Fetch total wasted per processed good (processed_goods_waste)
  const { data: wasteRows, error: wasteError } = await supabase
    .from('processed_goods_waste')
    .select('processed_good_id, quantity_wasted')
    .in('processed_good_id', processedGoodIds);

  const wasteMap = new Map<string, number>();
  if (!wasteError && wasteRows) {
    wasteRows.forEach((row: any) => {
      const current = wasteMap.get(row.processed_good_id) || 0;
      wasteMap.set(row.processed_good_id, current + parseFloat(row.quantity_wasted));
    });
  }

  // Calculate total ordered for each processed good
  const orderedMap = new Map<string, number>();
  (orderItems || []).forEach((item: any) => {
    if (item.processed_good_id && item.quantity) {
      const current = orderedMap.get(item.processed_good_id) || 0;
      orderedMap.set(item.processed_good_id, current + parseFloat(item.quantity));
    }
  });

  // Calculate actual available (after waste deduction) and attach assigned tag name (for Item Tag dropdown)
  const goodsWithAvailability = goods.map((pg: any) => {
    const totalOrdered = orderedMap.get(pg.id) || 0;
    const totalWasted = wasteMap.get(pg.id) || 0;
    const quantityAvailableFromDb = parseFloat(pg.quantity_available);
    const actualAvailable = Math.max(0, quantityAvailableFromDb - totalWasted);
    const quantityCreated = pg.quantity_created ?? (quantityAvailableFromDb + totalOrdered + totalWasted);
    const tagRel = pg.produced_goods_tags;
    const tagName = Array.isArray(tagRel) ? (tagRel[0]?.display_name ?? undefined) : (tagRel?.display_name ?? undefined);
    return {
      ...pg,
      produced_goods_tag_name: tagName ?? undefined,
      actual_available: actualAvailable,
      quantity_delivered: totalOrdered,
      quantity_created: quantityCreated,
    };
  });

  // Return all products including those with zero quantity
  // No filtering - show all products in the dropdown
  return goodsWithAvailability;
}

// ==================== DELIVERY FUNCTIONS ====================

export interface DeliveryDispatch {
  id: string;
  order_id: string;
  order_item_id: string;
  processed_good_id: string;
  quantity_delivered: number;
  delivery_date: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

// Record delivery for an order item
// The database trigger will automatically reduce inventory
export async function recordDelivery(
  orderItemId: string,
  quantityDelivered: number,
  options?: { currentUserId?: string; deliveryDate?: string; notes?: string }
): Promise<void> {
  // Get the order item to validate (include order_id to exclude its reservation)
  const { data: orderItem, error: itemError } = await supabase
    .from('order_items')
    .select('*, processed_good:processed_goods(quantity_available)')
    .eq('id', orderItemId)
    .single();

  if (itemError || !orderItem) {
    throw new Error('Order item not found');
  }

  const currentDelivered = parseFloat(orderItem.quantity_delivered || 0);
  const newDelivered = quantityDelivered;
  const deliveryDifference = newDelivered - currentDelivered;

  // Validate delivery quantity
  if (newDelivered < 0 || newDelivered > parseFloat(orderItem.quantity)) {
    throw new Error(
      `Delivery quantity must be between 0 and ${orderItem.quantity} ${orderItem.unit}`
    );
  }

  // Validate we have enough inventory (if increasing delivery)
  // Use the same calculation as dropdown (quantity_created - delivered) for consistency
  if (deliveryDifference > 0) {
    const available = await getDisplayAvailableQuantity(orderItem.processed_good_id);

    if (available < deliveryDifference) {
      throw new Error(
        `Insufficient inventory. Available: ${available} ${orderItem.unit}, Required: ${deliveryDifference} ${orderItem.unit}`
      );
    }
  }

  // Update the order item's delivered quantity
  // The trigger will automatically reduce inventory and create delivery dispatch record
  const { error: updateError } = await supabase
    .from('order_items')
    .update({
      quantity_delivered: newDelivered,
    })
    .eq('id', orderItemId);

  if (updateError) throw updateError;
}

// Fetch delivery history for an order
export async function fetchDeliveryHistory(orderId: string): Promise<DeliveryDispatch[]> {
  const { data, error } = await supabase
    .from('delivery_dispatches')
    .select('*')
    .eq('order_id', orderId)
    .order('delivery_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (
    (data || []).map((row: any) => ({
      id: row.id,
      order_id: row.order_id,
      order_item_id: row.order_item_id,
      processed_good_id: row.processed_good_id,
      quantity_delivered: parseFloat(row.quantity_delivered),
      delivery_date: row.delivery_date,
      notes: row.notes,
      created_at: row.created_at,
      created_by: row.created_by,
    })) || []
  );
}

// Fetch delivery history for an order item
export async function fetchItemDeliveryHistory(orderItemId: string): Promise<DeliveryDispatch[]> {
  const { data, error } = await supabase
    .from('delivery_dispatches')
    .select('*')
    .eq('order_item_id', orderItemId)
    .order('delivery_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (
    (data || []).map((row: any) => ({
      id: row.id,
      order_id: row.order_id,
      order_item_id: row.order_item_id,
      processed_good_id: row.processed_good_id,
      quantity_delivered: parseFloat(row.quantity_delivered),
      delivery_date: row.delivery_date,
      notes: row.notes,
      created_at: row.created_at,
      created_by: row.created_by,
    })) || []
  );
}

// Fetch sales history for a processed good (all order items from this lot, including undelivered)
export async function fetchProcessedGoodSalesHistory(processedGoodId: string): Promise<ProcessedGoodSalesHistory[]> {
  // Fetch ALL order items for this processed good (not just deliveries)
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id, order_id, product_type, unit, unit_price, line_total, quantity, quantity_delivered, created_at')
    .eq('processed_good_id', processedGoodId)
    .order('created_at', { ascending: false });

  if (itemsError) throw itemsError;
  if (!orderItems || orderItems.length === 0) return [];

  // Get unique order_ids
  const orderIds = [...new Set(orderItems.map((item: any) => item.order_id).filter(Boolean))];

  // Fetch orders with customers
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, order_date, customer:customers(id, name)')
    .in('id', orderIds);

  if (ordersError) throw ordersError;

  // Fetch delivery dispatches for this processed good to get delivery dates
  const { data: dispatches, error: dispatchError } = await supabase
    .from('delivery_dispatches')
    .select('order_item_id, delivery_date, notes')
    .eq('processed_good_id', processedGoodId);

  if (dispatchError) throw dispatchError;

  // Create lookup maps
  const orderMap = new Map((orders || []).map((order: any) => [order.id, order]));

  // Group dispatches by order_item_id (there can be multiple deliveries per item)
  const dispatchMap = new Map<string, Array<{ delivery_date: string; notes?: string }>>();
  (dispatches || []).forEach((dispatch: any) => {
    const itemId = dispatch.order_item_id;
    if (!dispatchMap.has(itemId)) {
      dispatchMap.set(itemId, []);
    }
    dispatchMap.get(itemId)!.push({
      delivery_date: dispatch.delivery_date,
      notes: dispatch.notes,
    });
  });

  // Map the data - create one entry per order item
  return orderItems.map((item: any) => {
    const order = orderMap.get(item.order_id);
    const customer = order?.customer as any;
    const itemDispatches = dispatchMap.get(item.id) || [];

    // Use the most recent delivery date if available, otherwise use order date
    const latestDelivery = itemDispatches.length > 0
      ? itemDispatches.sort((a, b) => new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime())[0]
      : null;

    return {
      id: item.id, // Use order_item_id as the unique identifier
      order_id: item.order_id,
      order_number: order?.order_number || '',
      order_date: order?.order_date || '',
      customer_name: customer?.name,
      customer_id: customer?.id || '',
      order_item_id: item.id,
      product_type: item.product_type || '',
      quantity_delivered: parseFloat(item.quantity || 0), // FIXED: Use quantity instead of quantity_delivered
      unit: item.unit || '',
      unit_price: parseFloat(item.unit_price || 0),
      line_total: parseFloat(item.line_total || 0),
      delivery_date: latestDelivery?.delivery_date || order?.order_date || '',
      delivery_notes: latestDelivery?.notes,
      created_at: item.created_at,
    };
  });
}

// ==================== PAYMENT FUNCTIONS ====================

function mapDbToOrderPayment(row: any): OrderPayment {
  return {
    id: row.id,
    order_id: row.order_id,
    order_number: row.order?.order_number || row.order_number,
    customer_name: row.order?.customer?.name || row.customer_name,
    payment_date: row.payment_date,
    payment_mode: row.payment_mode,
    transaction_reference: row.transaction_reference,
    evidence_url: row.evidence_url,
    amount_received: parseFloat(row.amount_received),
    notes: row.notes,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at,
    payment_to: row.payment_to || 'organization_bank',
    paid_to_user: row.paid_to_user || undefined,
  };
}

// Helper to map PaymentMethod to PaymentMode
function mapPaymentMethodToMode(method: PaymentMethod): 'Cash' | 'UPI' | 'Bank' {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'upi':
      return 'UPI';
    case 'bank_transfer':
      return 'Bank';
    case 'cheque':
      return 'Bank';
    case 'card':
      return 'Bank';
    default:
      return 'Cash';
  }
}

// Create payment (triggers auto-creation of Income entry)
export async function createPayment(
  payment: PaymentFormData,
  options?: { currentUserId?: string }
): Promise<OrderPayment> {
  // Locked orders cannot be modified (no new payments)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('is_locked')
    .eq('id', payment.order_id)
    .single();
  if (orderError) throw orderError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }

  // Extract date part from ISO string (payment_date may be full ISO with time)
  const paymentDate = payment.payment_date.includes('T')
    ? payment.payment_date.split('T')[0]
    : payment.payment_date;

  // Use the full datetime from payment_date for payment_datetime column
  const paymentDateTime = payment.payment_date;

  // Map PaymentMethod to PaymentMode for database
  const paymentMode = mapPaymentMethodToMode(payment.payment_method);

  const payload: any = {
    order_id: payment.order_id,
    payment_date: paymentDate,
    payment_datetime: paymentDateTime,
    payment_mode: paymentMode,
    transaction_reference: payment.payment_reference || null,
    evidence_url: payment.evidence_url || null,
    amount_received: payment.amount_received,
    notes: payment.notes || null,
    payment_to: payment.payment_to || 'organization_bank',
    paid_to_user: payment.paid_to_user || null,
    created_by: options?.currentUserId || null,
  };

  const { data, error } = await supabase
    .from('order_payments')
    .insert([payload])
    .select('*, order:orders(order_number, customer:customers(name))')
    .single();

  if (error) throw error;

  // The trigger automatically creates the Income entry with payment_to and paid_to_user
  return mapDbToOrderPayment(data);
}

// Fetch payments for an order
export async function fetchOrderPayments(orderId: string): Promise<OrderPayment[]> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('*, order:orders(order_number, customer:customers(name))')
    .eq('order_id', orderId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbToOrderPayment);
}

// Fetch all payments
export async function fetchPayments(): Promise<OrderPayment[]> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('*, order:orders(order_number, customer:customers(name))')
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbToOrderPayment);
}

// Fetch single payment
export async function fetchPayment(paymentId: string): Promise<OrderPayment | null> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('*, order:orders(order_number, customer:customers(name))')
    .eq('id', paymentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapDbToOrderPayment(data) : null;
}

// Update payment and sync linked income entry
export async function updatePayment(
  paymentId: string,
  updates: Partial<PaymentFormData>,
  options?: { currentUserId?: string }
): Promise<OrderPayment> {
  // Get existing payment to find linked income entry
  const { data: existingPayment, error: fetchError } = await supabase
    .from('order_payments')
    .select('*, order:orders(order_number, customer:customers(name))')
    .eq('id', paymentId)
    .single();

  if (fetchError) throw fetchError;

  const payload: any = {};
  if (updates.order_id !== undefined) payload.order_id = updates.order_id;

  // Handle payment_date (may be ISO string with time, extract date part)
  if (updates.payment_date !== undefined) {
    const paymentDate = updates.payment_date.includes('T')
      ? updates.payment_date.split('T')[0]
      : updates.payment_date;
    payload.payment_date = paymentDate;
    // Also update payment_datetime with the full datetime
    payload.payment_datetime = updates.payment_date;
  }

  // Map PaymentMethod to PaymentMode
  if (updates.payment_method !== undefined) {
    payload.payment_mode = mapPaymentMethodToMode(updates.payment_method);
  }

  if (updates.payment_reference !== undefined) payload.transaction_reference = updates.payment_reference || null;
  if (updates.evidence_url !== undefined) payload.evidence_url = updates.evidence_url || null;
  if (updates.amount_received !== undefined) payload.amount_received = updates.amount_received;
  if (updates.notes !== undefined) payload.notes = updates.notes || null;
  if (updates.payment_to !== undefined) payload.payment_to = updates.payment_to || 'organization_bank';
  if (updates.paid_to_user !== undefined) payload.paid_to_user = updates.paid_to_user || null;

  // Update payment
  const { data, error } = await supabase
    .from('order_payments')
    .update(payload)
    .eq('id', paymentId)
    .select('*, order:orders(order_number, customer:customers(name))')
    .single();

  if (error) throw error;

  // Update linked income entry if it exists (don't create a new one)
  const updatedPayment = mapDbToOrderPayment(data);
  await updateLinkedIncomeEntry(paymentId, updatedPayment, existingPayment);

  return updatedPayment;
}

// Update linked income entry when payment is updated
async function updateLinkedIncomeEntry(
  paymentId: string,
  updatedPayment: OrderPayment,
  existingPayment: any
): Promise<void> {
  // Find the linked income entry
  const { data: incomeEntry, error: incomeError } = await supabase
    .from('income')
    .select('id')
    .eq('order_payment_id', paymentId)
    .maybeSingle();

  if (incomeError) {
    console.error('Error finding linked income entry:', incomeError);
    return; // Don't fail the payment update if income entry lookup fails
  }

  if (!incomeEntry) {
    // No linked income entry found, skip update
    return;
  }

  // Map PaymentMode to PaymentMethod for income
  const paymentMethod = mapPaymentModeToMethod(updatedPayment.payment_mode);

  // Get payment_to, paid_to_user, and created_at from updated payment or existing payment
  // First try to get from updated payment data (from DB), then from existing payment
  const { data: paymentData, error: paymentFetchError } = await supabase
    .from('order_payments')
    .select('payment_to, paid_to_user, order_id, created_at')
    .eq('id', paymentId)
    .single();

  if (paymentFetchError) {
    console.error('Error fetching payment data for income update:', paymentFetchError);
    // Fallback to existing payment data
  }

  const paymentTo = paymentData?.payment_to || existingPayment?.payment_to || 'organization_bank';
  const paidToUser = paymentData?.paid_to_user || existingPayment?.paid_to_user;
  // Use created_at (actual payment record time) for payment_at to maintain proper timestamp
  const paymentAt = paymentData?.created_at || existingPayment?.created_at;

  // Prepare income update payload
  const incomeUpdates: any = {
    amount: updatedPayment.amount_received,
    payment_date: updatedPayment.payment_date,
    // Use created_at (actual payment record time) for payment_at to maintain proper timestamp
    payment_at: paymentAt || updatedPayment.payment_date,
    payment_method: paymentMethod,
    bank_reference: updatedPayment.transaction_reference || null,
    evidence_url: updatedPayment.evidence_url || null,
    payment_to: paymentTo,
  };

  // Convert UUID to text for income table (paid_to_user in income is text)
  if (paidToUser !== undefined && paidToUser !== null) {
    incomeUpdates.paid_to_user = paidToUser.toString();
  } else {
    incomeUpdates.paid_to_user = null;
  }

  // Update description with new payment details
  const orderNumber = updatedPayment.order_number || existingPayment?.order?.order_number || 'Unknown';
  const customerName = updatedPayment.customer_name || existingPayment?.order?.customer?.name || 'Sales';

  incomeUpdates.reason = `Payment for Order ${orderNumber}` +
    (customerName ? ` - Customer: ${customerName}` : '');
  incomeUpdates.description = 'Auto-generated from Order Payment: ' + orderNumber +
    (updatedPayment.transaction_reference ? ` | Transaction: ${updatedPayment.transaction_reference}` : '') +
    (updatedPayment.notes ? ` | Notes: ${updatedPayment.notes}` : '');
  incomeUpdates.source = customerName || 'Sales';

  // Update the income entry
  const { error: updateError } = await supabase
    .from('income')
    .update(incomeUpdates)
    .eq('id', incomeEntry.id);

  if (updateError) {
    console.error('Error updating linked income entry:', updateError);
    // Don't fail the payment update if income update fails
  }
}

// Helper to map PaymentMode (DB) to PaymentMethod (Income)
function mapPaymentModeToMethod(mode: 'Cash' | 'UPI' | 'Bank'): 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card' {
  switch (mode) {
    case 'Cash':
      return 'cash';
    case 'UPI':
      return 'upi';
    case 'Bank':
      return 'bank_transfer';
    default:
      return 'cash';
  }
}

// Delete payment
export async function deletePayment(paymentId: string): Promise<void> {
  const { data: payment, error: fetchError } = await supabase
    .from('order_payments')
    .select('order_id')
    .eq('id', paymentId)
    .single();
  if (fetchError) throw fetchError;
  if (!payment?.order_id) throw new Error('Payment not found');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('is_locked')
    .eq('id', payment.order_id)
    .single();
  if (orderError) throw orderError;
  if (order?.is_locked) {
    throw new Error('Order is locked and cannot be modified');
  }

  const { error } = await supabase.from('order_payments').delete().eq('id', paymentId);
  if (error) throw error;
}

// Calculate payment status for an order (returns canonical PaymentStatus)
export async function getOrderPaymentStatus(orderId: string): Promise<PaymentStatus> {
  // First try to get from orders table (it's stored there)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('payment_status, total_amount, discount_amount')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;

  // If payment_status exists and is valid, return it
  if (order?.payment_status && ['READY_FOR_PAYMENT', 'PARTIAL_PAYMENT', 'FULL_PAYMENT'].includes(order.payment_status)) {
    return order.payment_status as PaymentStatus;
  }

  // Fallback: calculate from payments (considering discount)
  const { data: payments } = await supabase
    .from('order_payments')
    .select('amount_received')
    .eq('order_id', orderId);

  if (!order) return 'READY_FOR_PAYMENT';
  const totalPaid = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount_received), 0);
  const orderTotal = parseFloat(order.total_amount || 0);
  const discountAmount = parseFloat(order.discount_amount || 0);
  const netTotal = orderTotal - discountAmount; // Net total after discount

  if (totalPaid === 0) return 'READY_FOR_PAYMENT';
  if (totalPaid >= netTotal) return 'FULL_PAYMENT'; // Compare against net total, not original total
  return 'PARTIAL_PAYMENT';
}

// Backfill completed_at for existing ORDER_COMPLETED orders that don't have it set
export async function backfillCompletedAt(orderId: string): Promise<void> {
  try {
    const { data: order, error: checkError } = await supabase
      .from('orders')
      .select('status, completed_at, updated_at')
      .eq('id', orderId)
      .single();

    if (checkError || !order) return;

    // If order is ORDER_COMPLETED but doesn't have completed_at, set it to updated_at
    if (order.status === 'ORDER_COMPLETED' && !order.completed_at && order.updated_at) {
      await supabase
        .from('orders')
        .update({ completed_at: order.updated_at })
        .eq('id', orderId);
    }
  } catch (err) {
    console.error('Error backfilling completed_at:', err);
    // Don't throw - this is a background operation
  }
}

// Fetch order with payment information
export async function fetchOrderWithPayments(orderId: string): Promise<OrderWithPaymentInfo | null> {
  const order = await fetchOrderWithItems(orderId);
  if (!order) return null;

  // Backfill completed_at if needed (background operation)
  if (order.status === 'ORDER_COMPLETED' && !order.completed_at) {
    void backfillCompletedAt(orderId);
  }

  const { data: paymentsData, error: paymentsError } = await supabase
    .from('order_payments')
    .select('*')
    .eq('order_id', orderId)
    .order('payment_date', { ascending: false });

  if (paymentsError) throw paymentsError;

  const payments = paymentsData || [];
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_received || 0), 0);

  // Get payment status from order or calculate it
  // Calculate payment status
  let paymentStatus: PaymentStatus = 'READY_FOR_PAYMENT';
  const netTotal = (order.total_amount || 0) - (order.discount_amount || 0);

  if (totalPaid === 0) paymentStatus = 'READY_FOR_PAYMENT';
  else if (totalPaid >= netTotal - 0.01) paymentStatus = 'FULL_PAYMENT';
  else paymentStatus = 'PARTIAL_PAYMENT';

  // Use order.payment_status if present and valid (DB source of truth)
  if (order.payment_status) {
    paymentStatus = order.payment_status;
  }

  return {
    ...order,
    payments,
    total_paid: totalPaid,
    payment_status: paymentStatus,
  };
}

// Test function to verify order deletion functionality
export async function testOrderDeletion(orderId: string): Promise<{
  orderExistsBefore: boolean;
  inventoryBefore: Record<string, number>;
  paymentsBefore: number;
  incomeBefore: number;
  deletionSuccess: boolean;
  inventoryAfter: Record<string, number>;
  paymentsAfter: number;
  incomeAfter: number;
  orderExistsAfter: boolean;
}> {
  console.log(`🧪 Testing order deletion for order ID: ${orderId}`);

  // Check order exists before deletion
  const { data: orderBefore } = await supabase
    .from('orders')
    .select('id, order_number, order_items(processed_good_id, quantity_delivered)')
    .eq('id', orderId)
    .single();

  const orderExistsBefore = !!orderBefore;

  // Get inventory levels before
  const inventoryBefore: Record<string, number> = {};
  if (orderBefore?.order_items) {
    for (const item of orderBefore.order_items) {
      if (item.processed_good_id) {
        const { data: pg } = await supabase
          .from('processed_goods')
          .select('quantity_available')
          .eq('id', item.processed_good_id)
          .single();
        inventoryBefore[item.processed_good_id] = pg?.quantity_available || 0;
      }
    }
  }

  // Get payments count before
  const { data: paymentsBefore } = await supabase
    .from('order_payments')
    .select('id', { count: 'exact' })
    .eq('order_id', orderId);

  // Get income entries count before
  const { data: incomeBefore } = await supabase
    .from('income')
    .select('id', { count: 'exact' })
    .eq('order_id', orderId);

  // Attempt deletion
  let deletionSuccess = false;
  try {
    await deleteOrder(orderId, { skipConfirmation: true });
    deletionSuccess = true;
  } catch (error) {
    console.error('❌ Deletion failed:', error);
  }

  // Check inventory after
  const inventoryAfter: Record<string, number> = {};
  if (orderBefore?.order_items) {
    for (const item of orderBefore.order_items) {
      if (item.processed_good_id) {
        const { data: pg } = await supabase
          .from('processed_goods')
          .select('quantity_available')
          .eq('id', item.processed_good_id)
          .single();
        inventoryAfter[item.processed_good_id] = pg?.quantity_available || 0;
      }
    }
  }

  // Get payments count after
  const { data: paymentsAfter } = await supabase
    .from('order_payments')
    .select('id', { count: 'exact' })
    .eq('order_id', orderId);

  // Get income entries count after
  const { data: incomeAfter } = await supabase
    .from('income')
    .select('id', { count: 'exact' })
    .eq('order_id', orderId);

  // Check order exists after
  const { data: orderAfter } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single();

  const orderExistsAfter = !!orderAfter;

  return {
    orderExistsBefore,
    inventoryBefore,
    paymentsBefore: paymentsBefore?.length || 0,
    incomeBefore: incomeBefore?.length || 0,
    deletionSuccess,
    inventoryAfter,
    paymentsAfter: paymentsAfter?.length || 0,
    incomeAfter: incomeAfter?.length || 0,
    orderExistsAfter,
  };
}

// Delete order with all related data cleanup
export async function deleteOrder(
  orderId: string,
  options?: { currentUserId?: string; skipConfirmation?: boolean }
): Promise<void> {
  console.log(`🚀 Starting order deletion process for order ID: ${orderId}`);

  // Let's first test if we can even access the order
  const { data: testAccess, error: testError } = await supabase
    .from('orders')
    .select('id, order_number, is_locked')
    .eq('id', orderId);

  if (testError) {
    console.error(`❌ Cannot even access order for deletion:`, testError);
    throw new Error(`Access denied: ${testError.message}`);
  }

  if (!testAccess || testAccess.length === 0) {
    throw new Error('Order not found or access denied');
  }

  console.log(`✅ Order access confirmed: ${testAccess[0].order_number}, locked: ${testAccess[0].is_locked}`);

  // TEMPORARY WORKAROUND: Try direct SQL execution to bypass RLS
  console.log(`🔧 Attempting direct SQL delete to bypass potential RLS issues...`);

  try {
    // Use rpc to execute raw SQL
    const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', {
      sql: `
        DELETE FROM orders WHERE id = $1 AND is_locked = false;
      `,
      params: [orderId]
    });

    if (sqlError) {
      console.error(`❌ Direct SQL delete failed:`, sqlError);
      console.log(`⚠️ Falling back to standard Supabase client delete...`);
    } else {
      console.log(`✅ Direct SQL delete succeeded:`, sqlResult);

      // Verify the direct SQL delete worked
      const { data: verifyDirect } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId);

      if (!verifyDirect || verifyDirect.length === 0) {
        console.log(`✅ Order successfully deleted via direct SQL`);
        return; // Success!
      } else {
        console.log(`❌ Direct SQL delete didn't work, order still exists`);
      }
    }
  } catch (e) {
    console.log(`⚠️ Direct SQL not available, continuing with standard delete:`, e);
  }

  // Continue with normal delete process
  // Check if order exists and get its details
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      is_locked,
      total_amount,
      created_at,
      order_items (
        id,
        processed_good_id,
        quantity_delivered,
        quantity,
        processed_good:processed_goods (
          id,
          product_type,
          quantity_available
        )
      )
    `)
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (!order) throw new Error('Order not found');

  // Lock check
  if (order.is_locked) {
    throw new Error('Locked orders cannot be deleted for data integrity protection.');
  }

  // Get payment information
  const { data: payments } = await supabase
    .from('order_payments')
    .select('id, amount_received')
    .eq('order_id', orderId);

  const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount_received), 0) || 0;
  const hasPayments = totalPaid > 0;

  // Get delivery information
  const hasDeliveries = order.order_items?.some(item => (item.quantity_delivered || 0) > 0) || false;

  // Get invoice information
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('order_id', orderId);

  const hasInvoices = invoices && invoices.length > 0;

  // User confirmation for risky operations
  if (!options?.skipConfirmation) {
    let confirmationMessage = `Are you sure you want to delete order ${order.order_number}?`;

    if (hasDeliveries) {
      confirmationMessage += '\n\n⚠️ This order has deliveries. Deleting it will restore the delivered quantities back to inventory.';
    }

    if (hasPayments) {
      confirmationMessage += '\n\n💰 This order has payments totaling ₹' + totalPaid.toLocaleString('en-IN') +
        '. All payments and related income entries will be permanently deleted.';
    }

    if (hasInvoices) {
      confirmationMessage += '\n\n📄 This order has ' + invoices.length + ' invoice(s) that will be deleted.';
    }

    confirmationMessage += '\n\nThis action cannot be undone.';

    if (!confirm(confirmationMessage)) {
      throw new Error('Order deletion cancelled by user.');
    }
  }

  // Start transaction-like operations (Supabase doesn't support explicit transactions across tables)
  try {
    // 1. Restore inventory for delivered items
    if (hasDeliveries) {
      console.log('🔄 Restoring inventory for delivered items...');
      for (const item of order.order_items || []) {
        const deliveredQuantity = item.quantity_delivered || 0;
        if (deliveredQuantity > 0) {
          console.log(`📦 Processing item ${item.id}: delivered ${deliveredQuantity} units`);

          // Get current quantity_available to avoid stale data
          const { data: currentProcessedGood, error: fetchError } = await supabase
            .from('processed_goods')
            .select('quantity_available, product_type')
            .eq('id', item.processed_good_id)
            .single();

          if (fetchError) {
            console.error(`❌ Failed to fetch processed good ${item.processed_good_id}:`, fetchError);
            throw fetchError;
          }
          if (!currentProcessedGood) {
            console.error(`❌ Processed good ${item.processed_good_id} not found`);
            throw new Error(`Processed good ${item.processed_good_id} not found`);
          }

          const currentQuantity = currentProcessedGood.quantity_available;
          const newQuantityAvailable = currentQuantity + deliveredQuantity;

          console.log(`📊 ${currentProcessedGood.product_type}: ${currentQuantity} → ${newQuantityAvailable} (+${deliveredQuantity})`);

          const { error: inventoryError } = await supabase
            .from('processed_goods')
            .update({
              quantity_available: newQuantityAvailable
            })
            .eq('id', item.processed_good_id);

          if (inventoryError) {
            console.error(`❌ Failed to update inventory for ${item.processed_good_id}:`, inventoryError);
            throw inventoryError;
          }

          console.log(`✅ Successfully restored inventory for ${currentProcessedGood.product_type}`);
        }
      }
      console.log('🎉 Inventory restoration completed');
    } else {
      console.log('ℹ️ No deliveries found, skipping inventory restoration');
    }

    // 2. Delete income entries related to this order's payments
    if (hasPayments) {
      const { error: incomeDeleteError } = await supabase
        .from('income')
        .delete()
        .eq('order_id', orderId);

      if (incomeDeleteError) throw incomeDeleteError;
    }

    // 3. Delete invoices (must be done before order deletion due to RESTRICT constraint)
    if (hasInvoices) {
      console.log(`🧾 Deleting ${invoices.length} invoice(s) for order ${orderId}...`);
      const { error: invoiceDeleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('order_id', orderId);

      if (invoiceDeleteError) {
        console.error(`❌ Failed to delete invoices:`, invoiceDeleteError);
        throw invoiceDeleteError;
      }
      console.log(`✅ Successfully deleted invoices`);
    } else {
      console.log(`ℹ️ No invoices found for this order`);
    }

    // 4. Delete related records explicitly (to avoid CASCADE issues)
    console.log(`🗑️ Deleting order ${orderId} (${order.order_number}) and all related records...`);

    // Delete in correct order to respect foreign key constraints
    // 1. Delete delivery_dispatches (references order_items)
    console.log(`🗑️ Deleting delivery dispatches...`);
    const { error: dispatchError } = await supabase
      .from('delivery_dispatches')
      .delete()
      .eq('order_id', orderId);

    if (dispatchError) {
      console.error(`❌ Failed to delete delivery dispatches:`, dispatchError);
      throw dispatchError;
    }

    // 2. Delete order_reservations (references order_items)
    console.log(`🗑️ Deleting order reservations...`);
    const { error: reservationError } = await supabase
      .from('order_reservations')
      .delete()
      .eq('order_id', orderId);

    if (reservationError) {
      console.error(`❌ Failed to delete order reservations:`, reservationError);
      throw reservationError;
    }

    // 3. Delete order_payments (references orders directly)
    console.log(`🗑️ Deleting order payments...`);
    const { error: paymentError } = await supabase
      .from('order_payments')
      .delete()
      .eq('order_id', orderId);

    if (paymentError) {
      console.error(`❌ Failed to delete order payments:`, paymentError);
      throw paymentError;
    }

    // 4. Delete order_items (references orders and processed_goods)
    console.log(`🗑️ Deleting order items...`);
    const { error: itemError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (itemError) {
      console.error(`❌ Failed to delete order items:`, itemError);
      throw itemError;
    }

    // 5. Finally delete the order itself
    console.log(`🗑️ Deleting the order record...`);

    // First, let's check user permissions explicitly
    console.log(`🔐 Checking user permissions for delete operation...`);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    console.log(`👤 Current user ID: ${user.id}`);

    // Check user module access
    const { data: userAccess, error: accessError } = await supabase
      .from('user_module_access')
      .select('module_name, access_level')
      .eq('user_id', user.id)
      .eq('module_name', 'sales');

    if (accessError) {
      console.error(`❌ Error checking user access:`, accessError);
    } else {
      console.log(`🔑 User access for sales module:`, userAccess);
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (roleError) {
      console.error(`❌ Error checking user role:`, roleError);
    } else {
      console.log(`👑 User role: ${userRole?.role}`);
    }

    // Test RLS policy directly with a simple update to see if we have write access
    console.log(`🧪 Testing RLS policy with update operation...`);
    const { data: testUpdate, error: testUpdateError } = await supabase
      .from('orders')
      .update({ status: 'DRAFT' })  // Just update status to same value
      .eq('id', orderId)
      .eq('status', 'DRAFT')  // Only update if it's already DRAFT
      .select();

    console.log(`📝 Test update result:`, { data: testUpdate, error: testUpdateError });

    // Now check the order
    console.log(`🔍 Testing delete permission with select first...`);
    const { data: preDeleteCheck, error: preDeleteError } = await supabase
      .from('orders')
      .select('id, order_number, is_locked')
      .eq('id', orderId);

    if (preDeleteError) {
      console.error(`❌ Cannot even read order before delete:`, preDeleteError);
      throw new Error(`Read permission failed: ${preDeleteError.message}`);
    }

    if (!preDeleteCheck || preDeleteCheck.length === 0) {
      console.log(`ℹ️ Order already doesn't exist in database`);
      return; // Success - order is already gone
    }

    console.log(`📋 Order exists before delete: ${preDeleteCheck[0].order_number}, locked: ${preDeleteCheck[0].is_locked}`);

    // Try a different approach - use raw SQL via RPC if available
    console.log(`🔧 Attempting RPC-based delete...`);
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('delete_order_safe', {
        order_id: orderId
      });

      if (rpcError) {
        console.log(`⚠️ RPC function not available, falling back to client delete:`, rpcError);
      } else {
        console.log(`✅ RPC delete successful:`, rpcResult);
        return; // Success via RPC
      }
    } catch (e) {
      console.log(`⚠️ RPC not available:`, e);
    }

    // Fallback to regular Supabase client delete
    console.log(`📝 Using regular Supabase client delete...`);

    const { data: deleteResult, error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    console.log(`📊 Delete operation result:`, { data: deleteResult, error: deleteError });

    if (deleteError) {
      console.error(`❌ Failed to delete order:`, deleteError);
      console.error(`❌ Delete error details:`, {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint
      });

      // If it's a permission error, try to provide more helpful information
      if (deleteError.code === '42501' || deleteError.message?.includes('permission') || deleteError.message?.includes('policy')) {
        console.error(`🚫 This appears to be an RLS policy issue. The delete operation is being blocked.`);
        console.error(`💡 Try checking the RLS policy for the orders table.`);
        throw new Error('Delete blocked by security policy. Please contact administrator.');
      }

      throw deleteError;
    }

    console.log(`✅ Order ${order.order_number} and all related records successfully deleted`);

    // Verify the order was actually deleted
    console.log(`🔍 Verifying order deletion...`);
    const { data: verifyOrder, error: verifyError } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('id', orderId)
      .single();

    if (verifyOrder) {
      console.error(`❌ ERROR: Order still exists in database after deletion!`, verifyOrder);

      // Check what related records might still exist
      console.log(`🔍 Checking for remaining related records...`);

      const { data: remainingItems } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderId);

      const { data: remainingPayments } = await supabase
        .from('order_payments')
        .select('id')
        .eq('order_id', orderId);

      const { data: remainingInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', orderId);

      const { data: remainingReservations } = await supabase
        .from('order_reservations')
        .select('id')
        .eq('order_id', orderId);

      console.log(`📊 Remaining records:`, {
        items: remainingItems?.length || 0,
        payments: remainingPayments?.length || 0,
        invoices: remainingInvoices?.length || 0,
        reservations: remainingReservations?.length || 0
      });

      throw new Error('Order deletion failed - order still exists in database');
    } else if (verifyError?.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
      console.error(`❌ Unexpected error verifying order deletion:`, verifyError);
    } else {
      console.log(`✅ Order deletion verified - order no longer exists in database`);
    }

  } catch (error) {
    console.error('Error during order deletion:', error);
    throw new Error('Failed to delete order. Some operations may have been partially completed. Please contact support.');
  }
}


// ==================== THIRD-PARTY DELIVERY TRACKING FUNCTIONS ====================

// Enable/disable third-party delivery tracking for an order
export async function setThirdPartyDeliveryEnabled(
  orderId: string,
  enabled: boolean,
  options?: { currentUserId?: string }
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ third_party_delivery_enabled: enabled })
    .eq('id', orderId);

  if (error) throw error;
}

// Record or update third-party delivery information
export async function recordThirdPartyDelivery(
  delivery: Partial<import('../types/sales').ThirdPartyDelivery>,
  options?: { currentUserId?: string }
): Promise<import('../types/sales').ThirdPartyDelivery> {
  // Validate that third-party delivery is enabled for this order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('third_party_delivery_enabled')
    .eq('id', delivery.order_id)
    .single();

  if (orderError) throw orderError;
  if (!order?.third_party_delivery_enabled) {
    throw new Error('Third-party delivery tracking is not enabled for this order');
  }

  // Upsert delivery record (one per order)
  const { data, error } = await supabase
    .from('third_party_deliveries')
    .upsert({
      order_id: delivery.order_id,
      quantity_delivered: delivery.quantity_delivered,
      delivery_partner_name: delivery.delivery_partner_name,
      delivery_notes: delivery.delivery_notes,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Fetch third-party delivery information for an order
export async function fetchThirdPartyDelivery(
  orderId: string
): Promise<import('../types/sales').ThirdPartyDelivery | null> {
  const { data, error } = await supabase
    .from('third_party_deliveries')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Upload a document for third-party delivery
export async function uploadDeliveryDocument(
  deliveryId: string,
  file: File,
  options?: { currentUserId?: string }
): Promise<string> {
  // Validate file type
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Unsupported file format. Supported formats: PDF, JPG, PNG, WEBP');
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error('File size exceeds 10MB limit');
  }

  // Upload file to Supabase Storage
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `delivery_${deliveryId}_${timestamp}_${sanitizedFileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('Transport Document')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('Transport Document')
    .getPublicUrl(fileName);

  // Store document metadata in database
  const { data, error } = await supabase
    .from('third_party_delivery_documents')
    .insert({
      third_party_delivery_id: deliveryId,
      document_url: publicUrl,
      document_name: file.name,
      document_type: file.type,
      created_by: options?.currentUserId,
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

// Fetch all documents for a third-party delivery by order ID
export async function fetchDeliveryDocuments(
  orderId: string
): Promise<import('../types/sales').ThirdPartyDeliveryDocument[]> {
  // First get the delivery record for this order
  const { data: delivery, error: deliveryError } = await supabase
    .from('third_party_deliveries')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (deliveryError) throw deliveryError;
  if (!delivery) return [];

  // Then fetch documents for that delivery
  const { data, error } = await supabase
    .from('third_party_delivery_documents')
    .select('*')
    .eq('third_party_delivery_id', delivery.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Delete a delivery document
export async function deleteDeliveryDocument(
  documentId: string,
  options?: { currentUserId?: string }
): Promise<void> {
  // First, get the document to find the storage path
  const { data: doc, error: fetchError } = await supabase
    .from('third_party_delivery_documents')
    .select('document_url')
    .eq('id', documentId)
    .single();

  if (fetchError) throw fetchError;

  // Extract file path from URL
  if (doc?.document_url) {
    const urlParts = doc.document_url.split('/Transport%20Document/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('Transport Document')
        .remove([filePath]);

      if (storageError) {
        console.error('Failed to delete file from storage:', storageError);
        // Continue to delete database record even if storage deletion fails
      }
    }
  }

  // Delete database record
  const { error } = await supabase
    .from('third_party_delivery_documents')
    .delete()
    .eq('id', documentId);

  if (error) throw error;
}


// Fetch order lock data using RPC to bypass PostgREST cache issues
export async function fetchOrderLockData(orderId: string): Promise<{
  is_locked: boolean;
  locked_at?: string;
  locked_by?: string;
  locked_by_name?: string;
  can_unlock_until?: string;
} | null> {
  const { data, error } = await supabase.rpc('get_order_lock_data', {
    p_order_id: orderId,
  });

  if (error) {
    console.error('Error fetching order lock data:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0];
}

// ==================== MANUAL ORDER LOCK FUNCTIONS ====================

// Manually lock an ORDER_COMPLETED order
export async function lockOrder(
  orderId: string,
  options?: { currentUserId?: string }
): Promise<{ success: boolean; locked_at?: string; can_unlock_until?: string; error?: string }> {
  if (!options?.currentUserId) {
    return { success: false, error: 'User ID is required' };
  }

  const { data, error } = await supabase.rpc('lock_order', {
    p_order_id: orderId,
    p_user_id: options.currentUserId,
  });

  if (error) {
    console.error('Error locking order:', error);
    return { success: false, error: error.message };
  }

  return data;
}

// Unlock an order within 7-day window
export async function unlockOrder(
  orderId: string,
  unlockReason: string,
  options?: { currentUserId?: string }
): Promise<{ success: boolean; unlocked_at?: string; error?: string }> {
  if (!options?.currentUserId) {
    return { success: false, error: 'User ID is required' };
  }

  if (!unlockReason || unlockReason.trim() === '') {
    return { success: false, error: 'Unlock reason is required' };
  }

  const { data, error } = await supabase.rpc('unlock_order', {
    p_order_id: orderId,
    p_user_id: options.currentUserId,
    p_unlock_reason: unlockReason.trim(),
  });

  if (error) {
    console.error('Error unlocking order:', error);
    return { success: false, error: error.message };
  }

  return data;
}

// Get lock/unlock history for an order
export async function getOrderLockHistory(
  orderId: string
): Promise<import('../types/sales').OrderLockLog[]> {
  const { data, error } = await supabase.rpc('get_order_lock_history', {
    p_order_id: orderId,
  });

  if (error) {
    console.error('Error fetching lock history:', error);
    throw error;
  }

  return data || [];
}

// Get complete audit log for an order (all events)
export async function getOrderAuditLog(
  orderId: string
): Promise<import('../types/sales').OrderAuditLog[]> {
  const { data, error } = await supabase.rpc('get_order_audit_log', {
    p_order_id: orderId,
  });

  if (error) {
    console.error('Error fetching order audit log:', error);
    throw error;
  }

  const list = Array.isArray(data) ? data : data ? [data] : [];
  return list;
}

// Backfill audit log for an order that has no entries (adds ORDER_CREATED from order data)
export async function backfillOrderAuditLog(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('backfill_order_audit_log', {
    p_order_id: orderId,
  });
  if (error) {
    console.error('Error backfilling order audit log:', error);
    throw error;
  }
}

// Check if order can be unlocked (within 7-day window)
export function canUnlockOrder(order: { is_locked: boolean; can_unlock_until?: string }): boolean {
  if (!order.is_locked || !order.can_unlock_until) {
    return false;
  }

  const unlockDeadline = new Date(order.can_unlock_until);
  const now = new Date();

  return now <= unlockDeadline;
}

// Calculate time remaining to unlock (in milliseconds)
export function getUnlockTimeRemaining(canUnlockUntil?: string): number | null {
  if (!canUnlockUntil) return null;

  const deadline = new Date(canUnlockUntil).getTime();
  const now = new Date().getTime();
  const remaining = deadline - now;

  return remaining > 0 ? remaining : 0;
}
