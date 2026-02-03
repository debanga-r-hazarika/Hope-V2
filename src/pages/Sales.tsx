import { useEffect, useState, useMemo } from 'react';
import { Customers } from './Customers';
import { CustomerDetail } from './CustomerDetail';
import { Orders } from './Orders';
import { OrderDetail } from './OrderDetail';
import { Package, Users, TrendingUp, CreditCard, ShoppingBag } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import { fetchOrders, getOrderPaymentStatus } from '../lib/sales';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/sales';
import { ModernCard } from '../components/ui/ModernCard';

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
      readyForDelivery: { count: 0, value: 0 },
      partiallyDelivered: { count: 0, value: 0 },
      deliveryCompleted: { count: 0, value: 0 },
      orderCompleted: { count: 0, value: 0 },
      readyForPayment: { count: 0, value: 0 },
      partialPayment: { count: 0, value: 0 },
      fullPayment: { count: 0, value: 0 },
    };

    orders.forEach((order) => {
      const value = order.total_amount - (order.discount_amount || 0); // Use net total for statistics
      
      // Delivery status counts
      switch (order.status) {
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
      <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sales Overview</h1>
            <p className="mt-1 text-gray-500 text-lg">Monitor your sales performance and order status</p>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ModernCard
            onClick={() => onNavigateToSection('customers')}
            className="group hover:border-blue-200 transition-all duration-300 relative overflow-hidden cursor-pointer"
            padding="lg"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
              <Users className="w-32 h-32 text-blue-600" />
            </div>
            <div className="relative z-10 flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">Customers</h3>
                <p className="text-gray-500 leading-relaxed">Manage your customer database, view profiles, and track interaction history.</p>
              </div>
            </div>
          </ModernCard>

          <ModernCard
            onClick={() => onNavigateToSection('orders')}
            className="group hover:border-purple-200 transition-all duration-300 relative overflow-hidden cursor-pointer"
            padding="lg"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
              <ShoppingBag className="w-32 h-32 text-purple-600" />
            </div>
            <div className="relative z-10 flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-purple-700 transition-colors">Orders</h3>
                <p className="text-gray-500 leading-relaxed">Track sales orders, manage deliveries, and monitor payment statuses.</p>
              </div>
            </div>
          </ModernCard>
        </div>

        {/* Delivery Status Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Delivery Pipeline</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              title="Ready"
              count={statusStats.readyForDelivery.count}
              value={statusStats.readyForDelivery.value}
              loading={loadingOrders}
              color="blue"
            />
            <StatusCard
              title="Partial"
              count={statusStats.partiallyDelivered.count}
              value={statusStats.partiallyDelivered.value}
              loading={loadingOrders}
              color="amber"
            />
            <StatusCard
              title="Delivered"
              count={deliveryCompletedStats.totalQuantity}
              label="Total Qty"
              loading={loadingOrders}
              color="emerald"
              isQuantity
            />
            <StatusCard
              title="Completed"
              count={statusStats.orderCompleted.count}
              value={statusStats.orderCompleted.value}
              loading={loadingOrders}
              color="purple"
            />
          </div>
        </div>

        {/* Payment Status Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Payment Overview</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatusCard
              title="Ready for Payment"
              count={statusStats.readyForPayment.count}
              value={statusStats.readyForPayment.value}
              loading={loadingOrders}
              color="gray"
            />
            <StatusCard
              title="Partial Payment"
              count={statusStats.partialPayment.count}
              value={statusStats.partialPayment.value}
              loading={loadingOrders}
              color="yellow"
            />
            <StatusCard
              title="Full Payment"
              count={statusStats.fullPayment.count}
              value={statusStats.fullPayment.value}
              loading={loadingOrders}
              color="green"
            />
          </div>
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

// Helper component for status cards
function StatusCard({ 
  title, 
  count, 
  value, 
  label, 
  loading, 
  color, 
  isQuantity = false 
}: { 
  title: string; 
  count: number; 
  value?: number; 
  label?: string; 
  loading: boolean; 
  color: 'slate' | 'blue' | 'amber' | 'emerald' | 'purple' | 'gray' | 'yellow' | 'green';
  isQuantity?: boolean;
}) {
  const colorStyles = {
    slate: 'from-slate-50 to-white border-slate-200 text-slate-700',
    blue: 'from-blue-50 to-white border-blue-200 text-blue-700',
    amber: 'from-amber-50 to-white border-amber-200 text-amber-700',
    emerald: 'from-emerald-50 to-white border-emerald-200 text-emerald-700',
    purple: 'from-purple-50 to-white border-purple-200 text-purple-700',
    gray: 'from-gray-50 to-white border-gray-200 text-gray-700',
    yellow: 'from-yellow-50 to-white border-yellow-200 text-yellow-700',
    green: 'from-green-50 to-white border-green-200 text-green-700',
  };

  const textStyles = {
    slate: 'text-slate-900',
    blue: 'text-blue-900',
    amber: 'text-amber-900',
    emerald: 'text-emerald-900',
    purple: 'text-purple-900',
    gray: 'text-gray-900',
    yellow: 'text-yellow-900',
    green: 'text-green-900',
  };

  const subTextStyles = {
    slate: 'text-slate-500',
    blue: 'text-blue-500',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    purple: 'text-purple-500',
    gray: 'text-gray-500',
    yellow: 'text-yellow-500',
    green: 'text-green-500',
  };

  return (
    <div className={`bg-gradient-to-br ${colorStyles[color]} border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200`}>
      <p className="text-xs font-bold uppercase tracking-wider opacity-90 mb-2">{title}</p>
      <div className="flex flex-col">
        <span className={`text-2xl font-bold ${textStyles[color]} tracking-tight`}>
          {loading ? '...' : isQuantity ? count.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : count}
        </span>
        {value !== undefined && (
          <span className={`text-sm font-medium ${subTextStyles[color]} mt-1`}>
            ₹{loading ? '...' : value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        )}
        {label && (
          <span className={`text-xs font-medium ${subTextStyles[color]} mt-1`}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
