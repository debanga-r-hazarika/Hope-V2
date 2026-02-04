import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, RefreshCw, Eye, Package, Calendar, User, Download } from 'lucide-react';
import { OrderForm } from '../components/OrderForm';
import { fetchOrdersExtended, createOrder } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import { exportOrders } from '../utils/excelExport';
import type { OrderExtended, OrderFormData, OrderStatus, PaymentStatus } from '../types/sales';
import type { AccessLevel } from '../types/access';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { AdvancedFilterPanel, FilterState, initialFilterState } from '../components/ui/AdvancedFilterPanel';

interface OrdersProps {
  onBack: () => void;
  onViewOrder: (orderId: string) => void;
  accessLevel: AccessLevel;
}

export function Orders({ onBack, onViewOrder, accessLevel }: OrdersProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderExtended[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Advanced Filter State
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [exporting, setExporting] = useState(false);

  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    void loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the extended fetch function that gets all necessary data for filtering
      const data = await fetchOrdersExtended();
      setOrders(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load orders';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Derive unique values for filter dropdowns
  const uniqueProductTags = useMemo(() => {
    const tags = new Set<string>();
    orders.forEach(o => o.product_tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [orders]);

  const uniqueCustomerTypes = useMemo(() => {
    const types = new Set<string>();
    orders.forEach(o => {
      if (o.customer_type) types.add(o.customer_type);
    });
    return Array.from(types).sort();
  }, [orders]);

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
    return orders.filter((order) => {
      // Search filter (Order Number, Customer Name/ID)
      if (filters.search.trim()) {
        const term = filters.search.toLowerCase();
        const matchesSearch = 
          order.order_number.toLowerCase().includes(term) ||
          order.customer_name?.toLowerCase().includes(term) ||
          order.customer_id.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // Delivery Status
      if (filters.deliveryStatus.length > 0) {
        let match = false;
        // Check exact match
        if (filters.deliveryStatus.includes(order.status)) match = true;
        // Special case: DELIVERY_COMPLETED should also include ORDER_COMPLETED
        if (filters.deliveryStatus.includes('DELIVERY_COMPLETED') && order.status === 'ORDER_COMPLETED') match = true;
        
        if (!match) return false;
      }

      // Payment Status
      if (filters.paymentStatus.length > 0) {
        if (!order.payment_status || !filters.paymentStatus.includes(order.payment_status)) return false;
      }

      // Order State (Completed/Cancelled)
      if (filters.orderStatus.length > 0) {
        if (!filters.orderStatus.includes(order.status)) return false;
      }

      // Date Range
      if (filters.dateFrom && order.order_date < filters.dateFrom) return false;
      if (filters.dateTo && order.order_date > filters.dateTo) return false;

      // Customer Type
      if (filters.customerType.length > 0) {
        if (!order.customer_type || !filters.customerType.includes(order.customer_type)) return false;
      }

      // Product Type (Contains product)
      if (filters.productType.length > 0) {
        // Check if any of the order's product tags match any of the selected filters
        const hasMatch = order.product_tags?.some(tag => filters.productType.includes(tag));
        if (!hasMatch) return false;
      }

      // Payment Mode
      if (filters.paymentMode.length > 0) {
        const hasMatch = order.payment_modes?.some(mode => {
          // Direct match
          if (filters.paymentMode.includes(mode)) return true;
          // Group match (Bank includes Card/Cheque)
          if (filters.paymentMode.includes('Bank') && (mode === 'Card' || mode === 'Cheque')) return true;
          // Case insensitive match
          return filters.paymentMode.some(f => f.toLowerCase() === mode.toLowerCase());
        });
        if (!hasMatch) return false;
      }

      // Amount Range
      const netAmount = order.total_amount - (order.discount_amount || 0);
      if (filters.minAmount && netAmount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && netAmount > parseFloat(filters.maxAmount)) return false;

      return true;
    });
  }, [orders, filters]);

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

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value === 'all' || value === '') return false;
    return true;
  }).length;

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
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm bg-white shadow-sm hover:border-purple-200"
          />
        </div>

        <AdvancedFilterPanel 
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(initialFilterState)}
          productTypes={uniqueProductTags}
          customerTypes={uniqueCustomerTypes}
          className="shadow-sm"
        />
        
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
            {filters.search || activeFiltersCount > 0
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Create your first order to get started with sales management.'}
          </p>
          {(filters.search || activeFiltersCount > 0) && (
            <button
              onClick={() => setFilters(initialFilterState)}
              className="mt-6 text-purple-600 font-medium hover:text-purple-700 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </ModernCard>
      ) : (
        <>
          {/* Results Count */}
          <div className="text-sm text-gray-500 font-medium px-1">
            Showing <span className="text-gray-900 font-bold">{filteredOrders.length}</span> of <span className="text-gray-900 font-bold">{orders.length}</span> entries
          </div>

          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredOrders.map((order) => {
              const deliveryBadge = getDeliveryStatusBadge(order.status);
              const paymentBadge = getPaymentStatusBadge(order.payment_status);
              const showOnlyOneBadge = order.status === 'ORDER_COMPLETED';

              return (
                <div 
                  key={order.id} 
                  onClick={() => onViewOrder(order.id)}
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm active:scale-[0.99] transition-transform"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-sm font-bold text-gray-900 font-mono">{order.order_number}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">
                        ₹{(order.total_amount - (order.discount_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {(order.discount_amount || 0) > 0 && (
                        <div className="text-xs text-gray-500 line-through">
                          ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">{order.customer_name || 'N/A'}</div>
                      {order.customer_type && (
                        <div className="text-xs text-gray-500">{order.customer_type}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {showOnlyOneBadge ? (
                      <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${deliveryBadge.className}`}>
                        {deliveryBadge.label}
                      </span>
                    ) : (
                      <>
                        <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${deliveryBadge.className}`}>
                          {deliveryBadge.label}
                        </span>
                        {order.status !== 'CANCELLED' && (
                          <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${paymentBadge.className}`}>
                            {paymentBadge.label}
                          </span>
                        )}
                      </>
                    )}
                    {order.is_locked && (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Table */}
          <ModernCard padding="none" className="hidden md:block overflow-hidden border border-gray-200 shadow-sm">
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
                            <div>
                              <div className="text-sm font-medium text-gray-900">{order.customer_name || 'N/A'}</div>
                              {order.customer_type && (
                                <div className="text-xs text-gray-500">{order.customer_type}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5 items-start">
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
        </>
      )}

      <OrderForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
