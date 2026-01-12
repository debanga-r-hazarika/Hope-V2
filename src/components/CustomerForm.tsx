import { useState, useEffect } from 'react';
import { X, UserPlus, Edit2 } from 'lucide-react';
import { fetchCustomerTypes } from '../lib/customer-types';
import type { Customer, CustomerFormData } from '../types/sales';
import type { CustomerType } from '../types/customer-types';

interface CustomerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (customerData: CustomerFormData) => Promise<void>;
  customer?: Customer | null;
}

export function CustomerForm({ isOpen, onClose, onSubmit, customer }: CustomerFormProps) {
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    customer_type: 'Direct',
    contact_person: '',
    phone: '',
    address: '',
    status: 'Active',
    notes: '',
  });
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCustomerTypes = async () => {
      setLoadingTypes(true);
      try {
        const types = await fetchCustomerTypes(false); // Only active types
        setCustomerTypes(types);
        // Set default customer type if none selected and types are available
        if (!customer && types.length > 0 && !formData.customer_type) {
          setFormData((prev) => ({ ...prev, customer_type: types[0].display_name }));
        }
      } catch (err) {
        console.error('Failed to load customer types:', err);
      } finally {
        setLoadingTypes(false);
      }
    };

    if (isOpen) {
      void loadCustomerTypes();
    }

    if (customer) {
      setFormData({
        name: customer.name,
        customer_type: customer.customer_type,
        contact_person: customer.contact_person || '',
        phone: customer.phone || '',
        address: customer.address || '',
        status: customer.status,
        notes: customer.notes || '',
      });
    } else {
      setFormData({
        name: '',
        customer_type: '',
        contact_person: '',
        phone: '',
        address: '',
        status: 'Active',
        notes: '',
      });
    }
    setError(null);
  }, [customer, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(formData);
      if (!customer) {
        setFormData({
          name: '',
          customer_type: 'Direct',
          contact_person: '',
          phone: '',
          address: '',
          status: 'Active',
          notes: '',
        });
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save customer';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              {customer ? (
                <Edit2 className="w-5 h-5 text-blue-600" />
              ) : (
                <UserPlus className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {customer ? 'Edit Customer' : 'Create New Customer'}
            </h2>
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
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter customer name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Type *
                </label>
                {loadingTypes ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    Loading customer types...
                  </div>
                ) : (
                  <select
                    name="customer_type"
                    value={formData.customer_type}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {customerTypes.length === 0 ? (
                      <option value="">No customer types available</option>
                    ) : (
                      customerTypes.map((type) => (
                        <option key={type.id} value={type.display_name}>
                          {type.display_name}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter contact person name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes about the customer"
              />
            </div>
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
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
