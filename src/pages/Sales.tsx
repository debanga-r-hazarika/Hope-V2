import { useEffect, useState, useMemo } from 'react';
import { Customers } from './Customers';
import { CustomerDetail } from './CustomerDetail';
import { Orders } from './Orders';
import { OrderDetail } from './OrderDetail';
import { Package, Users, CreditCard, ShoppingBag, ArrowRight, DollarSign, Activity, CheckCircle, Clock } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import { fetchOrders, getOrderPaymentStatus } from '../lib/sales';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/sales';

type OrderWithPayment = Order & { total_paid?: number };

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
  const [orders, setOrders] = useState<OrderWithPayment[]>([]);
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
      
      // Fetch payment totals for all orders
      const { data: paymentsData } = await supabase
        .from('order_payments')
        .select('order_id, amount_received');
      
      const paymentTotals = new Map<string, number>();
      (paymentsData || []).forEach((payment: any) => {
        const current = paymentTotals.get(payment.order_id) || 0;
        paymentTotals.set(payment.order_id, current + parseFloat(payment.amount_received || 0));
      });
      
      // Ensure all orders have payment_status and total_paid
      const ordersWithPaymentStatus = await Promise.all(
        data.map(async (order) => {
          const totalPaid = paymentTotals.get(order.id) || 0;
          let paymentStatus = order.payment_status;
          
          if (!paymentStatus) {
            paymentStatus = await getOrderPaymentStatus(order.id);
          }
          
          return { ...order, payment_status: paymentStatus, total_paid: totalPaid };
        })
      );
      setOrders(ordersWithPaymentStatus);

      // Calculate total ordered quantity
      await loadTotalOrderedQuantity(ordersWithPaymentStatus);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadTotalOrderedQuantity = async (ordersList: OrderWithPayment[]) => {
    try {
      // Get all order IDs with items (READY_FOR_PAYMENT, FULL_PAYMENT, HOLD, ORDER_COMPLETED)
      // Exclude ORDER_CREATED (no items)
      const activeOrderIds = ordersList
        .filter(order =>
          order.status !== 'ORDER_CREATED'
        )
        .map(order => order.id);

      if (activeOrderIds.length === 0) {
        setDeliveryCompletedStats({ totalProducts: 0, totalQuantity: 0 });
        return;
      }

      // Fetch all order items for these orders
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select('quantity')
        .in('order_id', activeOrderIds);

      if (error) throw error;

      // Calculate total quantity ordered (sum of all quantity values)
      let totalQuantity = 0;

      (orderItems || []).forEach((item: any) => {
        const quantity = parseFloat(item.quantity || 0);
        if (quantity > 0) {
          totalQuantity += quantity;
        }
      });

      setDeliveryCompletedStats({
        totalProducts: 0, // Not used, keeping for state structure compatibility
        totalQuantity: totalQuantity,
      });
    } catch (err) {
      console.error('Failed to load total ordered quantity:', err);
      setDeliveryCompletedStats({ totalProducts: 0, totalQuantity: 0 });
    }
  };

  // Calculate status-based statistics
  const statusStats = useMemo(() => {
    const stats = {
      orderCreated: { count: 0, value: 0 },
      readyForPayment: { count: 0, value: 0 },
      fullPayment: { count: 0, value: 0 },
      hold: { count: 0, value: 0 },
      orderCompleted: { count: 0, value: 0 },
      readyForPaymentPaymentStatus: { count: 0, value: 0 },
      partialPayment: { count: 0, value: 0, outstanding: 0 },
      fullPaymentPaymentStatus: { count: 0, value: 0 },
      totalPaidAcrossAllOrders: 0, // Track all payments received
    };

    orders.forEach((order) => {
      const netTotal = order.total_amount - (order.discount_amount || 0);
      const totalPaid = order.total_paid || 0;
      const outstanding = netTotal - totalPaid;

      // Accumulate ALL payments received (regardless of order status)
      stats.totalPaidAcrossAllOrders += totalPaid;

      // Order status counts
      switch (order.status) {
        case 'ORDER_CREATED':
          stats.orderCreated.count++;
          stats.orderCreated.value += netTotal;
          break;
        case 'READY_FOR_PAYMENT':
          stats.readyForPayment.count++;
          stats.readyForPayment.value += netTotal;
          break;
        case 'FULL_PAYMENT':
          stats.fullPayment.count++;
          stats.fullPayment.value += netTotal;
          break;
        case 'HOLD':
          stats.hold.count++;
          stats.hold.value += netTotal;
          break;
        case 'ORDER_COMPLETED':
          stats.orderCompleted.count++;
          stats.orderCompleted.value += netTotal;
          break;
      }

      // Payment status counts
      const paymentStatus = order.payment_status || 'READY_FOR_PAYMENT';
      switch (paymentStatus) {
        case 'READY_FOR_PAYMENT':
          stats.readyForPaymentPaymentStatus.count++;
          stats.readyForPaymentPaymentStatus.value += netTotal;
          break;
        case 'PARTIAL_PAYMENT':
          stats.partialPayment.count++;
          stats.partialPayment.value += netTotal; // Keep total for reference
          stats.partialPayment.outstanding += outstanding; // Accumulate outstanding amounts
          break;
        case 'FULL_PAYMENT':
          stats.fullPaymentPaymentStatus.count++;
          stats.fullPaymentPaymentStatus.value += netTotal;
          break;
      }
    });

    return stats;
  }, [orders]);

  // Default to customers section if no section is selected
  if (!section) {
    return (
      <div className="space-y-8 max-w-[1600px] mx-auto pb-10 px-4 sm:px-6 mt-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sales Overview</h1>
          <p className="text-slate-500 text-lg">Your central hub for managing customers, orders, and revenue.</p>
        </div>

        {/* Navigation Section */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <NavCard
              title="Customers"
              description="Manage your customer database, view profiles, and track interaction history."
              icon={<Users className="w-8 h-8" />}
              color="blue"
              onClick={() => onNavigateToSection('customers')}
            />
            <NavCard
              title="Orders"
              description="Track sales orders, manage deliveries, and monitor payment statuses."
              icon={<ShoppingBag className="w-8 h-8" />}
              color="purple"
              onClick={() => onNavigateToSection('orders')}
            />
          </div>
        </div>

        {/* Key Metrics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-slate-200 pt-8">

          {/* Order Pipeline Stats */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                <Package className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Order Pipeline</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatusCard
                title="Total Qty"
                count={deliveryCompletedStats.totalQuantity}
                label="Items Ordered"
                loading={loadingOrders}
                icon={<Package className="w-5 h-5" />}
                color="emerald"
                isQuantity
              />
              <StatusCard
                title="Completed"
                count={statusStats.orderCompleted.count}
                value={statusStats.orderCompleted.value}
                loading={loadingOrders}
                icon={<CheckCircle className="w-5 h-5" />}
                color="purple"
              />
            </div>
          </div>

          {/* Payment Overview Stats */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                <CreditCard className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Payment Overview</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatusCard
                title="Pending"
                count={statusStats.readyForPaymentPaymentStatus.count}
                value={statusStats.readyForPaymentPaymentStatus.value}
                loading={loadingOrders}
                icon={<Clock className="w-5 h-5" />}
                color="slate"
              />
              <StatusCard
                title="Partial"
                count={statusStats.partialPayment.count}
                value={statusStats.partialPayment.outstanding}
                loading={loadingOrders}
                icon={<Activity className="w-5 h-5" />}
                color="amber"
              />
              <StatusCard
                title="Total Received"
                count={statusStats.fullPaymentPaymentStatus.count}
                value={statusStats.totalPaidAcrossAllOrders}
                loading={loadingOrders}
                icon={<DollarSign className="w-5 h-5" />}
                color="blue"
              />
            </div>
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

function NavCard({
  title,
  description,
  icon,
  color,
  onClick
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: 'blue' | 'purple';
  onClick: () => void;
}) {
  const colorStyles = {
    blue: {
      bg: 'hover:bg-blue-50/50',
      border: 'hover:border-blue-200',
      iconBg: 'bg-blue-100 text-blue-600',
      title: 'group-hover:text-blue-700'
    },
    purple: {
      bg: 'hover:bg-purple-50/50',
      border: 'hover:border-purple-200',
      iconBg: 'bg-purple-100 text-purple-600',
      title: 'group-hover:text-purple-700'
    }
  };

  const styles = colorStyles[color];

  return (
    <div
      onClick={onClick}
      className={`
        group relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 
        cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md 
        ${styles.bg} ${styles.border}
      `}
    >
      <div className="flex items-start gap-5 relative z-10">
        <div className={`
          w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 
          transition-transform duration-300 group-hover:scale-110 shadow-sm
          ${styles.iconBg}
        `}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-xl font-bold text-slate-900 transition-colors ${styles.title}`}>
              {title}
            </h3>
            <ArrowRight className={`w-5 h-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 ${color === 'blue' ? 'group-hover:text-blue-400' : 'group-hover:text-purple-400'}`} />
          </div>
          <p className="text-slate-500 leading-relaxed text-sm">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  count,
  value,
  label,
  loading,
  color,
  icon,
  isQuantity = false
}: {
  title: string;
  count: number;
  value?: number;
  label?: string;
  loading: boolean;
  color: 'slate' | 'blue' | 'amber' | 'emerald' | 'purple';
  icon: React.ReactNode;
  isQuantity?: boolean;
}) {
  const styles = {
    slate: 'bg-white border-slate-200 text-slate-600',
    blue: 'bg-white border-blue-200 text-blue-600',
    amber: 'bg-white border-amber-200 text-amber-600',
    emerald: 'bg-white border-emerald-200 text-emerald-600',
    purple: 'bg-white border-purple-200 text-purple-600',
  };

  const iconBgStyles = {
    slate: 'bg-slate-50 text-slate-500',
    blue: 'bg-blue-50 text-blue-500',
    amber: 'bg-amber-50 text-amber-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    purple: 'bg-purple-50 text-purple-500',
  };

  return (
    <div className={`
      relative p-5 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-full
      ${styles[color]}
    `}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        </div>
        <div className={`p-2 rounded-lg ${iconBgStyles[color]}`}>
          {icon}
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
          {loading ? (
            <span className="inline-block w-16 h-8 bg-slate-100 animate-pulse rounded"></span>
          ) : (
            isQuantity ? count.toLocaleString('en-IN') : count
          )}
        </h3>

        {value !== undefined && (
          <p className="text-sm font-medium text-slate-500 mt-1">
            ₹{loading ? '...' : value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        )}

        {label && (
          <p className="text-xs text-slate-400 mt-1">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
