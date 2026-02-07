import { useState, useEffect, useRef, useMemo } from 'react';
import { X, ShoppingCart, AlertCircle, ChevronDown, Calendar, User, Loader2, Search } from 'lucide-react';
import type { Order, OrderFormData } from '../types/sales';
import { fetchCustomers } from '../lib/sales';
import { fetchUsers } from '../lib/operations';
import type { Customer } from '../types/sales';

interface CustomerDropdownProps {
  value: string;
  onChange: (value: string) => void;
  customers: Customer[];
  disabled?: boolean;
  required?: boolean;
}

function CustomerDropdown({ value, onChange, customers, disabled, required }: CustomerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sort customers alphabetically and filter by search term
  const filteredAndSortedCustomers = useMemo(() => {
    if (!customers || !Array.isArray(customers)) {
      return [];
    }

    let filtered = customers.filter(customer =>
      customer &&
      customer.status === 'Active' &&
      customer.name &&
      typeof customer.name === 'string'
    );

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(search) ||
        customer.customer_type.toLowerCase().includes(search) ||
        (customer.contact_person && customer.contact_person.toLowerCase().includes(search))
      );
    }

    // Sort alphabetically by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, searchTerm]);

  const selectedCustomer = customers?.find(c => c && c.id === value && c.name && c.customer_type);
  const displayText = selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.customer_type})` : 'Select customer';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(''); // Clear search when closing
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Clear search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-3 text-left bg-white border-2 rounded-xl
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400
          flex items-center justify-between gap-2 text-sm font-medium
          transition-all duration-200
          ${isOpen ? 'border-blue-500 shadow-md' : 'border-gray-300 hover:border-gray-400'}
          ${value ? 'text-gray-900' : 'text-gray-500'}
        `}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200 sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customers..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                    setSearchTerm('');
                  }
                }}
              />
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchTerm('');
              }}
              className={`px-4 py-3 text-sm cursor-pointer transition-colors font-medium ${!value ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-50'
                }`}
            >
              Select customer
            </div>
            {filteredAndSortedCustomers.length > 0 ? (
              filteredAndSortedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => {
                    onChange(customer.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors border-l-4 ${value === customer.id
                    ? 'bg-blue-50 text-blue-700 border-blue-500 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 border-transparent'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium flex-1 min-w-0 truncate">{customer.name}</div>
                    <div className="flex-shrink-0">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${customer.customer_type === 'Hotel' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        customer.customer_type === 'Restaurant' ? 'bg-green-100 text-green-800 border-green-200' :
                          customer.customer_type === 'Retail' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            'bg-gray-100 text-gray-800 border-gray-200'
                        }`}>
                        {customer.customer_type}
                      </span>
                    </div>
                  </div>
                  {customer.contact_person && (
                    <div className="text-xs text-gray-500 mt-1">
                      Contact: {customer.contact_person}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                {searchTerm ? `No customers found matching "${searchTerm}"` : 'No active customers available'}
              </div>
            )}
            {filteredAndSortedCustomers.length > 10 && (
              <div className="px-4 py-2 text-center text-gray-500 text-xs border-t border-gray-200 bg-gray-50">
                {filteredAndSortedCustomers.length} customers available. Use search to find specific customers.
              </div>
            )}
          </div>
        </div>
      )}

      {required && !value && (
        <input
          type="text"
          required
          className="absolute opacity-0 pointer-events-none"
          tabIndex={-1}
          value=""
          onChange={() => { }}
        />
      )}
    </div>
  );
}

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: OrderFormData) => Promise<void>;
  order?: Order | null;
}

export function OrderForm({ isOpen, onClose, onSubmit, order }: OrderFormProps) {
  // Helper function to get current date-time in local timezone for datetime-local input
  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState<OrderFormData>({
    customer_id: '',
    order_date: getCurrentDateTimeLocal(),
    status: 'ORDER_CREATED',
    sold_by: '',
    items: [],
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<Array<{ id: string, full_name: string, email: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void loadCustomers();
      void loadUsers();
      if (order) {
        const orderDate = order.order_date ? new Date(order.order_date) : new Date();
        const dateStr = orderDate.toISOString().split('T')[0];
        const timeStr = new Date().toTimeString().slice(0, 5);
        setFormData({
          customer_id: order.customer_id,
          order_date: `${dateStr}T${timeStr}`,
          status: order.status,
          sold_by: (order as any).sold_by || '',
          items: [],
        });
      } else {
        setFormData({
          customer_id: '',
          order_date: getCurrentDateTimeLocal(),
          status: 'ORDER_CREATED',
          sold_by: '',
          items: [],
        });
      }
      setError(null);
    }
  }, [isOpen, order]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const data = await fetchCustomers();
      setCustomers(data.filter((c) => c.status === 'Active'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!formData.customer_id) {
      setError('Please select a customer');
      setSubmitting(false);
      return;
    }

    if (!formData.sold_by) {
      setError('Please select who is making the sale');
      setSubmitting(false);
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Create New Order
              </h2>
              <p className="text-sm text-blue-100 mt-1">Add items from Order Details page after creating</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 whitespace-pre-line font-medium">{error}</div>
              </div>
            )}

            {/* Order Header Fields */}
            <div className="grid grid-cols-1 gap-6 mb-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Customer *
                </label>
                {loadingCustomers ? (
                  <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-500">Loading customers...</span>
                  </div>
                ) : (
                  <CustomerDropdown
                    value={formData.customer_id}
                    onChange={(value) => setFormData((prev) => ({ ...prev, customer_id: value }))}
                    customers={customers}
                    required
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Order Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={formData.order_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, order_date: e.target.value }))}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium transition-all duration-200 hover:border-gray-400"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Sale By *
                </label>
                <select
                  value={formData.sold_by || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sold_by: e.target.value }))}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium transition-all duration-200 hover:border-gray-400"
                >
                  <option value="">Select salesperson</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">Order Items</p>
                <p className="text-sm text-blue-700">
                  After creating this order, you'll be able to add items from the Order Details page.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-6 bg-gray-50 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Order'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
