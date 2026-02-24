import { supabase } from './supabase';
import type {
  SalesAnalyticsFilters,
  SalesSummary,
  CustomerSalesReport,
  ProductSalesReport,
  OutstandingPaymentReport,
  SalesTrendData,
  ProductPerformanceData,
  CustomerConcentrationData,
  ProductExtremeData,
  CustomerPaymentPerformance,
  SalesDistribution,
  CustomerTypeDistribution,
  ProductSalesTrendData,
} from '../types/sales-analytics';

// ============================================
// SALES SUMMARY
// ============================================

export async function fetchSalesSummary(
  filters?: SalesAnalyticsFilters
): Promise<SalesSummary> {
  // Build query for ALL orders (not just completed)
  let ordersQuery = supabase
    .from('orders')
    .select(`
      id,
      total_amount,
      discount_amount,
      order_date,
      status,
      payment_status,
      customers!inner(
        customer_type,
        customer_types!customer_type_id(type_key)
      )
    `)
    .neq('status', 'CANCELLED');

  // Apply date filters
  if (filters?.startDate) {
    ordersQuery = ordersQuery.gte('order_date', filters.startDate);
  }
  if (filters?.endDate) {
    ordersQuery = ordersQuery.lte('order_date', filters.endDate);
  }

  // Apply customer type filter (using type_key from customer_types table)
  if (filters?.customerType) {
    ordersQuery = ordersQuery.eq('customers.customer_types.type_key', filters.customerType);
  }

  const { data: orders, error: ordersError } = await ordersQuery;
  if (ordersError) throw ordersError;

  // Get order IDs for items and payments
  const orderIds = (orders || []).map(o => o.id);

  // Fetch order items to calculate total quantity (from ALL orders with items)
  let totalOrderedQuantity = 0;
  if (orderIds.length > 0) {
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('quantity')
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;

    totalOrderedQuantity = (orderItems || []).reduce((sum, item) => 
      sum + parseFloat(item.quantity || '0'), 0);
  }

  // Fetch payments for these orders
  let paymentsMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from('order_payments')
      .select('order_id, amount_received')
      .in('order_id', orderIds);

    if (paymentsError) throw paymentsError;

    (payments || []).forEach(p => {
      const current = paymentsMap.get(p.order_id) || 0;
      paymentsMap.set(p.order_id, current + parseFloat(p.amount_received || '0'));
    });
  }

  // Calculate metrics
  let totalSalesValue = 0; // Total of ALL orders
  let completedOrdersCount = 0;
  let pendingPaymentCount = 0;
  let partialPaymentCount = 0;
  let fullPaymentCount = 0;
  let totalPaidAcrossAllOrders = 0;
  let totalOutstandingAmount = 0;

  (orders || []).forEach(order => {
    const netTotal = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');
    const totalPaid = paymentsMap.get(order.id) || 0;
    const outstanding = netTotal - totalPaid;

    // Total sales = sum of ALL order values
    totalSalesValue += netTotal;

    // Accumulate all payments
    totalPaidAcrossAllOrders += totalPaid;

    // Count completed orders
    if (order.status === 'ORDER_COMPLETED') {
      completedOrdersCount++;
    }

    // Payment status counts
    const paymentStatus = order.payment_status || 'READY_FOR_PAYMENT';
    switch (paymentStatus) {
      case 'READY_FOR_PAYMENT':
        pendingPaymentCount++;
        totalOutstandingAmount += netTotal; // Full amount is outstanding
        break;
      case 'PARTIAL_PAYMENT':
        partialPaymentCount++;
        totalOutstandingAmount += outstanding; // Only outstanding portion
        break;
      case 'FULL_PAYMENT':
        fullPaymentCount++;
        break;
    }
  });

  return {
    totalSalesValue, // Total value of ALL orders
    totalOrderedQuantity, // Total quantity from ALL order items
    totalOrdersCount: completedOrdersCount, // Count of completed orders
    paidAmount: totalPaidAcrossAllOrders, // Total paid across all orders
    pendingAmount: totalOutstandingAmount, // Outstanding from pending + partial
    pendingPaymentCount,
    partialPaymentCount,
    fullPaymentCount,
  };
}

