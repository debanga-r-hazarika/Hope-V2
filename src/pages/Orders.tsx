import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, RefreshCw, Eye, Package, Calendar, User } from 'lucide-react';
import { OrderForm } from '../components/OrderForm';
import { fetchOrders, createOrder, getOrderPaymentStatus } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Order, OrderFormData, OrderStatus, PaymentStatus } from '../types/sales';
import type { AccessLevel } from '../types/access';

interface OrdersProps {
  onBack: () => void;
  onViewOrder: (orderId: string) => void;
  accessLevel: AccessLevel;
}

type DeliveryStatusFilter = 'all' | 'DRAFT' | 'READY_FOR_DELIVERY' | 'PARTIALLY_DELIVERED' | 'DELIVERY_COMPLETED';
type PaymentStatusFilter = 'all' | 'READY_FOR_PAYMENT' | 'PARTIAL_PAYMENT' | 'FULL_PAYMENT';
type FinalStatusFilter = 'all' | 'ORDER_COMPLETED' | 'CANCELLED';

export function Orders({ onBack, onViewOrder, accessLevel }: OrdersProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDeliveryStatus, setFilterDeliveryStatus] = useState<DeliveryStatusFilter>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<PaymentStatusFilter>('all');
  const [filterFinalStatus, setFilterFinalStatus] = useState<FinalStatusFilter>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [deliveryCompletedStats, setDeliveryCompletedStats] = useState<{ totalProducts: number; totalQuantity: number }>({ totalProducts: 0, totalQuantity: 0 });

  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    void loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrders();
      // Ensure all orders have payment_status
      const ordersWithPaymentStatus = await Promise.all(
        data.map(async (order) => {
          if (!order.payment_status) {
            const paymentStatus = await getOrderPaymentStatus(order.id);
            return { ...order, payment_status: paymentStatus };
          }
          return order;
        })
      );
      setOrders(ordersWithPaymentStatus);
      
      // Calculate delivery completed stats (total products and quantity delivered)
      await loadDeliveryCompletedStats(ordersWithPaymentStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load orders';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryCompletedStats = async (ordersList: Order[]) => {
    try {
      // Get all order IDs with DELIVERY_COMPLETED or ORDER_COMPLETED status
      // Both statuses mean all items have been delivered
      const deliveryCompletedOrderIds = ordersList
        .filter(order => order.status === 'DELIVERY_COMPLETED' || order.status === 'ORDER_COMPLETED')
        .map(order => order.id);

      if (deliveryCompletedOrderIds.length === 0) {
        setDeliveryCompletedStats({ totalProducts: 0, totalQuantity: 0 });
        return;
      }

      // Fetch all order items for these orders
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select('quantity_delivered')
        .in('order_id', deliveryCompletedOrderIds)
        .not('quantity_delivered', 'is', null);

      if (error) throw error;

      // Calculate total quantity delivered (sum of all quantity_delivered values)
      // Example: ORD-00001: 5 Bottles + 3 Boxes = 8, ORD-00002: 15 Pouches + 13 Bottles = 28
      // Total: 8 + 28 = 36 Products Delivered
      let totalQuantity = 0;

      (orderItems || []).forEach((item: any) => {
        const delivered = parseFloat(item.quantity_delivered || 0);
        if (delivered > 0) {
          totalQuantity += delivered;
        }
      });

      setDeliveryCompletedStats({
        totalProducts: 0, // Not used, keeping for state structure compatibility
        totalQuantity: totalQuantity,
      });
    } catch (err) {
      console.error('Failed to load delivery completed stats:', err);
      setDeliveryCompletedStats({ totalProducts: 0, totalQuantity: 0 });
    }
  };

  const handleCreate = async (orderData: OrderFormData) => {
    await createOrder(orderData, { currentUserId: user?.id });
    await loadOrders();
  };

  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.order_number.toLowerCase().includes(term) ||
          o.customer_name?.toLowerCase().includes(term) ||
          o.customer_id.toLowerCase().includes(term)
      );
    }

    // Delivery status filter
    if (filterDeliveryStatus !== 'all') {
      filtered = filtered.filter((o) => {
        // Exclude ORDER_COMPLETED and CANCELLED from delivery status filter
        if (o.status === 'ORDER_COMPLETED' || o.status === 'CANCELLED') {
          return false;
        }
        return o.status === filterDeliveryStatus;
      });
    }

    // Payment status filter
    // Payment Status section is payment-focused, so include ORDER_COMPLETED orders
    // based on their payment_status (they still have payment_status = FULL_PAYMENT)
    if (filterPaymentStatus !== 'all') {
      filtered = filtered.filter((o) => {
        // Only exclude CANCELLED orders from payment status filter
        if (o.status === 'CANCELLED') {
          return false;
        }
        return o.payment_status === filterPaymentStatus;
      });
    }

    // Final status filter (ORDER_COMPLETED or CANCELLED)
    if (filterFinalStatus !== 'all') {
      filtered = filtered.filter((o) => o.status === filterFinalStatus);
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter((o) => o.order_date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((o) => o.order_date <= dateTo);
    }

    return filtered;
  }, [orders, searchTerm, filterDeliveryStatus, filterPaymentStatus, filterFinalStatus, dateFrom, dateTo]);

  // Helper function to get delivery status badge info
  const getDeliveryStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Draft', className: 'bg-slate-100 text-slate-700 border border-slate-200' };
      case 'READY_FOR_DELIVERY':
        return { label: 'Ready for Delivery', className: 'bg-blue-50 text-blue-700 border border-blue-200' };
      case 'PARTIALLY_DELIVERED':
        return { label: 'Partially Delivered', className: 'bg-amber-50 text-amber-700 border border-amber-200' };
      case 'DELIVERY_COMPLETED':
        return { label: 'Delivery Completed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
      case 'ORDER_COMPLETED':
        return { label: 'Order Completed', className: 'bg-purple-50 text-purple-700 border border-purple-200' };
      case 'CANCELLED':
        return { label: 'Cancelled', className: 'bg-red-50 text-red-700 border border-red-200' };
      default:
        return { label: status, className: 'bg-slate-100 text-slate-700 border border-slate-200' };
    }
  };

  // Helper function to get payment status badge info
  const getPaymentStatusBadge = (paymentStatus?: PaymentStatus) => {
    if (!paymentStatus) {
      return { label: 'Ready for Payment', className: 'bg-gray-50 text-gray-700 border border-gray-200' };
    }
    switch (paymentStatus) {
      case 'READY_FOR_PAYMENT':
        return { label: 'Ready for Payment', className: 'bg-gray-50 text-gray-700 border border-gray-200' };
      case 'PARTIAL_PAYMENT':
        return { label: 'Partial Payment', className: 'bg-yellow-50 text-yellow-700 border border-yellow-200' };
      case 'FULL_PAYMENT':
        return { label: 'Full Payment', className: 'bg-green-50 text-green-700 border border-green-200' };
      default:
        return { label: paymentStatus, className: 'bg-gray-50 text-gray-700 border border-gray-200' };
    }
  };

  // Calculate status-based statistics
  const statusStats = useMemo(() => {
    const stats = {
      draft: { count: 0, value: 0 },
      readyForDelivery: { count: 0, value: 0 },
      partiallyDelivered: { count: 0, value: 0 },
      deliveryCompleted: { count: 0, value: 0 },
      orderCompleted: { count: 0, value: 0 },
      readyForPayment: { count: 0, value: 0 },
      partialPayment: { count: 0, value: 0 },
      fullPayment: { count: 0, value: 0 },
      cancelled: { count: 0, value: 0 },
    };

    orders.forEach((order) => {
      const value = order.total_amount;
      
      // Delivery status counts
      switch (order.status) {
        case 'DRAFT':
          stats.draft.count++;
          stats.draft.value += value;
          break;
        case 'READY_FOR_DELIVERY':
          stats.readyForDelivery.count++;
          stats.readyForDelivery.value += value;
          break;
        case 'PARTIALLY_DELIVERED':
          stats.partiallyDelivered.count++;
          stats.partiallyDelivered.value += value;
          break;
        case 'DELIVERY_COMPLETED':
          stats.deliveryCompleted.count++;
          stats.deliveryCompleted.value += value;
          break;
        case 'ORDER_COMPLETED':
          stats.orderCompleted.count++;
          stats.orderCompleted.value += value;
          break;
        case 'CANCELLED':
          stats.cancelled.count++;
          stats.cancelled.value += value;
          break;
      }

      // Payment status counts (include all orders except cancelled)
      // Payment Status section is a payment-focused dashboard, so ORDER_COMPLETED orders
      // should still show in payment status cards based on their payment_status
      if (order.status !== 'CANCELLED') {
        const paymentStatus = order.payment_status || 'READY_FOR_PAYMENT';
        switch (paymentStatus) {
          case 'READY_FOR_PAYMENT':
            stats.readyForPayment.count++;
            stats.readyForPayment.value += value;
            break;
          case 'PARTIAL_PAYMENT':
            stats.partialPayment.count++;
            stats.partialPayment.value += value;
            break;
          case 'FULL_PAYMENT':
            stats.fullPayment.count++;
            stats.fullPayment.value += value;
            break;
        }
      }
    });

    return stats;
  }, [orders]);

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Sales module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <p className="text-sm text-gray-600 mt-1">Manage sales orders and deliveries</p>
          </div>
        </div>
        {hasWriteAccess && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <Plus className="w-5 h-5" />
            New Order
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Status Cards - Delivery Status */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Delivery Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Draft</p>
              <Package className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{statusStats.draft.count}</p>
            <p className="text-sm text-slate-600 mt-1">₹{statusStats.draft.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Ready for Delivery</p>
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-900">{statusStats.readyForDelivery.count}</p>
            <p className="text-sm text-blue-600 mt-1">₹{statusStats.readyForDelivery.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">Partially Delivered</p>
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-900">{statusStats.partiallyDelivered.count}</p>
            <p className="text-sm text-amber-600 mt-1">₹{statusStats.partiallyDelivered.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Delivery Completed</p>
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-900">{deliveryCompletedStats.totalQuantity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-sm text-emerald-600 mt-1">Total Delivered Quantity</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Order Completed</p>
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-900">{statusStats.orderCompleted.count}</p>
            <p className="text-sm text-purple-600 mt-1">₹{statusStats.orderCompleted.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Status Cards - Payment Status */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Payment Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Ready for Payment</p>
              <Package className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statusStats.readyForPayment.count}</p>
            <p className="text-sm text-gray-600 mt-1">₹{statusStats.readyForPayment.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Partial Payment</p>
              <Package className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-900">{statusStats.partialPayment.count}</p>
            <p className="text-sm text-yellow-600 mt-1">₹{statusStats.partialPayment.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Full Payment</p>
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-900">{statusStats.fullPayment.count}</p>
            <p className="text-sm text-green-600 mt-1">₹{statusStats.fullPayment.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by order number, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
            />
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <select
              value={filterDeliveryStatus}
              onChange={(e) => setFilterDeliveryStatus(e.target.value as DeliveryStatusFilter)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm bg-white"
            >
              <option value="all">All Delivery Status</option>
              <option value="DRAFT">Draft</option>
              <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
              <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
              <option value="DELIVERY_COMPLETED">Delivery Completed</option>
            </select>
            <select
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value as PaymentStatusFilter)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm bg-white"
            >
              <option value="all">All Payment Status</option>
              <option value="READY_FOR_PAYMENT">Ready for Payment</option>
              <option value="PARTIAL_PAYMENT">Partial Payment</option>
              <option value="FULL_PAYMENT">Full Payment</option>
            </select>
            <select
              value={filterFinalStatus}
              onChange={(e) => setFilterFinalStatus(e.target.value as FinalStatusFilter)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm bg-white"
            >
              <option value="all">All Final Status</option>
              <option value="ORDER_COMPLETED">Order Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From Date"
                className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To Date"
                className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              />
            </div>
            <button
              onClick={() => void loadOrders()}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm || filterDeliveryStatus !== 'all' || filterPaymentStatus !== 'all' || filterFinalStatus !== 'all' || dateFrom || dateTo
              ? 'No orders match your filters.'
              : 'No orders found. Create your first order to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Order Number
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const deliveryBadge = getDeliveryStatusBadge(order.status);
                  const paymentBadge = getPaymentStatusBadge(order.payment_status);
                  const showOnlyOneBadge = order.status === 'ORDER_COMPLETED';
                  
                  return (
                    <tr key={order.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 font-mono">{order.order_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{order.customer_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {showOnlyOneBadge ? (
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${deliveryBadge.className}`}>
                              {deliveryBadge.label}
                            </span>
                          ) : (
                            <>
                              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${deliveryBadge.className}`}>
                                {deliveryBadge.label}
                              </span>
                              {order.status !== 'CANCELLED' && (
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${paymentBadge.className}`}>
                                  {paymentBadge.label}
                                </span>
                              )}
                            </>
                          )}
                          {order.is_locked && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5 text-sm font-semibold text-gray-900">
                          <span className="text-gray-600 font-normal">₹</span>
                          <span>{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => onViewOrder(order.id)}
                          className="inline-flex items-center justify-center p-2 hover:bg-purple-100 rounded-lg transition-colors text-purple-600 hover:text-purple-700"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrderForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
