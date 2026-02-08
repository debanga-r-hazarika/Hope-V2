import { useState, useEffect, useRef, useMemo } from 'react';
import { X, ShoppingBag, AlertCircle, ChevronDown, Calendar, User, Loader2, Search, ArrowRight } from 'lucide-react';
import type { Order, OrderFormData, Customer } from '../types/sales';
import { fetchCustomers } from '../lib/sales';
import { fetchUsers } from '../lib/operations';

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
  const displayText = selectedCustomer ? `${selectedCustomer.name}` : 'Select customer';
  const displayType = selectedCustomer ? selectedCustomer.customer_type : '';

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
          w-full px-4 py-3 text-left bg-white border rounded-xl
          focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500
          disabled:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400
          flex items-center justify-between gap-2 text-sm transition-all duration-200
          ${isOpen ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200 hover:border-slate-300'}
          ${value ? 'text-slate-900' : 'text-slate-500'}
        `}
      >
        <span className="truncate flex items-center gap-2">
          {displayText}
          {displayType && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
              {displayType}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-100 sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customers..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="px-4 py-2.5 text-sm cursor-pointer text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
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
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors border-l-2 ${value === customer.id
                      ? 'bg-purple-50/50 text-purple-700 border-purple-500'
                      : 'text-slate-700 hover:bg-slate-50 border-transparent'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{customer.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${customer.customer_type === 'Hotel' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        customer.customer_type === 'Restaurant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          customer.customer_type === 'Retail' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                      {customer.customer_type}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                No customers found.
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
  // Helper function to get current date-time in local timezone
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col my-4 ring-1 ring-slate-900/5">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Create New Order
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Start a new sales order</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
              {/* Customer Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Customer <span className="text-red-500">*</span>
                </label>
                {loadingCustomers ? (
                  <div className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    <span className="text-sm text-slate-500">Loading customers...</span>
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

              {/* Date & Time */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="datetime-local"
                    value={formData.order_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, order_date: e.target.value }))}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium transition-all text-slate-900"
                  />
                </div>
              </div>

              {/* Sales Person */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sales Person <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={formData.sold_by || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sold_by: e.target.value }))}
                    required
                    className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium transition-all appearance-none text-slate-900"
                  >
                    <option value="" className="text-slate-400">Select salesperson...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="flex gap-3 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 leading-relaxed">
                <span className="font-semibold text-blue-800">Next Step:</span> Item selection happens after creating the order. You'll be redirected to the order details page.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-5 border-t border-slate-200 bg-white flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md font-semibold text-sm disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Order
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