// ============================================
// CUSTOMER-WISE SALES REPORT
// ============================================

export async function fetchCustomerSalesReport(
  filters?: SalesAnalyticsFilters
): Promise<CustomerSalesReport[]> {
  // NOTE: Customer type filter is NOT applied to customer sales report
  // Fetch orders with customer info
  let query = supabase
    .from('orders')
    .select(`
      id,
      customer_id,
      total_amount,
      discount_amount,
      order_date,
      status,
      customers!inner(name, customer_type)
    `)
    .neq('status', 'CANCELLED');

  if (filters?.startDate) {
    query = query.gte('order_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('order_date', filters.endDate);
  }

  const { data: orders, error: ordersError } = await query;
  if (ordersError) throw ordersError;

  // Get order IDs for payment lookup
  const orderIds = (orders || []).map(o => o.id);

  // Fetch all payments
  let paymentsMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from('order_payments')
      .select('order_id, amount_received')
      .in('order_id', orderIds);

    if (paymentsError) throw paymentsError;

    (payments || []).forEach(p => {
      const current = paymentsMap.get(p.order_id) || 0;
      paymentsMap.set(p.order_id, current + parseFloat(p.amount_received || '0'));
    });
  }

  // Group by customer
  const customerMap = new Map<string, {
    customerName: string;
    customerType: string;
    totalOrders: number;
    totalOrderedValue: number;
    totalPaid: number;
    lastOrderDate: string;
  }>();

  (orders || []).forEach((order: any) => {
    const customerId = order.customer_id;
    const customer = order.customers;
    const netTotal = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');
    const paid = paymentsMap.get(order.id) || 0;

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customerName: customer?.name || 'Unknown',
        customerType: customer?.customer_type || 'Unknown',
        totalOrders: 0,
        totalOrderedValue: 0,
        totalPaid: 0,
        lastOrderDate: order.order_date,
      });
    }

    const stats = customerMap.get(customerId)!;
    stats.totalOrders += 1;
    stats.totalOrderedValue += netTotal;
    stats.totalPaid += paid;

    if (order.order_date > stats.lastOrderDate) {
      stats.lastOrderDate = order.order_date;
    }
  });

  // Convert to array and calculate outstanding
  return Array.from(customerMap.entries())
    .map(([customerId, stats]) => ({
      customerId,
      customerName: stats.customerName,
      customerType: stats.customerType,
      totalOrders: stats.totalOrders,
      totalOrderedValue: stats.totalOrderedValue,
      outstandingAmount: Math.max(0, stats.totalOrderedValue - stats.totalPaid),
      lastOrderDate: stats.lastOrderDate,
    }))
    .sort((a, b) => b.totalOrderedValue - a.totalOrderedValue);
}

// ============================================
// PRODUCT/TAG-WISE SALES REPORT
// ============================================

