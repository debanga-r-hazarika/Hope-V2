import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, ShoppingCart, AlertCircle, ChevronDown, Calendar, User, Package, IndianRupee, Loader2, Search } from 'lucide-react';
import type { Order, OrderFormData, OrderItemFormData } from '../types/sales';
import type { ProcessedGood } from '../types/operations';
import { fetchCustomers, fetchProcessedGoodsForOrder } from '../lib/sales';
import { getDisplayAvailableQuantity, validateInventoryAvailability } from '../lib/sales';
import { fetchProducedGoodsUnits } from '../lib/units';
import { fetchUsers } from '../lib/operations';
import type { ProducedGoodsUnit } from '../types/units';
import type { Customer } from '../types/sales';

// Custom Product Dropdown Component with modern styling
interface ProductDropdownProps {
  value: string;
  onChange: (value: string) => void;
  processedGoods: Array<ProcessedGood & { actual_available: number }>;
  disabled?: boolean;
  required?: boolean;
}

function ProductDropdown({ value, onChange, processedGoods, disabled, required }: ProductDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = processedGoods.find(pg => pg.id === value);
  const displayText = selectedProduct 
    ? `${selectedProduct.product_type} - ${selectedProduct.unit} - ${selectedProduct.batch_reference} - ${selectedProduct.actual_available} available`
    : 'Select product';

  // Filter products based on search term
  const filteredProducts = processedGoods.filter(pg => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      pg.product_type?.toLowerCase().includes(search) ||
      pg.batch_reference?.toLowerCase().includes(search) ||
      pg.unit?.toLowerCase().includes(search) ||
      pg.produced_goods_tag_name?.toLowerCase().includes(search)
    );
  });

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
                placeholder="Search products..."
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
          
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchTerm('');
              }}
              className={`px-4 py-3 text-sm cursor-pointer transition-colors font-medium ${
                !value ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Select product
            </div>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((pg) => (
                <div
                  key={pg.id}
                  onClick={() => {
                    onChange(pg.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors border-l-4 ${
                    value === pg.id 
                      ? 'bg-blue-50 text-blue-700 border-blue-500 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50 border-transparent'
                  }`}
                >
                  <div className="font-medium">{pg.product_type}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {pg.unit} • Batch: {pg.batch_reference} • Available: {pg.actual_available}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No products found matching "{searchTerm}"
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
          onChange={() => {}}
        />
      )}
    </div>
  );
}

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: OrderFormData) => Promise<void>;
  onSave?: (orderData: OrderFormData) => Promise<void>;
  onLock?: () => Promise<void>;
  order?: Order | null;
}

