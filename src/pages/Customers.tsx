import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Search, RefreshCw, Eye, Building2, Phone, MapPin, Download } from 'lucide-react';
import { CustomerForm } from '../components/CustomerForm';
import { fetchCustomers, createCustomer, updateCustomer } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import { exportCustomers } from '../utils/excelExport';
import type { Customer, CustomerFormData } from '../types/sales';
import type { AccessLevel } from '../types/access';

interface CustomersProps {
  onBack: () => void;
  onViewCustomer: (customerId: string) => void;
  accessLevel: AccessLevel;
}

export function Customers({ onBack, onViewCustomer, accessLevel }: CustomersProps) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [filterType, setFilterType] = useState<'all' | Customer['customer_type']>('all');
  const [exporting, setExporting] = useState(false);

  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    void loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load customers';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (customerData: CustomerFormData) => {
    await createCustomer(customerData, { currentUserId: user?.id });
    await loadCustomers();
  };

  const handleUpdate = async (customerData: CustomerFormData) => {
    if (!editingCustomer) return;
    await updateCustomer(editingCustomer.id, customerData, { currentUserId: user?.id });
    await loadCustomers();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

  const filteredCustomers = useMemo(() => {
    let filtered = [...customers];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.contact_person?.toLowerCase().includes(term) ||
          c.phone?.toLowerCase().includes(term) ||
          c.address?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((c) => c.status === filterStatus);
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((c) => c.customer_type === filterType);
    }

    return filtered;
  }, [customers, searchTerm, filterStatus, filterType]);

  const handleExportExcel = () => {
    try {
      setExporting(true);
      // Export filtered customers (or all customers if no filters)
      const customersToExport = filteredCustomers.length > 0 ? filteredCustomers : customers;
      exportCustomers(customersToExport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export customers');
    } finally {
      setExporting(false);
    }
  };

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Sales module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your customer database</p>
        </div>
        {hasWriteAccess && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Customer
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customers by name, contact, phone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="Hotel">Hotel</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Retail">Retail</option>
              <option value="Direct">Direct</option>
              <option value="Other">Other</option>
            </select>
            <button
              onClick={() => void loadCustomers()}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting || customers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export to Excel"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Customers List */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading customers...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm || filterStatus !== 'all' || filterType !== 'all'
              ? 'No customers match your filters.'
              : 'No customers found. Create your first customer to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{customer.name}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        customer.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {customer.status}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      {customer.customer_type}
                    </span>
                  </div>
                </div>
                {hasWriteAccess && (
                  <button
                    onClick={() => handleEdit(customer)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit customer"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                {customer.contact_person && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span>{customer.contact_person}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => onViewCustomer(customer.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomerForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={editingCustomer ? handleUpdate : handleCreate}
        customer={editingCustomer}
      />
    </div>
  );
}
