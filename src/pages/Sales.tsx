import { useEffect, useState, useMemo } from 'react';
import { Customers } from './Customers';
import { CustomerDetail } from './CustomerDetail';
import { Orders } from './Orders';
import { OrderDetail } from './OrderDetail';
import { Package } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import { fetchOrders } from '../lib/sales';
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

  useEffect(() => {
    if (!section) {
      void loadOrders();
    }
  }, [section]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const completedOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'Completed').length;
  }, [orders]);

  const fullyDeliveredCount = useMemo(() => {
    return orders.filter(o => o.status === 'Fully Delivered').length;
  }, [orders]);

  const inProgressCount = useMemo(() => {
    return orders.filter(o => o.status === 'Confirmed' || o.status === 'Partially Delivered').length;
  }, [orders]);

  // Default to customers section if no section is selected
  if (!section) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales, Orders & Customer Realisation</h1>
          <p className="mt-2 text-gray-600">Manage customers and orders</p>
        </div>

        {/* Order Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Completed Orders</p>
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-900">
              {loadingOrders ? '...' : completedOrdersCount}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Orders</p>
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">
              {loadingOrders ? '...' : orders.length}
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Fully Delivered</p>
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-emerald-900">
              {loadingOrders ? '...' : fullyDeliveredCount}
            </p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">In Progress</p>
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-amber-900">
              {loadingOrders ? '...' : inProgressCount}
            </p>
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
