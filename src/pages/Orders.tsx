import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, RefreshCw, Eye, Package, Calendar, User, Download, Filter } from 'lucide-react';
import { OrderForm } from '../components/OrderForm';
import { fetchOrders, createOrder, getOrderPaymentStatus } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { exportOrders } from '../utils/excelExport';
import type { Order, OrderFormData, OrderStatus, PaymentStatus } from '../types/sales';
import type { AccessLevel } from '../types/access';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { FilterPanel } from '../components/ui/FilterPanel';

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
  const [exporting, setExporting] = useState(false);

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
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load orders';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      // Export filtered orders (or all orders if no filters)
      const ordersToExport = filteredOrders.length > 0 ? filteredOrders : orders;
      exportOrders(ordersToExport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export orders');
    } finally {
      setExporting(false);
    }
  };

  const handleCreate = async (orderData: OrderFormData) => {
    try {
      const newOrder = await createOrder(orderData, { currentUserId: user?.id });
      // Navigate directly to the newly created order details page
      onViewOrder(newOrder.id);
    } catch (error) {
      // If order creation fails, reload the list to show current state
      await loadOrders();
      throw error; // Re-throw to let the form handle the error
    }
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
        return { label: 'Ready', className: 'bg-blue-50 text-blue-700 border border-blue-200' };
      case 'PARTIALLY_DELIVERED':
        return { label: 'Partial', className: 'bg-amber-50 text-amber-700 border border-amber-200' };
      case 'DELIVERY_COMPLETED':
        return { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
      case 'ORDER_COMPLETED':
        return { label: 'Completed', className: 'bg-purple-50 text-purple-700 border border-purple-200' };
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

  const activeFiltersCount = [
    filterDeliveryStatus !== 'all',
    filterPaymentStatus !== 'all',
    filterFinalStatus !== 'all',
    dateFrom,
    dateTo
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilterDeliveryStatus('all');
    setFilterPaymentStatus('all');
    setFilterFinalStatus('all');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
  };

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <ModernCard className="text-center p-8">
          <h1 className="text-2xl font-semibold text-gray-900">Sales module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 hover:bg-white bg-gray-50 rounded-xl border border-gray-200 transition-all hover:shadow-sm group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Orders</h1>
            <p className="text-sm text-gray-500 font-medium">Manage sales orders and deliveries</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ModernButton
            onClick={() => void loadOrders()}
            variant="secondary"
            className="flex-1 sm:flex-none justify-center"
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </ModernButton>
          {hasWriteAccess && (
            <ModernButton
              onClick={() => setIsFormOpen(true)}
              variant="primary"
              className="flex-1 sm:flex-none justify-center bg-gradient-to-r from-purple-600 to-purple-700 border-none"
              icon={<Plus className="w-4 h-4" />}
            >
              New Order
            </ModernButton>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4">
        {/* Search Bar - Full Width */}
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by order number, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm bg-white shadow-sm hover:border-purple-200"
          />
        </div>

        <FilterPanel 
          activeFiltersCount={activeFiltersCount} 
          onClearAll={handleClearFilters}
          className="shadow-sm"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Delivery Status</label>
            <select
              value={filterDeliveryStatus}
              onChange={(e) => setFilterDeliveryStatus(e.target.value as DeliveryStatusFilter)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm bg-gray-50/50 hover:bg-white"
            >
              <option value="all">All Delivery</option>
              <option value="DRAFT">Draft</option>
              <option value="READY_FOR_DELIVERY">Ready</option>
              <option value="PARTIALLY_DELIVERED">Partial</option>
              <option value="DELIVERY_COMPLETED">Completed</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Payment Status</label>
            <select
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value as PaymentStatusFilter)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm bg-gray-50/50 hover:bg-white"
            >
              <option value="all">All Payment</option>
              <option value="READY_FOR_PAYMENT">Ready</option>
              <option value="PARTIAL_PAYMENT">Partial</option>
              <option value="FULL_PAYMENT">Full</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Order Status</label>
            <select
              value={filterFinalStatus}
              onChange={(e) => setFilterFinalStatus(e.target.value as FinalStatusFilter)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm bg-gray-50/50 hover:bg-white"
            >
              <option value="all">All Status</option>
              <option value="ORDER_COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all bg-gray-50/50 hover:bg-white"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all bg-gray-50/50 hover:bg-white"
              />
            </div>
          </div>
        </FilterPanel>
        
        <div className="flex justify-end">
          <ModernButton
            onClick={handleExportExcel}
            disabled={exporting || orders.length === 0}
            variant="outline"
            size="sm"
            icon={<Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />}
          >
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </ModernButton>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <ModernCard className="p-12 text-center">
          <div className="inline-block w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500 font-medium">Loading orders...</p>
        </ModernCard>
      ) : filteredOrders.length === 0 ? (
        <ModernCard className="p-16 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {searchTerm || activeFiltersCount > 0
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Create your first order to get started with sales management.'}
          </p>
          {(searchTerm || activeFiltersCount > 0) && (
            <button
              onClick={handleClearFilters}
              className="mt-6 text-purple-600 font-medium hover:text-purple-700 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </ModernCard>
      ) : (
        <ModernCard padding="none" className="overflow-hidden border border-gray-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Order Number
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
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
                    <tr key={order.id} className="hover:bg-purple-50/30 transition-colors group">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 font-mono group-hover:text-purple-600 transition-colors">{order.order_number}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                            <User className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{order.customer_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex flex-col gap-2 items-start">
                          {showOnlyOneBadge ? (
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-sm ${deliveryBadge.className}`}>
                              {deliveryBadge.label}
                            </span>
                          ) : (
                            <>
                              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-sm ${deliveryBadge.className}`}>
                                {deliveryBadge.label}
                              </span>
                              {order.status !== 'CANCELLED' && (
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-sm ${paymentBadge.className}`}>
                                  {paymentBadge.label}
                                </span>
                              )}
                            </>
                          )}
                          {order.is_locked && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <div className="text-sm font-bold text-gray-900">
                          ₹{(order.total_amount - (order.discount_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {(order.discount_amount || 0) > 0 && (
                          <div className="text-xs text-gray-500 line-through">
                            ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <button
                          onClick={() => onViewOrder(order.id)}
                          className="inline-flex items-center justify-center p-2 hover:bg-purple-50 rounded-lg transition-colors text-gray-400 hover:text-purple-600"
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
        </ModernCard>
      )}

      <OrderForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