export function OrderForm({ isOpen, onClose, onSubmit, onSave, onLock, order }: OrderFormProps) {
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
    status: 'DRAFT',
    sold_by: '',
    items: [],
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<Array<{id: string, full_name: string, email: string}>>([]);
  const [processedGoods, setProcessedGoods] = useState<Array<ProcessedGood & { actual_available: number }>>([]);
  const [producedGoodsUnits, setProducedGoodsUnits] = useState<ProducedGoodsUnit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [inventoryErrors, setInventoryErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isOpen) {
      void loadCustomers();
      void loadUsers();
      void loadProcessedGoods();
      void loadProducedGoodsUnits();
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
        
        if (order.is_locked) {
          setError('This order is locked and cannot be modified.');
        }
      } else {
        setFormData({
          customer_id: '',
          order_date: getCurrentDateTimeLocal(),
          status: 'DRAFT',
          sold_by: '',
          items: [],
        });
      }
      setError(null);
      setInventoryErrors({});
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

  const loadProcessedGoods = async () => {
    setLoadingProducts(true);
    try {
      const data = await fetchProcessedGoodsForOrder();
      setProcessedGoods(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadProducedGoodsUnits = async () => {
    try {
      const data = await fetchProducedGoodsUnits();
      setProducedGoodsUnits(data);
    } catch (err) {
      console.error('Failed to load produced goods units:', err);
    }
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          processed_good_id: '',
          product_type: '',
          size: '',
          quantity: 1,
          unit_price: 0,
          unit: '',
        },
      ],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
    setInventoryErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  };

  const handleItemChange = async (index: number, field: keyof OrderItemFormData, value: any) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };

      if (field === 'processed_good_id' && value) {
        const product = processedGoods.find((pg) => pg.id === value);
        if (product) {
          newItems[index].product_type = product.product_type;
          newItems[index].unit = product.unit;
          if (product.output_size && product.output_size_unit) {
            newItems[index].size = `${product.output_size} ${product.output_size_unit}`;
          } else if (product.output_size) {
            newItems[index].size = String(product.output_size);
          } else {
            newItems[index].size = '';
          }
          const selectedUnit = producedGoodsUnits.find(u => u.display_name === product.unit);
          if (selectedUnit && !selectedUnit.allows_decimal && newItems[index].quantity % 1 !== 0) {
            newItems[index].quantity = Math.floor(newItems[index].quantity);
          }
        }
      }

      return { ...prev, items: newItems };
    });

    if ((field === 'quantity' || field === 'processed_good_id') && value) {
      const updatedItems = [...formData.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      if (field === 'processed_good_id') {
        const product = processedGoods.find((pg) => pg.id === value);
        if (product) {
          updatedItems[index].product_type = product.product_type;
          updatedItems[index].unit = product.unit;
          if (product.output_size && product.output_size_unit) {
            updatedItems[index].size = `${product.output_size} ${product.output_size_unit}`;
          } else if (product.output_size) {
            updatedItems[index].size = String(product.output_size);
          } else {
            updatedItems[index].size = '';
          }
          const selectedUnit = producedGoodsUnits.find(u => u.display_name === product.unit);
          if (selectedUnit && !selectedUnit.allows_decimal && updatedItems[index].quantity % 1 !== 0) {
            updatedItems[index].quantity = Math.floor(updatedItems[index].quantity);
          }
        }
      }

      await validateItemInventory(index, updatedItems[index]);
    }
  };

  const validateItemInventory = async (index: number, item: OrderItemFormData) => {
    if (!item.processed_good_id || !item.quantity) {
      setInventoryErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
      return;
    }

    try {
      // Use actual_available from processedGoods array if available (more efficient)
      // Otherwise fall back to getDisplayAvailableQuantity API call (matches dropdown calculation)
      const product = processedGoods.find((pg) => pg.id === item.processed_good_id);
      const available = product?.actual_available ?? await getDisplayAvailableQuantity(item.processed_good_id);
      
      if (item.quantity > available) {
        setInventoryErrors((prev) => ({
          ...prev,
          [index]: `Only ${available} ${item.unit} available`,
        }));
      } else {
        setInventoryErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[index];
          return newErrors;
        });
      }
    } catch (err) {
      setInventoryErrors((prev) => ({
        ...prev,
        [index]: err instanceof Error ? err.message : 'Validation error',
      }));
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSubmitting(true);
    setError(null);

    if (!formData.customer_id) {
      setError('Please select a customer');
      setSubmitting(false);
      return;
    }

    if (formData.items.length === 0) {
      setError('Please add at least one item to the order');
      setSubmitting(false);
      return;
    }

    try {
      await onSave(formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save order';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLock = async () => {
    if (!onLock) return;
    setSubmitting(true);
    setError(null);
    try {
      await onLock();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to lock order';
      setError(message);
    } finally {
      setSubmitting(false);
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

    if (formData.items.length === 0) {
      setError('Please add at least one item to the order');
      setSubmitting(false);
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.processed_good_id || !item.quantity || item.quantity <= 0 || !item.unit_price || item.unit_price < 0) {
        setError(`Item ${i + 1} is incomplete. Please fill all required fields.`);
        setSubmitting(false);
        return;
      }
    }

    const validation = await validateInventoryAvailability(formData.items);
    if (!validation.valid) {
      setError(`Inventory validation failed:\n${validation.errors.join('\n')}`);
      setSubmitting(false);
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save order';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const orderTotal = formData.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {order ? (order.is_locked ? 'View Order (Locked)' : 'Edit Order') : 'Create New Order'}
              </h2>
              {order?.is_locked && (
                <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500 text-white">
                  Locked
                </span>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
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
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customer_id: e.target.value }))}
                    required
                    disabled={order?.is_locked ?? false}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-medium transition-all duration-200 hover:border-gray-400"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.customer_type})
                      </option>
                    ))}
                  </select>
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
                  disabled={order?.is_locked ?? false}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm font-medium transition-all duration-200 hover:border-gray-400"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value as OrderFormData['status'] }))
                  }
                  disabled={order?.is_locked ?? false}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm font-medium transition-all duration-200 hover:border-gray-400"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
                </select>
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
                  disabled={order?.is_locked ?? false}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm font-medium transition-all duration-200 hover:border-gray-400"
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

            {/* Order Items Section */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <label className="block text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Order Items *
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={order?.is_locked ?? false}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  Add Item
                </button>
              </div>

              {formData.items.length === 0 ? (
                <div className="text-center py-12 sm:py-16 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium mb-2">No items added</p>
                  <p className="text-sm text-gray-400">Click "Add Item" to start building your order</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.items.map((item, index) => {
                    const selectedProduct = item.processed_good_id 
                      ? processedGoods.find(pg => pg.id === item.processed_good_id)
                      : null;
                    const selectedUnit = selectedProduct 
                      ? producedGoodsUnits.find(u => u.display_name === selectedProduct.unit)
                      : null;
                    const allowsDecimal = selectedUnit?.allows_decimal ?? true;
                    const lineTotal = item.quantity * item.unit_price;

                    return (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 hover:border-gray-300 transition-all hover:shadow-md"
                      >
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                            </div>
                            <span className="text-base font-bold text-gray-900">Item {index + 1}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            disabled={order?.is_locked ?? false}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="md:col-span-2 lg:col-span-2 space-y-2">
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              Product *
                            </label>
                            <ProductDropdown
                              value={item.processed_good_id}
                              onChange={(value) => handleItemChange(index, 'processed_good_id', value)}
                              processedGoods={processedGoods}
                              disabled={loadingProducts || (order?.is_locked ?? false)}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              Size <span className="text-gray-400 font-normal">(auto-filled)</span>
                            </label>
                            <input
                              type="text"
                              value={item.size || ''}
                              onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                              disabled={(order?.is_locked ?? false) || !!item.processed_good_id}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium disabled:bg-gray-100 disabled:text-gray-500 transition-all"
                              placeholder="Auto-filled from product"
                              title={item.processed_good_id ? "Size is automatically set from the selected product" : "Select a product to auto-fill size"}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              min={allowsDecimal ? "0.01" : "1"}
                              step={allowsDecimal ? "0.01" : "1"}
                              value={item.quantity}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                if (!allowsDecimal && value % 1 !== 0) {
                                  handleItemChange(index, 'quantity', Math.floor(value));
                                } else {
                                  handleItemChange(index, 'quantity', value);
                                }
                              }}
                              onBlur={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                if (!allowsDecimal && value % 1 !== 0) {
                                  handleItemChange(index, 'quantity', Math.floor(value));
                                }
                              }}
                              required
                              disabled={order?.is_locked ?? false}
                              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium disabled:bg-gray-100 transition-all ${
                                inventoryErrors[index] ? 'border-red-400 bg-red-50' : 'border-gray-300'
                              }`}
                              placeholder={allowsDecimal ? "0.00" : "0"}
                            />
                            {selectedUnit && (
                              <p className="text-xs text-gray-500 mt-1">
                                {allowsDecimal 
                                  ? '✓ Decimal values allowed (e.g., 1.5)' 
                                  : '✓ Whole numbers only (e.g., 1, 2, 3)'}
                              </p>
                            )}
                            {inventoryErrors[index] && (
                              <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                                <AlertCircle className="w-3 h-3" />
                                {inventoryErrors[index]}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                              <IndianRupee className="w-3 h-3" />
                              Unit Price (₹) *
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              required
                              disabled={order?.is_locked ?? false}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium disabled:bg-gray-100 transition-all"
                            />
                          </div>
                        </div>

                        {lineTotal > 0 && (
                          <div className="pt-4 mt-4 border-t border-gray-200 bg-blue-50 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">Line Total:</span>
                              <span className="text-lg font-bold text-blue-600">
                                ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Order Summary */}
            {formData.items.length > 0 && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 mb-6 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-lg font-bold text-white">Order Total:</span>
                  <span className="text-3xl font-bold text-white">
                    ₹{orderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-medium text-sm sm:text-base shadow-sm hover:shadow-md"
              disabled={submitting}
            >
              Cancel
            </button>
            {order && onSave && !order.is_locked && (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {submitting ? 'Saving...' : 'Save'}
                </button>
                {onLock && (
                  <button
                    type="button"
                    onClick={handleLock}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {submitting ? 'Locking...' : 'Lock Order'}
                  </button>
                )}
              </>
            )}
            {(!order || !onSave || order.is_locked) && (
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                disabled={submitting || (order?.is_locked ?? false)}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? 'Saving...' : order ? (order.is_locked ? 'Locked' : 'Update Order') : 'Create Order'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
