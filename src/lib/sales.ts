import { supabase } from './supabase';
import type {
  Customer,
  CustomerWithStats,
  Order,
  OrderItem,
  OrderWithItems,
  OrderFormData,
  OrderItemFormData,
  OrderStatus,
  OrderPayment,
  PaymentFormData,
  PaymentStatus,
  OrderWithPaymentInfo,
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
    .select('id, total_amount, order_date, status')
    .eq('customer_id', id)
    .neq('status', 'Cancelled');

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
  const totalSalesValue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
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

export async function createCustomer(
  customer: Partial<Customer>,
  options?: { currentUserId?: string }
): Promise<Customer> {
  const payload: any = {
    name: customer.name,
    customer_type: customer.customer_type,
    contact_person: customer.contact_person || null,
    phone: customer.phone || null,
    address: customer.address || null,
    status: customer.status || 'Active',
    notes: customer.notes || null,
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
  const payload: any = {
    name: updates.name,
    customer_type: updates.customer_type,
    contact_person: updates.contact_person !== undefined ? updates.contact_person : null,
    phone: updates.phone !== undefined ? updates.phone : null,
    address: updates.address !== undefined ? updates.address : null,
    status: updates.status,
    notes: updates.notes !== undefined ? updates.notes : null,
  };

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

function mapDbToOrder(row: any): Order {
  return {
    id: row.id,
    order_number: row.order_number,
    customer_id: row.customer_id,
    customer_name: row.customer?.name || row.customer_name,
    order_date: row.order_date,
    status: row.status,
    notes: row.notes,
    total_amount: parseFloat(row.total_amount || 0),
    is_locked: row.is_locked || false,
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

// Get available quantity for a processed good (available - reserved)
export async function getAvailableQuantity(processedGoodId: string): Promise<number> {
  // Get the processed good
  const { data: processedGood, error: pgError } = await supabase
    .from('processed_goods')
    .select('quantity_available')
    .eq('id', processedGoodId)
    .single();

  if (pgError || !processedGood) {
    throw new Error('Processed good not found');
  }

  // Get total reserved quantity from active orders (not cancelled)
  const { data: reservations, error: resError } = await supabase
    .from('order_reservations')
    .select('quantity_reserved, order:orders!inner(status)')
    .eq('processed_good_id', processedGoodId);

  if (resError) throw resError;

  const totalReserved =
    reservations?.reduce((sum, res) => {
      // Only count reservations from non-cancelled orders
      const order = res.order as any;
      if (order && order.status !== 'Cancelled') {
        return sum + parseFloat(res.quantity_reserved);
      }
      return sum;
    }, 0) || 0;

  return Math.max(0, parseFloat(processedGood.quantity_available) - totalReserved);
}

// Validate inventory availability for order items
export async function validateInventoryAvailability(
  items: OrderItemFormData[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const item of items) {
    try {
      const available = await getAvailableQuantity(item.processed_good_id);
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
  // Validate inventory availability
  const validation = await validateInventoryAvailability(orderData.items);
  if (!validation.valid) {
    throw new Error(`Inventory validation failed:\n${validation.errors.join('\n')}`);
  }

  // Generate order number
  const orderNumber = await generateOrderNumber();

  // Create order
  const orderPayload: any = {
    order_number: orderNumber,
    customer_id: orderData.customer_id,
    order_date: orderData.order_date,
    status: orderData.status,
    notes: orderData.notes || null,
    is_locked: false,
    created_by: options?.currentUserId || null,
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([orderPayload])
    .select()
    .single();

  if (orderError) throw orderError;

  // Create order items and reservations
  const items: OrderItem[] = [];
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

  // Fetch complete order with customer
  const { data: completeOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*, customer:customers(name)')
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
    .select('*, customer:customers(name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbToOrder);
}

// Fetch single order with items
export async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, customer:customers(*)')
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

  // If cancelling, we need to release reservations
  if (status === 'Cancelled') {
    // Delete reservations for this order
    const { error: delError } = await supabase.from('order_reservations').delete().eq('order_id', orderId);
    if (delError) throw delError;
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
  if (updates.order_date !== undefined) orderUpdates.order_date = updates.order_date;
  if (updates.status !== undefined) orderUpdates.status = updates.status;
  if (updates.notes !== undefined) orderUpdates.notes = updates.notes || null;

  if (Object.keys(orderUpdates).length > 0) {
    const { error: updateError } = await supabase.from('orders').update(orderUpdates).eq('id', orderId);
    if (updateError) throw updateError;
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

// Lock order (marks order as locked and prevents further edits)
export async function lockOrder(
  orderId: string,
  options?: { currentUserId?: string }
): Promise<Order> {
  // Check if order is already locked
  const { data: order, error: checkError } = await supabase
    .from('orders')
    .select('is_locked, status')
    .eq('id', orderId)
    .single();

  if (checkError) throw checkError;
  if (order?.is_locked) {
    throw new Error('Order is already locked');
  }

  // Lock the order
  const { data, error } = await supabase
    .from('orders')
    .update({ is_locked: true })
    .eq('id', orderId)
    .select('*, customer:customers(name)')
    .single();

  if (error) throw error;
  return mapDbToOrder(data);
}

// Update order (alias for saveOrder for backward compatibility)
export async function updateOrder(
  orderId: string,
  updates: Partial<OrderFormData>,
  options?: { currentUserId?: string }
): Promise<OrderWithItems> {
  return saveOrder(orderId, updates, options);
}

// Fetch processed goods for order creation
export async function fetchProcessedGoodsForOrder(): Promise<ProcessedGood[]> {
  const { data, error } = await supabase
    .from('processed_goods')
    .select('*')
    .gt('quantity_available', 0)
    .order('product_type', { ascending: true })
    .order('production_date', { ascending: false });

  if (error) throw error;
  return data || [];
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
  // Get the order item to validate
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
  if (deliveryDifference > 0) {
    const processedGood = orderItem.processed_good as any;
    const available = parseFloat(processedGood?.quantity_available || 0);

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
  // Extract date part from ISO string (payment_date may be full ISO with time)
  const paymentDate = payment.payment_date.includes('T') 
    ? payment.payment_date.split('T')[0]
    : payment.payment_date;
  
  // Map PaymentMethod to PaymentMode for database
  const paymentMode = mapPaymentMethodToMode(payment.payment_method);
  
  const payload: any = {
    order_id: payment.order_id,
    payment_date: paymentDate,
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
  
  // Get payment_to and paid_to_user from updated payment or existing payment
  // First try to get from updated payment data (from DB), then from existing payment
  const { data: paymentData, error: paymentFetchError } = await supabase
    .from('order_payments')
    .select('payment_to, paid_to_user, order_id')
    .eq('id', paymentId)
    .single();
  
  if (paymentFetchError) {
    console.error('Error fetching payment data for income update:', paymentFetchError);
    // Fallback to existing payment data
  }
  
  const paymentTo = paymentData?.payment_to || existingPayment?.payment_to || 'organization_bank';
  const paidToUser = paymentData?.paid_to_user || existingPayment?.paid_to_user;
  
  // Prepare income update payload
  const incomeUpdates: any = {
    amount: updatedPayment.amount_received,
    payment_date: updatedPayment.payment_date,
    payment_at: updatedPayment.payment_date,
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
  const { error } = await supabase.from('order_payments').delete().eq('id', paymentId);
  if (error) throw error;
}

// Calculate payment status for an order
export async function getOrderPaymentStatus(orderId: string): Promise<PaymentStatus> {
  const { data, error } = await supabase.rpc('calculate_order_payment_status', {
    order_uuid: orderId,
  });

  if (error) {
    // Fallback calculation if function doesn't exist
    const { data: order } = await supabase.from('orders').select('total_amount').eq('id', orderId).single();
    const { data: payments } = await supabase
      .from('order_payments')
      .select('amount_received')
      .eq('order_id', orderId);

    if (!order) return 'Pending';
    const totalPaid = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount_received), 0);

    if (totalPaid === 0) return 'Pending';
    if (totalPaid >= parseFloat(order.total_amount)) return 'Paid';
    return 'Partial';
  }

  return (data as PaymentStatus) || 'Pending';
}

// Fetch order with payment information
export async function fetchOrderWithPayments(orderId: string): Promise<OrderWithPaymentInfo | null> {
  const order = await fetchOrderWithItems(orderId);
  if (!order) return null;

  const payments = await fetchOrderPayments(orderId);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount_received, 0);
  const paymentStatus = await getOrderPaymentStatus(orderId);

  return {
    ...order,
    total_paid: totalPaid,
    payment_status: paymentStatus,
    payments,
  };
}
