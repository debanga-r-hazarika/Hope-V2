import { useState, useEffect } from 'react';
import { X, UserPlus, Edit2, Camera, Upload, RefreshCw, Trash2 } from 'lucide-react';
import { fetchCustomerTypes } from '../lib/customer-types';
import { supabase } from '../lib/supabase';
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
    photo_url: '',
  });
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
        photo_url: customer.photo_url || '',
      });
      setPhotoPreview(customer.photo_url || null);
    } else {
      setFormData({
        name: '',
        customer_type: '',
        contact_person: '',
        phone: '',
        address: '',
        status: 'Active',
        notes: '',
        photo_url: '',
      });
      setPhotoPreview(null);
    }
    setError(null);
  }, [customer, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let finalFormData = { ...formData };

      // Upload photo if a new file was selected
      if (photoFile) {
        const photoUrl = await uploadPhoto();
        if (photoUrl) {
          finalFormData.photo_url = photoUrl;
        }
      }

      await onSubmit(finalFormData);
      if (!customer) {
        setFormData({
          name: '',
          customer_type: 'Direct',
          contact_person: '',
          phone: '',
          address: '',
          status: 'Active',
          notes: '',
          photo_url: '',
        });
        setPhotoFile(null);
        setPhotoPreview(null);
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

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file size must be less than 5MB');
        return;
      }

      setPhotoFile(file);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;

    setUploadingPhoto(true);
    try {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `customer-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      const filePath = `customers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents') // Using documents bucket for customer photos
        .upload(filePath, photoFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Photo upload failed:', err);
      throw new Error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChangePhoto = () => {
    // Reset photo states to allow re-selection
    setPhotoFile(null);
    setPhotoPreview(null);
    // Clear any existing photo URL from form data
    setFormData(prev => ({ ...prev, photo_url: '' }));
  };

  const handleDeletePhoto = async () => {
    if (!formData.photo_url) {
      // If it's a newly selected file that hasn't been uploaded yet
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    // If it's an existing uploaded photo, we should delete it from storage
    // However, since we don't have the file path stored, we'll just clear the form data
    // The old photo will remain in storage but won't be referenced anymore
    setFormData(prev => ({ ...prev, photo_url: '' }));
    setPhotoFile(null);
    setPhotoPreview(null);
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

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Photo (Optional)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative">
                  {photoPreview ? (
                    <div className="w-24 h-24 rounded-lg border-2 border-gray-300 overflow-hidden shadow-sm">
                      <img
                        src={photoPreview}
                        alt="Customer preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Camera className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                  {!photoPreview && (
                    <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                      <Upload className="w-4 h-4 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {photoPreview ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 font-medium">
                        Photo uploaded successfully
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleChangePhoto}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 hover:border-amber-300 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span className="hidden sm:inline">Change</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDeletePhoto}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                      {uploadingPhoto && (
                        <p className="text-xs text-blue-600">Uploading photo...</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">
                        Upload a photo of the customer or their shop for easy identification
                      </p>
                      <p className="text-xs text-gray-400">
                        Max file size: 5MB • Supported: JPG, PNG, GIF
                      </p>
                      {uploadingPhoto && (
                        <p className="text-xs text-blue-600 mt-1">Uploading photo...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
