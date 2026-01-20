import { useEffect, useState, useMemo } from 'react';
import { Customers } from './Customers';
import { CustomerDetail } from './CustomerDetail';
import { Orders } from './Orders';
import { OrderDetail } from './OrderDetail';
import { Package } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import { fetchOrders, getOrderPaymentStatus } from '../lib/sales';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/sales';

type SalesSection = 'customers' | 'orders' | null;

interface SalesProps {
  section: SalesSection;
  selectedCustomerId: string | null;
  selectedOrderId: string | null;
  onNavigateToSection: (section: SalesSection) => void;
  onViewCustomer: (customerId: string) => void;
  onViewOrder: (orderId: string) => void;
  onBackToCustomers: () => void;
  onBackToOrders: () => void;
  accessLevel: AccessLevel;
}

export function Sales({
  section,
  selectedCustomerId,
  selectedOrderId,
  onNavigateToSection,
  onViewCustomer,
  onViewOrder,
  onBackToCustomers,
  onBackToOrders,
  accessLevel,
}: SalesProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [deliveryCompletedStats, setDeliveryCompletedStats] = useState<{ totalProducts: number; totalQuantity: number }>({ totalProducts: 0, totalQuantity: 0 });

  useEffect(() => {
    if (!section) {
      void loadOrders();
    }
  }, [section]);

  const loadOrders = async () => {
    setLoadingOrders(true);
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
      
      // Calculate delivery completed stats (total quantity delivered)
      await loadDeliveryCompletedStats(ordersWithPaymentStatus);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
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

  // Default to customers section if no section is selected
  if (!section) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales, Orders & Customer Realisation</h1>
          <p className="mt-2 text-gray-600">Manage customers and orders</p>
        </div>

        {/* Delivery Status Cards */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Delivery Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Draft</p>
                <Package className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{loadingOrders ? '...' : statusStats.draft.count}</p>
              <p className="text-sm text-slate-600 mt-1">₹{loadingOrders ? '...' : statusStats.draft.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Ready for Delivery</p>
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">{loadingOrders ? '...' : statusStats.readyForDelivery.count}</p>
              <p className="text-sm text-blue-600 mt-1">₹{loadingOrders ? '...' : statusStats.readyForDelivery.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">Partially Delivered</p>
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-900">{loadingOrders ? '...' : statusStats.partiallyDelivered.count}</p>
              <p className="text-sm text-amber-600 mt-1">₹{loadingOrders ? '...' : statusStats.partiallyDelivered.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Delivery Completed</p>
                <Package className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-900">{loadingOrders ? '...' : deliveryCompletedStats.totalQuantity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-sm text-emerald-600 mt-1">Total Delivered Quantity</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Order Completed</p>
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">{loadingOrders ? '...' : statusStats.orderCompleted.count}</p>
              <p className="text-sm text-purple-600 mt-1">₹{loadingOrders ? '...' : statusStats.orderCompleted.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Payment Status Cards */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Payment Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Ready for Payment</p>
                <Package className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{loadingOrders ? '...' : statusStats.readyForPayment.count}</p>
              <p className="text-sm text-gray-600 mt-1">₹{loadingOrders ? '...' : statusStats.readyForPayment.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Partial Payment</p>
                <Package className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-yellow-900">{loadingOrders ? '...' : statusStats.partialPayment.count}</p>
              <p className="text-sm text-yellow-600 mt-1">₹{loadingOrders ? '...' : statusStats.partialPayment.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Full Payment</p>
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">{loadingOrders ? '...' : statusStats.fullPayment.count}</p>
              <p className="text-sm text-green-600 mt-1">₹{loadingOrders ? '...' : statusStats.fullPayment.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => onNavigateToSection('customers')}
            className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-all hover:scale-105 text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Customers</h3>
            <p className="text-sm text-gray-600">Manage customer database and CRM</p>
          </button>

          <button
            onClick={() => onNavigateToSection('orders')}
            className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-all hover:scale-105 text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Orders</h3>
            <p className="text-sm text-gray-600">Manage sales orders and deliveries</p>
          </button>
        </div>
      </div>
    );
  }

  if (section === 'customers') {
    if (selectedCustomerId) {
      return (
        <CustomerDetail
          customerId={selectedCustomerId}
          onBack={onBackToCustomers}
          onViewOrder={onViewOrder}
          accessLevel={accessLevel}
        />
      );
    }
    return (
      <Customers
        onBack={() => onNavigateToSection(null)}
        onViewCustomer={onViewCustomer}
        accessLevel={accessLevel}
      />
    );
  }

  if (section === 'orders') {
    if (selectedOrderId) {
      return (
        <OrderDetail
          orderId={selectedOrderId}
          onBack={onBackToOrders}
          onOrderDeleted={() => {
            // Refresh orders data when an order is deleted
            void loadOrders();
          }}
          accessLevel={accessLevel}
        />
      );
    }
    return (
      <Orders
        onBack={() => onNavigateToSection(null)}
        onViewOrder={onViewOrder}
        accessLevel={accessLevel}
      />
    );
  }

  return null;
}
