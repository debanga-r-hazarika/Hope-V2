import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Users } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { Supplier } from '../types/operations';
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  updateSupplier,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';

interface SuppliersProps {
  accessLevel: AccessLevel;
}

export function Suppliers({ accessLevel }: SuppliersProps) {
  const { userId } = useModuleAccess();
  const canWrite = accessLevel === 'read-write';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    supplier_type: 'raw_material',
    contact_details: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    void loadData();
  }, [accessLevel]);

  const handleSubmit = async () => {
    if (!canWrite || !formData.name || !formData.supplier_type) return;

    try {
      if (editingId) {
        const updated = await updateSupplier(editingId, formData);
        setSuppliers((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
      } else {
        const created = await createSupplier({
          ...formData,
          created_by: userId,
        } as Omit<Supplier, 'id' | 'created_at' | 'updated_at'>);
        setSuppliers((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', supplier_type: 'raw_material', contact_details: '', notes: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save supplier');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      supplier_type: supplier.supplier_type,
      contact_details: supplier.contact_details || '',
      notes: supplier.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!canWrite || !confirm('Delete this supplier?')) return;

    try {
      await deleteSupplier(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete supplier');
    }
  };

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Operations module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      {canWrite && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({ name: '', supplier_type: 'raw_material', contact_details: '', notes: '' });
            }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Supplier</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {canWrite && showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 space-y-4">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">
            {editingId ? 'Edit Supplier' : 'Add New Supplier'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Enter supplier name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Type
              </label>
              <select
                value={formData.supplier_type || 'raw_material'}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplier_type: e.target.value as Supplier['supplier_type'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="raw_material">Raw Material</option>
                <option value="recurring_product">Recurring Product</option>
                <option value="machine">Machine</option>
                <option value="multiple">Multiple</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Details
              </label>
              <input
                type="text"
                value={formData.contact_details || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, contact_details: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Phone, email, address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={formData.notes || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Additional information"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData({ name: '', supplier_type: 'raw_material', contact_details: '', notes: '' });
              }}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              {canWrite && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading suppliers...</span>
                  </div>
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-gray-400" />
                    <span>No suppliers found</span>
                  </div>
                </td>
              </tr>
            ) : (
              suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{supplier.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                      {supplier.supplier_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{supplier.contact_details || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{supplier.notes || '—'}</td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleDelete(supplier.id)}
                          className="text-sm text-red-600 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="text-gray-500">Loading suppliers...</span>
            </div>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">No suppliers found</span>
            </div>
          </div>
        ) : (
          suppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-base">{supplier.name}</h3>
                  <span className="inline-block mt-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                    {supplier.supplier_type.replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Contact:</span>
                  <span className="ml-1 text-gray-900">{supplier.contact_details || '—'}</span>
                </div>
                {supplier.notes && (
                  <div>
                    <span className="text-gray-500">Notes:</span>
                    <span className="ml-1 text-gray-900">{supplier.notes}</span>
                  </div>
                )}
              </div>

              {canWrite && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(supplier)}
                    className="flex-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void handleDelete(supplier.id)}
                    className="flex-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
