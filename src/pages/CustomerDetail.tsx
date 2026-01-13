import { useEffect, useState } from 'react';
import { ArrowLeft, Edit2, Building2, Phone, MapPin, FileText, IndianRupee, Calendar, Package, Eye, User } from 'lucide-react';
import { fetchCustomerWithStats, fetchOrdersByCustomer } from '../lib/sales';
import { CustomerForm } from '../components/CustomerForm';
import { updateCustomer } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import type { Customer, CustomerFormData, Order, OrderStatus } from '../types/sales';
import type { AccessLevel } from '../types/access';

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

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'READY_FOR_DELIVERY':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'PARTIALLY_DELIVERED':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'DELIVERY_COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'ORDER_COMPLETED':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Customers</span>
        </button>
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading customer...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Customers</span>
        </button>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">{error || 'Customer not found'}</p>
        </div>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Customers</span>
        </button>
        {hasWriteAccess && (
          <button
            onClick={() => setIsEditOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 className="w-5 h-5" />
            Edit Customer
          </button>
        )}
      </div>

      {/* Customer Profile Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Profile</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Customer Name</label>
              <p className="mt-1 text-lg font-semibold text-gray-900">{customer.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Customer Type</label>
              <p className="mt-1">
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
                  {customer.customer_type}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <p className="mt-1">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${
                    customer.status === 'Active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {customer.status}
                </span>
              </p>
            </div>
            {customer.contact_person && (
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Contact Person
                </label>
                <p className="mt-1 text-gray-900">{customer.contact_person}</p>
              </div>
            )}
            {customer.phone && (
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </label>
                <p className="mt-1 text-gray-900">{customer.phone}</p>
              </div>
            )}
            {customer.address && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </label>
                <p className="mt-1 text-gray-900">{customer.address}</p>
              </div>
            )}
            {customer.notes && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notes
                </label>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Total Sales Value</h3>
            <IndianRupee className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₹{stats.total_sales_value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Outstanding Amount</h3>
            <IndianRupee className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₹{stats.outstanding_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.order_count || 0}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Last Order Date</h3>
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {stats.last_order_date
              ? new Date(stats.last_order_date).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </p>
        </div>
      </div>

      {/* Orders Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Orders</h2>
        {ordersLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p>No orders found for this customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Order Number
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
                  {onViewOrder && (
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900 font-mono">{order.order_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}
                        >
                          {order.status}
                        </span>
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
                    {onViewOrder && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => onViewOrder(order.id)}
                          className="inline-flex items-center justify-center p-2 hover:bg-purple-100 rounded-lg transition-colors text-purple-600 hover:text-purple-700"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerForm
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleUpdate}
        customer={customer}
      />
    </div>
  );
}
