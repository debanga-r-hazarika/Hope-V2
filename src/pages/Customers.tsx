import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Search, RefreshCw, Eye, Building2, Phone, MapPin, Download, Camera, Filter, TrendingUp } from 'lucide-react';
import { CustomerForm } from '../components/CustomerForm';
import { fetchAllCustomersWithStats, createCustomer, updateCustomer } from '../lib/sales';
import { fetchCustomerTypes } from '../lib/customer-types';
import { useAuth } from '../contexts/AuthContext';
import { exportCustomers } from '../utils/excelExport';
import type { Customer, CustomerFormData, CustomerWithStats } from '../types/sales';
import type { AccessLevel } from '../types/access';
import type { CustomerType } from '../types/customer-types';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { FilterPanel } from '../components/ui/FilterPanel';
import { MultiSelect } from '../components/ui/MultiSelect';

interface CustomersProps {
  onBack: () => void;
  onViewCustomer: (customerId: string) => void;
  accessLevel: AccessLevel;
}

export function Customers({ onBack, onViewCustomer, accessLevel }: CustomersProps) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [minOrders, setMinOrders] = useState<number | ''>('');
  const [minSpent, setMinSpent] = useState<number | ''>('');
  const [showOutstandingOnly, setShowOutstandingOnly] = useState(false);
  const [lastOrderDateStart, setLastOrderDateStart] = useState('');
  const [lastOrderDateEnd, setLastOrderDateEnd] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'spent' | 'outstanding' | 'recent'>('name');

  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    void loadCustomers();
    void loadCustomerTypes();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllCustomersWithStats();
      setCustomers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load customers';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerTypes = async () => {
    setLoadingTypes(true);
    try {
      const types = await fetchCustomerTypes(false); // Only active types
      setCustomerTypes(types);
    } catch (err) {
      console.error('Failed to load customer types:', err);
    } finally {
      setLoadingTypes(false);
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
    if (filterStatus.length > 0) {
      filtered = filtered.filter((c) => filterStatus.includes(c.status));
    }

    // Type filter
    if (filterType.length > 0) {
      filtered = filtered.filter((c) => filterType.includes(c.customer_type));
    }

    // New filters
    if (minOrders !== '') {
      filtered = filtered.filter(c => (c.order_count || 0) >= Number(minOrders));
    }
    
    if (minSpent !== '') {
      filtered = filtered.filter(c => (c.total_sales_value || 0) >= Number(minSpent));
    }
    
    if (showOutstandingOnly) {
      filtered = filtered.filter(c => (c.outstanding_amount || 0) > 0);
    }
    
    if (lastOrderDateStart) {
      filtered = filtered.filter(c => c.last_order_date && c.last_order_date >= lastOrderDateStart);
    }
    
    if (lastOrderDateEnd) {
      filtered = filtered.filter(c => c.last_order_date && c.last_order_date <= lastOrderDateEnd);
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'spent':
          return (b.total_sales_value || 0) - (a.total_sales_value || 0);
        case 'outstanding':
          return (b.outstanding_amount || 0) - (a.outstanding_amount || 0);
        case 'recent':
          // Sort by last order date, handling undefined
          const dateA = a.last_order_date ? new Date(a.last_order_date).getTime() : 0;
          const dateB = b.last_order_date ? new Date(b.last_order_date).getTime() : 0;
          return dateB - dateA;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [customers, searchTerm, filterStatus, filterType, minOrders, minSpent, showOutstandingOnly, lastOrderDateStart, lastOrderDateEnd, sortBy]);

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

  const activeFiltersCount = [
    filterStatus.length > 0,
    filterType.length > 0,
    minOrders !== '',
    minSpent !== '',
    showOutstandingOnly,
    lastOrderDateStart !== '',
    lastOrderDateEnd !== ''
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilterStatus([]);
    setFilterType([]);
    setSearchTerm('');
    setMinOrders('');
    setMinSpent('');
    setShowOutstandingOnly(false);
    setLastOrderDateStart('');
    setLastOrderDateEnd('');
    setSortBy('name');
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 hover:bg-white bg-gray-50 rounded-xl border border-gray-200 transition-all hover:shadow-sm group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customers</h1>
            <p className="text-sm text-gray-500 font-medium">Manage your customer database</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ModernButton
            onClick={() => void loadCustomers()}
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
              className="flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-700 border-none"
              icon={<Plus className="w-4 h-4" />}
            >
              Add Customer
            </ModernButton>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* Filters and Search */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search customers by name, contact, phone, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-white shadow-sm hover:border-blue-200"
          />
        </div>

        <FilterPanel 
          activeFiltersCount={activeFiltersCount} 
          onClearAll={handleClearFilters}
          className="shadow-sm"
        >
          <div className="space-y-1.5">
            <MultiSelect
              label="Status"
              selected={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              placeholder="All Status"
            />
          </div>
          
          <div className="space-y-1.5">
            {loadingTypes ? (
              <div className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm">
                Loading types...
              </div>
            ) : (
              <MultiSelect
                label="Customer Type"
                selected={filterType}
                onChange={setFilterType}
                options={customerTypes.map((type) => ({
                  value: type.display_name,
                  label: type.display_name
                }))}
                placeholder="All Types"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-gray-50/50 hover:bg-white"
            >
              <option value="name">Name (A-Z)</option>
              <option value="spent">Total Spent (High-Low)</option>
              <option value="outstanding">Outstanding (High-Low)</option>
              <option value="recent">Last Order (Newest)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Min Orders</label>
            <input
              type="number"
              placeholder="0"
              value={minOrders}
              onChange={(e) => setMinOrders(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-gray-50/50 hover:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Min Spent (₹)</label>
            <input
              type="number"
              placeholder="0"
              value={minSpent}
              onChange={(e) => setMinSpent(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-gray-50/50 hover:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Last Order From</label>
            <input
              type="date"
              value={lastOrderDateStart}
              onChange={(e) => setLastOrderDateStart(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-gray-50/50 hover:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Last Order To</label>
            <input
              type="date"
              value={lastOrderDateEnd}
              onChange={(e) => setLastOrderDateEnd(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-gray-50/50 hover:bg-white"
            />
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 font-medium hover:text-gray-900 select-none">
              <input
                type="checkbox"
                checked={showOutstandingOnly}
                onChange={(e) => setShowOutstandingOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Has Outstanding
            </label>
          </div>
        </FilterPanel>

        <div className="flex justify-end">
          <ModernButton
            onClick={handleExportExcel}
            disabled={exporting || customers.length === 0}
            variant="outline"
            size="sm"
            icon={<Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />}
          >
            {exporting ? 'Exporting...' : 'Export Excel'}
          </ModernButton>
        </div>
      </div>

      {/* Customers List */}
      {loading ? (
        <ModernCard className="p-12 text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500 font-medium">Loading customers...</p>
        </ModernCard>
      ) : filteredCustomers.length === 0 ? (
        <ModernCard className="p-16 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm || filterStatus.length > 0 || filterType.length > 0
              ? 'No customers match your filters.'
              : 'No customers found. Create your first customer to get started.'}
          </p>
          {(searchTerm || activeFiltersCount > 0) && (
            <button
              onClick={handleClearFilters}
              className="mt-6 text-blue-600 font-medium hover:text-blue-700 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </ModernCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
            <ModernCard
              key={customer.id}
              className="hover:border-blue-200 transition-all duration-300 group"
              padding="md"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  {customer.photo_url ? (
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <img
                          src={customer.photo_url}
                          alt={`${customer.name} photo`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 rounded-xl border border-gray-100 shadow-sm flex items-center justify-center bg-gray-50 group-hover:bg-blue-50 transition-colors">
                        <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 truncate group-hover:text-blue-700 transition-colors">{customer.name}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-full border shadow-sm ${
                        customer.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {customer.status}
                    </span>
                    <span
                      className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-100 max-w-[120px] truncate shadow-sm"
                      title={customer.customer_type}
                    >
                      {customer.customer_type}
                    </span>
                  </div>
                  </div>
                </div>
                {hasWriteAccess && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(customer);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                    title="Edit customer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3 text-sm text-gray-600 mb-5">
                {customer.contact_person && (
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{customer.contact_person}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-gray-50/80 rounded-lg">
                 <div>
                   <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Spent</p>
                   <p className="text-sm font-bold text-gray-900 mt-0.5">₹{(customer.total_sales_value || 0).toLocaleString('en-IN')}</p>
                 </div>
                 <div>
                   <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding</p>
                   <p className={`text-sm font-bold mt-0.5 ${customer.outstanding_amount && customer.outstanding_amount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                     ₹{(customer.outstanding_amount || 0).toLocaleString('en-IN')}
                   </p>
                 </div>
                 <div>
                   <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Orders</p>
                   <p className="text-sm font-medium text-gray-900 mt-0.5">{customer.order_count || 0}</p>
                 </div>
                 <div>
                   <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Last Order</p>
                   <p className="text-sm font-medium text-gray-900 mt-0.5">
                     {customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString('en-IN') : '-'}
                   </p>
                 </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <ModernButton
                  onClick={() => onViewCustomer(customer.id)}
                  variant="ghost"
                  fullWidth
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                  icon={<Eye className="w-4 h-4" />}
                >
                  View Details
                </ModernButton>
              </div>
            </ModernCard>
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
