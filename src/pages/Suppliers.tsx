import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Users, Search, Filter, X, Download, Save, Trash2, Edit } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { Supplier } from '../types/operations';
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  updateSupplier,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { exportSuppliers } from '../utils/excelExport';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

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
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
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
    // Scroll to top to see form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!canWrite) return;

    try {
      await deleteSupplier(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      setShowDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete supplier');
      setShowDeleteConfirm(null);
    }
  };

  // Filter and search logic
  const filteredSuppliers = useMemo(() => {
    let filtered = [...suppliers];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((s) =>
        s.name.toLowerCase().includes(term) ||
        (s.contact_details || '').toLowerCase().includes(term) ||
        (s.notes || '').toLowerCase().includes(term)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((s) => s.supplier_type === filterType);
    }

    return filtered;
  }, [suppliers, searchTerm, filterType]);

  const getSupplierTypeLabel = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getSupplierTypeColor = (type: string) => {
    switch(type) {
      case 'raw_material': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'recurring_product': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'machine': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'multiple': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (accessLevel === 'no-access') return null;

  return (
    <div className="space-y-6">
      {/* Top Controls Card */}
      <ModernCard padding="sm" className="bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full sm:w-auto flex gap-2">
             <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search suppliers..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium ${
                showFilters || filterType !== 'all'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {filterType !== 'all' && (
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              )}
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {canWrite && (
              <ModernButton
                onClick={() => exportSuppliers(filteredSuppliers)}
                variant="secondary"
                size="sm"
                icon={<Download className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">Export</span>
              </ModernButton>
            )}
            
            {canWrite && (
              <ModernButton
                onClick={() => {
                  setShowForm(!showForm);
                  setEditingId(null);
                  setFormData({ name: '', supplier_type: 'raw_material', contact_details: '', notes: '' });
                }}
                variant={showForm ? 'secondary' : 'primary'}
                size="sm"
                icon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              >
                {showForm ? 'Close' : 'Add Supplier'}
              </ModernButton>
            )}
          </div>
        </div>

        {/* Expandable Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 animate-slide-down">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</label>
                <div className="flex flex-wrap gap-2">
                  {['all', 'raw_material', 'recurring_product', 'machine', 'multiple'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        filterType === type
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {type === 'all' ? 'All Types' : getSupplierTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </ModernCard>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <X className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add/Edit Form Panel */}
      {canWrite && showForm && (
        <ModernCard className="animate-slide-down border-blue-100 shadow-premium">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-green-500" />}
              {editingId ? 'Edit Supplier' : 'New Supplier'}
            </h3>
            <button 
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="e.g. Acme Corp"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Type *</label>
                <select
                  value={formData.supplier_type || 'raw_material'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplier_type: e.target.value as Supplier['supplier_type'] }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="raw_material">Raw Material</option>
                  <option value="recurring_product">Recurring Product</option>
                  <option value="machine">Machine</option>
                  <option value="multiple">Multiple</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Details</label>
                <input
                  type="text"
                  value={formData.contact_details || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contact_details: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Phone, email, address..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Additional information..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
            <ModernButton
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData({ name: '', supplier_type: 'raw_material', contact_details: '', notes: '' });
              }}
              variant="secondary"
            >
              Cancel
            </ModernButton>
            <ModernButton
              onClick={() => void handleSubmit()}
              loading={submitting}
              icon={<Save className="w-4 h-4" />}
            >
              {editingId ? 'Update Supplier' : 'Create Supplier'}
            </ModernButton>
          </div>
        </ModernCard>
      )}

      {/* Main Content Area */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No suppliers found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {searchTerm || filterType !== 'all' 
                ? "Try adjusting your search or filters to find what you're looking for." 
                : "Get started by adding your first supplier to the system."}
            </p>
            {canWrite && !searchTerm && filterType === 'all' && (
              <div className="mt-6">
                <ModernButton onClick={() => setShowForm(true)} icon={<Plus className="w-4 h-4" />}>
                  Add Supplier
                </ModernButton>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Edited</th>
                    {canWrite && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{supplier.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getSupplierTypeColor(supplier.supplier_type)}`}>
                          {getSupplierTypeLabel(supplier.supplier_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {supplier.contact_details || <span className="text-gray-400 italic">No contact info</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {supplier.notes || <span className="text-gray-400 italic">No notes</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {supplier.updated_by_name ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{supplier.updated_by_name}</span>
                            <span className="text-xs text-gray-400">{new Date(supplier.updated_at).toLocaleDateString()}</span>
                          </div>
                        ) : '—'}
                      </td>
                      {canWrite && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(supplier)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(supplier.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredSuppliers.map((supplier) => (
                <ModernCard key={supplier.id} padding="sm" className="flex flex-col h-full hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-900 text-lg">{supplier.name}</h3>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getSupplierTypeColor(supplier.supplier_type)}`}>
                      {getSupplierTypeLabel(supplier.supplier_type)}
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 flex-1 mb-4">
                    <div className="flex gap-2 text-sm">
                      <span className="text-gray-400 w-16 flex-shrink-0">Contact:</span>
                      <span className="text-gray-700 font-medium truncate">{supplier.contact_details || '—'}</span>
                    </div>
                    {supplier.notes && (
                      <div className="flex gap-2 text-sm">
                        <span className="text-gray-400 w-16 flex-shrink-0">Notes:</span>
                        <span className="text-gray-600 line-clamp-2">{supplier.notes}</span>
                      </div>
                    )}
                  </div>

                  {canWrite && (
                    <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(supplier.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </ModernCard>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <ModernCard className="w-full max-w-md bg-white shadow-2xl animate-slide-down">
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Supplier?</h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete this supplier? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <ModernButton
                  onClick={() => setShowDeleteConfirm(null)}
                  variant="secondary"
                  fullWidth
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  onClick={() => handleDelete(showDeleteConfirm)}
                  variant="danger"
                  fullWidth
                >
                  Delete
                </ModernButton>
              </div>
            </div>
          </ModernCard>
        </div>
      )}
    </div>
  );
}