export async function fetchProductSalesReport(
  filters?: SalesAnalyticsFilters
): Promise<ProductSalesReport[]> {
  // Fetch order items with ORDERED quantities (not delivered)
  // This matches the Sales Summary which shows total order values
  // NOTE: Customer type filter is NOT applied to product sales
  let query = supabase
    .from('order_items')
    .select(`
      quantity,
      unit_price,
      unit,
      order_id,
      processed_goods!inner(
        produced_goods_tag_id,
        produced_goods_tags!inner(id, display_name)
      ),
      orders!inner(
        order_date,
        status,
        total_amount,
        discount_amount
      )
    `)
    .neq('orders.status', 'CANCELLED');

  if (filters?.startDate) {
    query = query.gte('orders.order_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('orders.order_date', filters.endDate);
  }
  if (filters?.productTag) {
    query = query.eq('processed_goods.produced_goods_tags.id', filters.productTag);
  }

  const { data: items, error } = await query;
  if (error) throw error;

  // First, calculate order totals and discount ratios
  const orderTotalsMap = new Map<string, { itemsTotal: number; discountRatio: number }>();
  
  (items || []).forEach((item: any) => {
    const orderId = item.order_id;
    if (!orderTotalsMap.has(orderId)) {
      const order = item.orders;
      const orderTotal = parseFloat(order.total_amount || '0');
      const orderDiscount = parseFloat(order.discount_amount || '0');
      // Calculate discount ratio: if order has discount, apply proportionally
      const discountRatio = orderTotal > 0 ? (orderTotal - orderDiscount) / orderTotal : 1;
      
      orderTotalsMap.set(orderId, {
        itemsTotal: 0,
        discountRatio,
      });
    }
  });

  // Group by tag and apply discounts proportionally
  const tagMap = new Map<string, {
    tagName: string;
    quantitySold: number;
    totalSalesValue: number;
    unit: string;
  }>();

  let grandTotal = 0;

  (items || []).forEach((item: any) => {
    const tag = item.processed_goods?.produced_goods_tags;
    const tagId = tag?.id;
    const tagName = tag?.display_name || 'Unknown';
    const qty = parseFloat(item.quantity || '0');
    const itemGrossValue = qty * parseFloat(item.unit_price || '0');
    
    // Apply order discount proportionally to this item
    const orderId = item.order_id;
    const orderInfo = orderTotalsMap.get(orderId)!;
    const itemNetValue = itemGrossValue * orderInfo.discountRatio;

    grandTotal += itemNetValue;

    if (!tagMap.has(tagId)) {
      tagMap.set(tagId, {
        tagName,
        quantitySold: 0,
        totalSalesValue: 0,
        unit: item.unit || 'units',
      });
    }

    const stats = tagMap.get(tagId)!;
    stats.quantitySold += qty;
    stats.totalSalesValue += itemNetValue;
  });

  // Convert to array with share percentage
  return Array.from(tagMap.entries())
    .map(([tagId, stats]) => ({
      tagId,
      tagName: stats.tagName,
      quantitySold: stats.quantitySold,
      totalSalesValue: stats.totalSalesValue,
      shareOfTotalSales: grandTotal > 0 ? (stats.totalSalesValue / grandTotal) * 100 : 0,
      unit: stats.unit,
    }))
    .sort((a, b) => b.totalSalesValue - a.totalSalesValue);
}

// ============================================
// OUTSTANDING PAYMENTS REPORT
// ============================================

export async function fetchOutstandingPaymentsReport(): Promise<OutstandingPaymentReport[]> {
  // Fetch ALL orders with outstanding payments (READY_FOR_PAYMENT or PARTIAL_PAYMENT)
  // NOTE: This section is NOT affected by ANY filters (date or customer type)
  // It always shows ALL outstanding payments across all customers and all time periods
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      order_date,
      total_amount,
      discount_amount,
      status,
      payment_status,
      customers!inner(id, name, customer_type)
    `)
    .neq('status', 'CANCELLED')
    .in('payment_status', ['READY_FOR_PAYMENT', 'PARTIAL_PAYMENT']);

  if (ordersError) throw ordersError;

  const orderIds = (orders || []).map(o => o.id);

  // Fetch payments
  let paymentsMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from('order_payments')
      .select('order_id, amount_received')
      .in('order_id', orderIds);

    if (paymentsError) throw paymentsError;

    (payments || []).forEach(p => {
      const current = paymentsMap.get(p.order_id) || 0;
      paymentsMap.set(p.order_id, current + parseFloat(p.amount_received || '0'));
    });
  }

  // Calculate outstanding for each order
  const now = new Date();
  const outstandingOrders: OutstandingPaymentReport[] = [];

  (orders || []).forEach((order: any) => {
    const netTotal = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');
    const paid = paymentsMap.get(order.id) || 0;
    const balance = netTotal - paid;

    // Calculate days outstanding
    const orderDate = new Date(order.order_date);
    const daysOutstanding = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

    // Include all orders with payment_status = READY_FOR_PAYMENT or PARTIAL_PAYMENT
    // These are already filtered in the query
    outstandingOrders.push({
      customerId: order.customers?.id || '',
      customerName: order.customers?.name || 'Unknown',
      orderId: order.id,
      orderNumber: order.order_number,
      orderDate: order.order_date,
      orderedItemValue: netTotal,
      amountReceived: paid,
      balancePending: Math.max(0, balance), // Ensure non-negative
      daysOutstanding,
    });
  });

  // Sort by days outstanding (descending)
  return outstandingOrders.sort((a, b) => b.daysOutstanding - a.daysOutstanding);
}

// ============================================
// SALES TREND ANALYTICS
// ============================================

export async function fetchSalesTrendData(
  filters?: SalesAnalyticsFilters
): Promise<SalesTrendData[]> {
  // If product tag filter is provided, use product-based calculation
  if (filters?.productTag) {
    // Fetch order items filtered by product tag
    let query = supabase
      .from('order_items')
      .select(`
        quantity,
        unit_price,
        order_id,
        processed_goods!inner(
          produced_goods_tag_id,
          produced_goods_tags!inner(id, display_name)
        ),
        orders!inner(
          order_date,
          status,
          customer_id,
          total_amount,
          discount_amount
        )
      `)
      .neq('orders.status', 'CANCELLED')
      .eq('processed_goods.produced_goods_tags.id', filters.productTag);

    if (filters?.startDate) {
      query = query.gte('orders.order_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('orders.order_date', filters.endDate);
    }

    // If customer type filter is also provided, get matching customer IDs
    let customerIds: string[] | undefined;
    if (filters?.customerType) {
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, customer_types!inner(type_key)')
        .eq('customer_types.type_key', filters.customerType);
      
      if (customersError) throw customersError;
      customerIds = (customers || []).map(c => c.id);
      
      if (customerIds.length === 0) {
        return [];
      }
    }

    const { data: items, error } = await query;
    if (error) throw error;

    // Filter by customer IDs if needed
    const filteredItems = customerIds 
      ? (items || []).filter((item: any) => customerIds.includes(item.orders.customer_id))
      : (items || []);

    // Group by month
    const monthMap = new Map<string, { 
      salesValue: number; 
      orderIds: Set<string>;
    }>();

    filteredItems.forEach((item: any) => {
      const month = item.orders.order_date.substring(0, 7); // YYYY-MM
      const qty = parseFloat(item.quantity || '0');
      const value = qty * parseFloat(item.unit_price || '0');
      const orderId = item.order_id;

      if (!monthMap.has(month)) {
        monthMap.set(month, { 
          salesValue: 0,
          orderIds: new Set(),
        });
      }

      const stats = monthMap.get(month)!;
      stats.salesValue += value;
      stats.orderIds.add(orderId);
    });

    // Convert to array and sort by month
    return Array.from(monthMap.entries())
      .map(([month, stats]) => ({
        month,
        salesValue: stats.salesValue,
        ordersCount: stats.orderIds.size,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // Original logic for customer type filter only (no product filter)
  // If customer type filter is provided, first get matching customer IDs
  let customerIds: string[] | undefined;
  if (filters?.customerType) {
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, customer_types!inner(type_key)')
      .eq('customer_types.type_key', filters.customerType);
    
    if (customersError) throw customersError;
    customerIds = (customers || []).map(c => c.id);
    
    // If no customers match, return empty array
    if (customerIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from('orders')
    .select('order_date, total_amount, discount_amount, status, customer_id')
    .neq('status', 'CANCELLED');

  if (filters?.startDate) {
    query = query.gte('order_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('order_date', filters.endDate);
  }
  if (customerIds) {
    query = query.in('customer_id', customerIds);
  }

  const { data: orders, error } = await query;
  if (error) throw error;

  // Group by month
  const monthMap = new Map<string, { salesValue: number; ordersCount: number }>();

  (orders || []).forEach(order => {
    const month = order.order_date.substring(0, 7); // YYYY-MM
    const netTotal = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');

    if (!monthMap.has(month)) {
      monthMap.set(month, { salesValue: 0, ordersCount: 0 });
    }

    const stats = monthMap.get(month)!;
    stats.salesValue += netTotal;
    stats.ordersCount += 1;
  });

  // Convert to array and sort by month
  return Array.from(monthMap.entries())
    .map(([month, stats]) => ({
      month,
      salesValue: stats.salesValue,
      ordersCount: stats.ordersCount,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ============================================
// PRODUCT PERFORMANCE ANALYTICS
// ============================================

export async function fetchProductPerformanceData(
  filters?: SalesAnalyticsFilters
): Promise<ProductPerformanceData[]> {
  const productSales = await fetchProductSalesReport(filters);

  return productSales.map(p => ({
    tagName: p.tagName,
    salesValue: p.totalSalesValue,
    quantitySold: p.quantitySold,
    sharePercentage: p.shareOfTotalSales,
  }));
}

// ============================================
// CUSTOMER CONCENTRATION ANALYTICS
// ============================================

export async function fetchCustomerConcentrationData(
  filters?: SalesAnalyticsFilters
): Promise<CustomerConcentrationData[]> {
  const customerSales = await fetchCustomerSalesReport(filters);

  const totalSales = customerSales.reduce((sum, c) => sum + c.totalOrderedValue, 0);

  return customerSales.map(c => ({
    customerName: c.customerName,
    salesValue: c.totalOrderedValue,
    sharePercentage: totalSales > 0 ? (c.totalOrderedValue / totalSales) * 100 : 0,
  }));
}

// ============================================
// TOP/BOTTOM PRODUCTS
// ============================================

export async function fetchTopSellingProducts(
  limit: number = 5,
  filters?: SalesAnalyticsFilters
): Promise<ProductExtremeData[]> {
  const productSales = await fetchProductSalesReport(filters);

  return productSales
    .slice(0, limit)
    .map((p, index) => ({
      tagId: p.tagId,
      tagName: p.tagName,
      quantitySold: p.quantitySold,
      salesValue: p.totalSalesValue,
      unit: p.unit,
      rank: index + 1,
    }));
}

export async function fetchLowestSellingProducts(
  limit: number = 5,
  filters?: SalesAnalyticsFilters
): Promise<ProductExtremeData[]> {
  const productSales = await fetchProductSalesReport(filters);

  // Get products with sales > 0, sorted ascending
  const lowestSelling = productSales
    .filter(p => p.quantitySold > 0)
    .sort((a, b) => a.quantitySold - b.quantitySold)
    .slice(0, limit);

  return lowestSelling.map((p, index) => ({
    tagId: p.tagId,
    tagName: p.tagName,
    quantitySold: p.quantitySold,
    salesValue: p.totalSalesValue,
    unit: p.unit,
    rank: index + 1,
  }));
}

// ============================================
// CUSTOMER PAYMENT PERFORMANCE
// ============================================

export async function fetchTopPayingCustomers(
  limit: number = 5,
  filters?: SalesAnalyticsFilters
): Promise<CustomerPaymentPerformance[]> {
  const customerSales = await fetchCustomerSalesReport(filters);

  // NOTE: Customer type filter is NOT applied
  // Get order IDs for payment calculation
  let query = supabase
    .from('orders')
    .select('id, customer_id')
    .neq('status', 'CANCELLED');

  if (filters?.startDate) {
    query = query.gte('order_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('order_date', filters.endDate);
  }

  const { data: orders, error: ordersError } = await query;
  if (ordersError) throw ordersError;

  const orderIds = (orders || []).map(o => o.id);

  // Fetch payments
  let paymentsMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from('order_payments')
      .select('order_id, amount_received')
      .in('order_id', orderIds);

    if (paymentsError) throw paymentsError;

    // Map payments to customers
    const orderToCustomer = new Map((orders || []).map(o => [o.id, o.customer_id]));

    (payments || []).forEach(p => {
      const customerId = orderToCustomer.get(p.order_id);
      if (customerId) {
        const current = paymentsMap.get(customerId) || 0;
        paymentsMap.set(customerId, current + parseFloat(p.amount_received || '0'));
      }
    });
  }

  // Build performance data
  const performance = customerSales.map(c => ({
    customerId: c.customerId,
    customerName: c.customerName,
    customerType: c.customerType,
    totalPaid: paymentsMap.get(c.customerId) || 0,
    totalOutstanding: c.outstandingAmount,
    averageDelayDays: 0, // TODO: Calculate from outstanding report
    ordersCount: c.totalOrders,
  }));

  // Sort by total paid (descending) and return top N
  return performance
    .sort((a, b) => b.totalPaid - a.totalPaid)
    .slice(0, limit);
}

export async function fetchHighestOutstandingCustomers(
  limit: number = 5,
  filters?: SalesAnalyticsFilters
): Promise<CustomerPaymentPerformance[]> {
  const customerSales = await fetchCustomerSalesReport(filters);
  const outstandingReport = await fetchOutstandingPaymentsReport(); // No filters

  // Calculate average delay per customer
  const delayMap = new Map<string, { totalDays: number; count: number }>();
  outstandingReport.forEach(o => {
    if (!delayMap.has(o.customerId)) {
      delayMap.set(o.customerId, { totalDays: 0, count: 0 });
    }
    const stats = delayMap.get(o.customerId)!;
    stats.totalDays += o.daysOutstanding;
    stats.count += 1;
  });

  // Build performance data
  const performance = customerSales
    .filter(c => c.outstandingAmount > 0)
    .map(c => {
      const delayStats = delayMap.get(c.customerId);
      const avgDelay = delayStats ? delayStats.totalDays / delayStats.count : 0;

      return {
        customerId: c.customerId,
        customerName: c.customerName,
        customerType: c.customerType,
        totalPaid: c.totalOrderedValue - c.outstandingAmount,
        totalOutstanding: c.outstandingAmount,
        averageDelayDays: Math.round(avgDelay),
        ordersCount: c.totalOrders,
      };
    });

  // Sort by outstanding (descending) and return top N
  return performance
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .slice(0, limit);
}

// ============================================
// SALES DISTRIBUTION ANALYSIS
// ============================================

export async function fetchSalesDistribution(
  filters?: SalesAnalyticsFilters
): Promise<SalesDistribution> {
  const customerSales = await fetchCustomerSalesReport(filters);
  const productSales = await fetchProductSalesReport(filters);

  const totalCustomerSales = customerSales.reduce((sum, c) => sum + c.totalOrderedValue, 0);
  const totalProductSales = productSales.reduce((sum, p) => sum + p.totalSalesValue, 0);

  // Customer concentration
  const top1Customer = customerSales[0]?.totalOrderedValue || 0;
  const top3Customers = customerSales.slice(0, 3).reduce((sum, c) => sum + c.totalOrderedValue, 0);
  const top5Customers = customerSales.slice(0, 5).reduce((sum, c) => sum + c.totalOrderedValue, 0);

  // Product concentration
  const top1Product = productSales[0]?.totalSalesValue || 0;
  const top3Products = productSales.slice(0, 3).reduce((sum, p) => sum + p.totalSalesValue, 0);

  return {
    top1CustomerShare: totalCustomerSales > 0 ? (top1Customer / totalCustomerSales) * 100 : 0,
    top3CustomersShare: totalCustomerSales > 0 ? (top3Customers / totalCustomerSales) * 100 : 0,
    top5CustomersShare: totalCustomerSales > 0 ? (top5Customers / totalCustomerSales) * 100 : 0,
    top1ProductShare: totalProductSales > 0 ? (top1Product / totalProductSales) * 100 : 0,
    top3ProductsShare: totalProductSales > 0 ? (top3Products / totalProductSales) * 100 : 0,
  };
}

// ============================================
// CUSTOMER TYPE DISTRIBUTION
// ============================================

export async function fetchCustomerTypeDistribution(
  filters?: SalesAnalyticsFilters
): Promise<CustomerTypeDistribution[]> {
  const customerSales = await fetchCustomerSalesReport(filters);

  // Group by customer type
  const typeMap = new Map<string, {
    totalSales: number;
    orderCount: number;
    customerIds: Set<string>;
  }>();

  customerSales.forEach(customer => {
    const type = customer.customerType || 'Unknown';
    
    if (!typeMap.has(type)) {
      typeMap.set(type, {
        totalSales: 0,
        orderCount: 0,
        customerIds: new Set(),
      });
    }

    const stats = typeMap.get(type)!;
    stats.totalSales += customer.totalOrderedValue;
    stats.orderCount += customer.totalOrders;
    stats.customerIds.add(customer.customerId);
  });

  // Calculate total sales for percentage
  const totalSales = Array.from(typeMap.values()).reduce((sum, stats) => sum + stats.totalSales, 0);

  // Convert to array with percentages
  return Array.from(typeMap.entries())
    .map(([customerType, stats]) => ({
      customerType,
      totalSales: stats.totalSales,
      orderCount: stats.orderCount,
      customerCount: stats.customerIds.size,
      sharePercentage: totalSales > 0 ? (stats.totalSales / totalSales) * 100 : 0,
    }))
    .sort((a, b) => b.totalSales - a.totalSales);
}

// ============================================
// PRODUCT SALES TREND ANALYTICS
// ============================================

export async function fetchProductSalesTrendData(
  filters?: SalesAnalyticsFilters
): Promise<ProductSalesTrendData[]> {
  // Fetch order items with product tag information
  let query = supabase
    .from('order_items')
    .select(`
      quantity,
      unit_price,
      order_id,
      processed_goods!inner(
        produced_goods_tag_id,
        produced_goods_tags!inner(id, display_name)
      ),
      orders!inner(
        order_date,
        status,
        total_amount,
        discount_amount
      )
    `)
    .neq('orders.status', 'CANCELLED');

  if (filters?.startDate) {
    query = query.gte('orders.order_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('orders.order_date', filters.endDate);
  }
  if (filters?.productTag) {
    query = query.eq('processed_goods.produced_goods_tags.id', filters.productTag);
  }

  const { data: items, error } = await query;
  if (error) throw error;

  // Group by month
  const monthMap = new Map<string, { 
    quantitySold: number; 
    salesValue: number; 
    orderIds: Set<string>;
  }>();

  (items || []).forEach((item: any) => {
    const month = item.orders.order_date.substring(0, 7); // YYYY-MM
    const qty = parseFloat(item.quantity || '0');
    const value = qty * parseFloat(item.unit_price || '0');
    const orderId = item.order_id;

    if (!monthMap.has(month)) {
      monthMap.set(month, { 
        quantitySold: 0, 
        salesValue: 0,
        orderIds: new Set(),
      });
    }

    const stats = monthMap.get(month)!;
    stats.quantitySold += qty;
    stats.salesValue += value;
    stats.orderIds.add(orderId);
  });

  // Convert to array and sort by month
  return Array.from(monthMap.entries())
    .map(([month, stats]) => ({
      month,
      quantitySold: stats.quantitySold,
      salesValue: stats.salesValue,
      ordersCount: stats.orderIds.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
