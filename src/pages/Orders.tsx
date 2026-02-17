import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, RefreshCw, Eye, Package, Calendar, User, Download, X, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { OrderForm } from '../components/OrderForm';
import { fetchOrdersExtended, createOrder } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import { exportOrders } from '../utils/excelExport';
import type { OrderExtended, OrderFormData, OrderStatus } from '../types/sales';
import type { AccessLevel } from '../types/access';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { AdvancedFilterPanel, FilterState, initialFilterState } from '../components/ui/AdvancedFilterPanel';

type SortField = 'order_number' | 'customer_name' | 'order_date' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc' | null;

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

  // Sort State
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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

      // Recalculate order status on client-side (until migration is applied)
      const ordersWithCorrectStatus = data.map(order => {
        const hasItems = (order.product_types?.length || 0) > 0;
        const netTotal = order.total_amount - (order.discount_amount || 0);
        const isFullPayment = (order.total_paid || 0) >= netTotal - 0.01 && netTotal > 0;

        let correctStatus: OrderStatus = order.status;
        if (order.is_on_hold) {
          correctStatus = 'HOLD';
        } else if (isFullPayment && !order.is_on_hold) {
          correctStatus = 'ORDER_COMPLETED';
        } else if (hasItems) {
          correctStatus = 'READY_FOR_PAYMENT';
        } else {
          correctStatus = 'ORDER_CREATED';
        }

        return {
          ...order,
          status: correctStatus
        };
      });

      setOrders(ordersWithCorrectStatus);
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
      const ordersToExport = filteredAndSortedOrders.length > 0 ? filteredAndSortedOrders : orders;
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
      onViewOrder(newOrder.id);
    } catch (error) {
      await loadOrders();
      throw error;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter((order) => {
      // Search filter
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
        if (!filters.deliveryStatus.includes(order.status)) return false;
      }

      // Lock Status
      if (filters.lockStatus.length > 0) {
        const isLocked = order.is_locked;
        const hasLockedMatch = filters.lockStatus.includes('LOCKED') && isLocked;
        const hasUnlockedMatch = filters.lockStatus.includes('UNLOCKED') && !isLocked;

        if (!hasLockedMatch && !hasUnlockedMatch) return false;
      }

      // Payment Status
      if (filters.paymentStatus.length > 0) {
        if (!order.payment_status || !filters.paymentStatus.includes(order.payment_status)) return false;
      }

      // Date Range
      if (filters.dateFrom && order.order_date < filters.dateFrom) return false;
      if (filters.dateTo && order.order_date > filters.dateTo) return false;

      // Customer Type
      if (filters.customerType.length > 0) {
        if (!order.customer_type || !filters.customerType.includes(order.customer_type)) return false;
      }

      // Product Type
      if (filters.productType.length > 0) {
        const hasMatch = order.product_tags?.some(tag => filters.productType.includes(tag));
        if (!hasMatch) return false;
      }

      // Payment Mode
      if (filters.paymentMode.length > 0) {
        const hasMatch = order.payment_modes?.some(mode => {
          if (filters.paymentMode.includes(mode)) return true;
          if (filters.paymentMode.includes('Bank') && (mode === 'Card' || mode === 'Cheque')) return true;
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

    // Apply sorting
    if (sortField && sortDirection) {
      result = [...result].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'order_number':
            aValue = a.order_number;
            bValue = b.order_number;
            break;
          case 'customer_name':
            aValue = (a.customer_name || '').toLowerCase();
            bValue = (b.customer_name || '').toLowerCase();
            break;
          case 'order_date':
            aValue = new Date(a.order_date).getTime();
            bValue = new Date(b.order_date).getTime();
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'amount':
            aValue = a.total_amount - (a.discount_amount || 0);
            bValue = b.total_amount - (b.discount_amount || 0);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [orders, filters, sortField, sortDirection]);

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value === 'all' || value === '') return false;
    return true;
  }).length;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
      : <ArrowDown className="w-3.5 h-3.5 text-slate-700" />;
  };

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <ModernCard className="text-center p-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-slate-500 mt-2">You do not have permission to view the sales module.</p>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20 px-4 sm:px-6 pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Orders</h1>
            <p className="text-sm text-slate-500 hidden sm:block">Manage and track your sales orders</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ModernButton
            onClick={() => void loadOrders()}
            variant="secondary"
            className="flex-1 sm:flex-none justify-center"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refesh
          </ModernButton>
          {hasWriteAccess && (
            <ModernButton
              onClick={() => setIsFormOpen(true)}
              variant="primary"
              className="flex-1 sm:flex-none justify-center bg-slate-900 hover:bg-slate-800 text-white border-none"
              icon={<Plus className="w-4 h-4" />}
            >
              New Order
            </ModernButton>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filters Area */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search orders..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all text-sm shadow-sm"
            />
          </div>
          <ModernButton
            onClick={handleExportExcel}
            disabled={exporting || orders.length === 0}
            variant="outline"
            size="sm"
            className="whitespace-nowrap w-full md:w-auto justify-center"
            icon={<Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />}
          >
            {exporting ? 'Exporting...' : 'Export Excel'}
          </ModernButton>
        </div>

        <AdvancedFilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(initialFilterState)}
          productTypes={uniqueProductTags}
          customerTypes={uniqueCustomerTypes}
          className="shadow-sm border-slate-200"
        />

        {/* Mobile Sort Selector - Positioned outside the results card */}
        <div className="md:hidden">
          <div className="relative">
            <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            <select
              value={sortField ? `${sortField}-${sortDirection}` : ''}
              onChange={(e) => {
                if (!e.target.value) {
                  setSortField(null);
                  setSortDirection(null);
                } else {
                  const [field, direction] = e.target.value.split('-') as [SortField, 'asc' | 'desc'];
                  setSortField(field);
                  setSortDirection(direction);
                }
              }}
              className="w-full pl-10 pr-10 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 appearance-none shadow-sm text-slate-700"
            >
              <option value="">Sort by...</option>
              <option value="order_date-desc">📅 Date (Newest First)</option>
              <option value="order_date-asc">📅 Date (Oldest First)</option>
              <option value="order_number-asc">🔢 Order # (A-Z)</option>
              <option value="order_number-desc">🔢 Order # (Z-A)</option>
              <option value="customer_name-asc">👤 Customer (A-Z)</option>
              <option value="customer_name-desc">👤 Customer (Z-A)</option>
              <option value="amount-desc">💰 Amount (High to Low)</option>
              <option value="amount-asc">💰 Amount (Low to High)</option>
              <option value="status-asc">📊 Status (A-Z)</option>
              <option value="status-desc">📊 Status (Z-A)</option>
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {sortField && (
              <button
                onClick={() => {
                  setSortField(null);
                  setSortDirection(null);
                }}
                className="absolute right-10 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 text-center">
            <div className="inline-block w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium text-sm">Loading orders...</p>
          </div>
        ) : filteredAndSortedOrders.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No orders found</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
              {filters.search || activeFiltersCount > 0
                ? 'Try adjusting your filters to find what you are looking for.'
                : 'Get started by creating a new sales order.'}
            </p>
            {filters.search || activeFiltersCount > 0 ? (
              <button
                onClick={() => setFilters(initialFilterState)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Clear all filters
              </button>
            ) : hasWriteAccess ? (
              <ModernButton
                onClick={() => setIsFormOpen(true)}
                variant="primary"
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-white border-none"
              >
                Create Order
              </ModernButton>
            ) : null}
          </div>
        ) : (
          <>
            {/* Results Count Bar */}
            <div className="px-4 sm:px-6 py-3 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {filteredAndSortedOrders.length} Orders
              </span>
              {sortField && (
                <button
                  onClick={() => {
                    setSortField(null);
                    setSortDirection(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear Sort
                </button>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleSort('order_number')}
                    >
                      <div className="flex items-center gap-2">
                        Order #
                        <SortIcon field="order_number" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleSort('customer_name')}
                    >
                      <div className="flex items-center gap-2">
                        Customer
                        <SortIcon field="customer_name" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleSort('order_date')}
                    >
                      <div className="flex items-center gap-2">
                        Date
                        <SortIcon field="order_date" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        <SortIcon field="status" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Amount
                        <SortIcon field="amount" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-900 font-mono tracking-tight">{order.order_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="max-w-[180px]">
                            <div className="text-sm font-medium text-slate-900 truncate">{order.customer_name || 'N/A'}</div>
                            {order.customer_type && <div className="text-xs text-slate-500 truncate">{order.customer_type}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadges order={order} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div>
                          <span className="text-sm font-bold text-slate-900">
                            ₹{(order.total_amount - (order.discount_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {(order.discount_amount || 0) > 0 && (
                            <div className="text-xs text-slate-400 line-through">
                              ₹{order.total_amount.toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => onViewOrder(order.id)}
                          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredAndSortedOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => onViewOrder(order.id)}
                  className="p-4 active:bg-slate-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-sm font-bold text-slate-900 font-mono">{order.order_number}</span>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">
                        ₹{(order.total_amount - (order.discount_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${(order.total_amount - (order.discount_amount || 0)) === 0 ? 'text-red-500' :
                        order.payment_status === 'FULL_PAYMENT' ? 'text-emerald-600' :
                          order.payment_status === 'PARTIAL_PAYMENT' ? 'text-amber-600' :
                            'text-slate-400'
                        }`}>
                        {(order.total_amount - (order.discount_amount || 0)) === 0 ? 'Needs Items' : (order.payment_status?.replace(/_/g, ' ') || 'Pending')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{order.customer_name}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadges order={order} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <OrderForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}

// Logic extracted and simplified for badges
function StatusBadges({ order }: { order: OrderExtended }) {
  const badges: JSX.Element[] = [];
  const netTotal = order.total_amount - (order.discount_amount || 0);

  // 1. Primary Status Badge
  if (order.status === 'ORDER_CREATED') {
    badges.push(<Badge key="created" color="slate" label="Order Created" icon={<FileText className="w-3 h-3" />} />);
  } else if (order.status === 'HOLD') {
    badges.push(<Badge key="hold" color="amber" label="On Hold" />);
  } else if (order.status === 'ORDER_COMPLETED') {
    badges.push(<Badge key="completed" color="purple" label="Completed" />);
  } else if (order.status === 'READY_FOR_PAYMENT' || order.payment_status === 'READY_FOR_PAYMENT') {
    // If it's ready for payment but NO payment is made yet
    if (order.payment_status === 'READY_FOR_PAYMENT' || !order.payment_status) {
      if (netTotal === 0) {
        badges.push(<Badge key="needs-items" color="red" label="Needs Items" />);
      } else {
        badges.push(<Badge key="ready" color="blue" label="Ready to Pay" />);
      }
    }
  }

  // 2. Payment Status Badge (only if partially or fully paid)
  if (order.payment_status === 'PARTIAL_PAYMENT') {
    badges.push(<Badge key="partial" color="amber" label="Partial Pay" />);
  } else if (order.payment_status === 'FULL_PAYMENT') {
    // If completed, we already show that. If not completed but paid, show paid.
    if (order.status !== 'ORDER_COMPLETED') {
      badges.push(<Badge key="paid" color="emerald" label="Paid" />);
    }
  }

  // 3. Locked Badge
  if (order.is_locked) {
    badges.push(<Badge key="locked" color="emerald" label="Locked" />);
  }

  // Fallback if no badges
  if (badges.length === 0) {
    badges.push(<Badge key="unknown" color="slate" label={order.status} />);
  }

  return <div className="flex flex-wrap gap-1.5">{badges}</div>;
}

function Badge({ color, label, icon }: { color: 'slate' | 'blue' | 'emerald' | 'amber' | 'purple' | 'red', label: string, icon?: React.ReactNode }) {
  const styles = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`
            px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full border
            ${styles[color]} flex items-center gap-1
        `}>
      {icon}
      {label}
    </span>
  );
}
