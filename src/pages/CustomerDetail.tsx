import { useEffect, useState } from 'react';
import { ArrowLeft, Edit2, Building2, Phone, MapPin, FileText, DollarSign, Calendar, Package } from 'lucide-react';
import { fetchCustomerWithStats } from '../lib/sales';
import { CustomerForm } from '../components/CustomerForm';
import { updateCustomer } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import type { Customer, CustomerFormData } from '../types/sales';
import type { AccessLevel } from '../types/access';

interface CustomerDetailProps {
  customerId: string;
  onBack: () => void;
  accessLevel: AccessLevel;
}

export function CustomerDetail({ customerId, onBack, accessLevel }: CustomerDetailProps) {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    void loadCustomer();
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

  const handleUpdate = async (customerData: CustomerFormData) => {
    if (!customer) return;
    await updateCustomer(customer.id, customerData, { currentUserId: user?.id });
    await loadCustomer();
    setIsEditOpen(false);
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
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₹{stats.total_sales_value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Outstanding Amount</h3>
            <DollarSign className="w-5 h-5 text-orange-600" />
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
        <div className="text-center py-12 text-gray-500">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p>Orders will be displayed here once the Orders section is implemented.</p>
          <p className="text-sm mt-2">This customer will be linked to orders in the next phase.</p>
        </div>
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
