import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingCart, AlertCircle } from 'lucide-react';
import type { Order, OrderFormData, OrderItemFormData } from '../types/sales';
import type { ProcessedGood } from '../types/operations';
import { fetchCustomers } from '../lib/sales';
import { fetchProcessedGoods } from '../lib/operations';
import { getAvailableQuantity, validateInventoryAvailability } from '../lib/sales';
import type { Customer } from '../types/sales';

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: OrderFormData) => Promise<void>;
  onSave?: (orderData: OrderFormData) => Promise<void>;
  onLock?: () => Promise<void>;
  order?: Order | null;
}

export function OrderForm({ isOpen, onClose, onSubmit, onSave, onLock, order }: OrderFormProps) {
  const [formData, setFormData] = useState<OrderFormData>({
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    status: 'Draft',
    notes: '',
    items: [],
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [processedGoods, setProcessedGoods] = useState<ProcessedGood[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [inventoryErrors, setInventoryErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isOpen) {
      void loadCustomers();
      void loadProcessedGoods();
      if (order) {
        // Load order data for editing
        // For now, we'll handle editing separately - items should be loaded via fetchOrderWithItems
        setFormData({
          customer_id: order.customer_id,
          order_date: order.order_date,
          status: order.status,
          notes: order.notes || '',
          items: [],
        });
        
        // Disable form if locked
        if (order.is_locked) {
          setError('This order is locked and cannot be modified.');
        }
      } else {
        setFormData({
          customer_id: '',
          order_date: new Date().toISOString().split('T')[0],
          status: 'Draft',
          notes: '',
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

  const loadProcessedGoods = async () => {
    setLoadingProducts(true);
    try {
      const data = await fetchProcessedGoods();
      setProcessedGoods(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoadingProducts(false);
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
          form: '',
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
    // Clear inventory error for removed item
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

      // If processed_good_id changes, update product_type and unit
      if (field === 'processed_good_id' && value) {
        const product = processedGoods.find((pg) => pg.id === value);
        if (product) {
          newItems[index].product_type = product.product_type;
          newItems[index].unit = product.unit;
        }
      }

      return { ...prev, items: newItems };
    });

    // Validate inventory when quantity or product changes
    if ((field === 'quantity' || field === 'processed_good_id') && value) {
      const updatedItems = [...formData.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      if (field === 'processed_good_id') {
        const product = processedGoods.find((pg) => pg.id === value);
        if (product) {
          updatedItems[index].product_type = product.product_type;
          updatedItems[index].unit = product.unit;
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
      const available = await getAvailableQuantity(item.processed_good_id);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Validate form
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

    // Validate all items have required fields
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.processed_good_id || !item.quantity || item.quantity <= 0 || !item.unit_price || item.unit_price < 0) {
        setError(`Item ${i + 1} is incomplete. Please fill all required fields.`);
        setSubmitting(false);
        return;
      }
    }

    // Final inventory validation
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {order ? (order.is_locked ? 'View Order (Locked)' : 'Edit Order') : 'Create New Order'}
            </h2>
            {order?.is_locked && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                Locked
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{error}</div>
            </div>
          )}

          <div className="space-y-6">
            {/* Order Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customer_id: e.target.value }))}
                  required
                  disabled={loadingCustomers || (order?.is_locked ?? false)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.customer_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Date *
                </label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, order_date: e.target.value }))}
                  required
                  disabled={order?.is_locked ?? false}
                  className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value as OrderFormData['status'] }))
                  }
                  disabled={order?.is_locked ?? false}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                >
                  <option value="Draft">Draft</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  disabled={order?.is_locked ?? false}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            {/* Order Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">Order Items *</label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={order?.is_locked ?? false}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                  No items added. Click "Add Item" to start.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Item {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={order?.is_locked ?? false}
                          className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Product *
                          </label>
                          <select
                            value={item.processed_good_id}
                            onChange={(e) => handleItemChange(index, 'processed_good_id', e.target.value)}
                            required
                            disabled={loadingProducts || (order?.is_locked ?? false)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100"
                          >
                            <option value="">Select product</option>
                            {processedGoods.map((pg) => (
                              <option key={pg.id} value={pg.id}>
                                {pg.product_type} - Batch: {pg.batch_reference} ({pg.quantity_available} {pg.unit} available)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Form
                          </label>
                          <input
                            type="text"
                            value={item.form || ''}
                            onChange={(e) => handleItemChange(index, 'form', e.target.value)}
                            disabled={order?.is_locked ?? false}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100"
                            placeholder="e.g., Powder"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Size
                          </label>
                          <input
                            type="text"
                            value={item.size || ''}
                            onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                            disabled={order?.is_locked ?? false}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100"
                            placeholder="e.g., 500g"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Quantity *
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            required
                            disabled={order?.is_locked ?? false}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100 ${
                              inventoryErrors[index] ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                          {inventoryErrors[index] && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {inventoryErrors[index]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={item.unit}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
                          />
                        </div>
                      </div>

                      {item.quantity > 0 && item.unit_price > 0 && (
                        <div className="text-sm text-gray-600 pt-2 border-t border-gray-200">
                          Line Total: ₹{(item.quantity * item.unit_price).toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Summary */}
            {formData.items.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Order Total:</span>
                  <span className="text-xl font-bold text-purple-600">
                    ₹
                    {formData.items
                      .reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            {order && onSave && !order.is_locked && (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
                {onLock && (
                  <button
                    type="button"
                    onClick={handleLock}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting}
                  >
                    {submitting ? 'Locking...' : 'Lock Order'}
                  </button>
                )}
              </>
            )}
            {(!order || !onSave || order.is_locked) && (
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting || (order?.is_locked ?? false)}
              >
                {submitting ? 'Saving...' : order ? (order.is_locked ? 'Locked' : 'Update Order') : 'Create Order'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
