import { useEffect, useState } from 'react';
import { ArrowLeft, Edit2, Building2, Phone, MapPin, FileText, IndianRupee, Calendar, Package, Eye, User, Camera } from 'lucide-react';
import { fetchCustomerWithStats, fetchOrdersByCustomer } from '../lib/sales';
import { CustomerForm } from '../components/CustomerForm';
import { updateCustomer } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import type { Customer, CustomerFormData, Order, OrderStatus } from '../types/sales';
import type { AccessLevel } from '../types/access';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

interface CustomerDetailProps {
  customerId: string;
  onBack: () => void;
  onViewOrder?: (orderId: string) => void;
  accessLevel: AccessLevel;
}

export function CustomerDetail({ customerId, onBack, onViewOrder, accessLevel }: CustomerDetailProps) {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    void loadCustomer();
    void loadOrders();
  }, [customerId]);

  const loadCustomer = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerWithStats(customerId);
      if (!data) {
        setError('Customer not found');
        return;
      }
      setCustomer(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load customer';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await fetchOrdersByCustomer(customerId);
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleUpdate = async (customerData: CustomerFormData) => {
    if (!customer) return;
    await updateCustomer(customer.id, customerData, { currentUserId: user?.id });
    await loadCustomer();
    setIsEditOpen(false);
  };

  const handleViewPhoto = () => {
    if (customer?.photo_url) {
      window.open(customer.photo_url, '_blank');
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
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

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
        <ModernButton
          onClick={onBack}
          variant="ghost"
          className="pl-0 text-gray-600 hover:text-gray-900 hover:bg-transparent"
          icon={<ArrowLeft className="w-5 h-5" />}
        >
          Back to Customers
        </ModernButton>
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading customer...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
        <ModernButton
          onClick={onBack}
          variant="ghost"
          className="pl-0 text-gray-600 hover:text-gray-900 hover:bg-transparent"
          icon={<ArrowLeft className="w-5 h-5" />}
        >
          Back to Customers
        </ModernButton>
        <ModernCard className="text-center p-12">
          <p className="text-gray-600">{error || 'Customer not found'}</p>
        </ModernCard>
      </div>
    );
  }

  const stats = customer as typeof customer & {
    total_sales_value?: number;
    outstanding_amount?: number;
    last_order_date?: string;
    order_count?: number;
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <ModernButton
          onClick={onBack}
          variant="secondary"
          className="group"
          icon={<ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />}
        >
          Back
        </ModernButton>
        {hasWriteAccess && (
          <ModernButton
            onClick={() => setIsEditOpen(true)}
            variant="primary"
            icon={<Edit2 className="w-4 h-4" />}
          >
            Edit Customer
          </ModernButton>
        )}
      </div>

      {/* Customer Profile Card */}
      <ModernCard className="overflow-hidden">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Column: Photo & Name */}
          <div className="flex flex-col items-center md:items-start space-y-4">
             {customer.photo_url ? (
              <div className="relative group">
                <div className="w-40 h-40 rounded-2xl border-4 border-gray-100 shadow-lg overflow-hidden">
                  <img
                    src={customer.photo_url}
                    alt={`${customer.name} photo`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <button
                   onClick={handleViewPhoto}
                   className="absolute bottom-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                   title="View Photo"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-40 h-40 rounded-2xl border-4 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <Camera className="w-10 h-10 mb-2" />
                <span className="text-xs">No photo</span>
              </div>
            )}
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{customer.name}</h2>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                 <span
                  className={`px-3 py-1 text-xs font-bold rounded-full border shadow-sm ${
                    customer.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                >
                  {customer.status}
                </span>
                <span
                  className="px-3 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-100 shadow-sm"
                  title={customer.customer_type}
                >
                  {customer.customer_type}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-2">
             {customer.contact_person && (
              <div className="group">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Contact Person
                </label>
                <p className="text-base font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{customer.contact_person}</p>
              </div>
            )}
            {customer.phone && (
              <div className="group">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Phone Number
                </label>
                <p className="text-base font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{customer.phone}</p>
              </div>
            )}
            {customer.address && (
              <div className="md:col-span-2 group">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Address
                </label>
                <p className="text-base font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{customer.address}</p>
              </div>
            )}
            {customer.notes && (
              <div className="md:col-span-2 group">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Notes
                </label>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </ModernCard>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModernCard padding="md" className="border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Sales</h3>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-tight">
            ₹{stats.total_sales_value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </ModernCard>

        <ModernCard padding="md" className="border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Outstanding</h3>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-tight">
            ₹{stats.outstanding_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </ModernCard>

        <ModernCard padding="md" className="border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Orders</h3>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-tight">{stats.order_count || 0}</p>
        </ModernCard>

        <ModernCard padding="md" className="border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last Order</h3>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-gray-900 tracking-tight">
            {stats.last_order_date
              ? new Date(stats.last_order_date).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </p>
        </ModernCard>
      </div>

      {/* Orders Section */}
      <ModernCard className="overflow-hidden p-0" padding="none">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-400" />
            Order History
          </h2>
        </div>
        {ordersLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="font-medium">No orders found for this customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Order Number
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
                  {onViewOrder && (
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {orders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-purple-50/30 transition-colors group">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 font-mono group-hover:text-purple-600 transition-colors">{order.order_number}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-sm ${badge.className}`}
                          >
                            {badge.label}
                          </span>
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
                      {onViewOrder && (
                        <td className="px-6 py-5 whitespace-nowrap text-right">
                          <ModernButton
                            onClick={() => onViewOrder(order.id)}
                            variant="ghost"
                            className="p-2 hover:bg-purple-50 hover:text-purple-600 text-gray-400"
                            title="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </ModernButton>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ModernCard>

      <CustomerForm
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleUpdate}
        customer={customer}
      />
    </div>
  );
}
