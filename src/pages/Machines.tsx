import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Wrench, Search, Filter, X, Download, Upload, File, Trash2, Edit, AlertCircle } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { Machine, Supplier, MachineDocument } from '../types/operations';
import {
  createMachine,
  deleteMachine,
  fetchMachines,
  fetchSuppliers,
  updateMachine,
  fetchUsers,
  fetchMachineDocuments,
  uploadMachineDocument,
  deleteMachineDocument,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { exportMachines } from '../utils/excelExport';
import { InfoDialog } from '../components/ui/InfoDialog';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { FilterPanel } from '../components/ui/FilterPanel';
import { MultiSelect } from '../components/ui/MultiSelect';

interface MachinesProps {
  accessLevel: AccessLevel;
}

export function Machines({ accessLevel }: MachinesProps) {
  const { userId } = useModuleAccess();
  const canWrite = accessLevel === 'read-write';
  const [machines, setMachines] = useState<Machine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<Array<{ id: string, full_name: string, email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    supplier_id: '',
    responsible_user_id: '',
    purchase_date: '',
    purchase_cost: '',
    status: 'active' as Machine['status'],
    notes: '',
  });
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [machineDocuments, setMachineDocuments] = useState<MachineDocument[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSuppliers, setFilterSuppliers] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [machinesData, suppliersData, usersData] = await Promise.all([
        fetchMachines(),
        fetchSuppliers(),
        fetchUsers(),
      ]);
      setMachines(machinesData);
      setSuppliers(suppliersData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    void loadData();
  }, [accessLevel]);

  const handleSubmit = async () => {
    if (!canWrite || !formData.name || !formData.category) {
      setError('Please fill in required fields');
      return;
    }

    try {
      if (editingId) {
        const updated = await updateMachine(editingId, {
          name: formData.name,
          category: formData.category,
          supplier_id: formData.supplier_id || undefined,
          responsible_user_id: formData.responsible_user_id || undefined,
          purchase_date: formData.purchase_date || undefined,
          purchase_cost: formData.purchase_cost ? parseFloat(formData.purchase_cost) : undefined,
          status: formData.status,
          notes: formData.notes || undefined,
        });
        setMachines((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
      } else {
        const created = await createMachine({
          name: formData.name,
          category: formData.category,
          supplier_id: formData.supplier_id || undefined,
          responsible_user_id: formData.responsible_user_id || undefined,
          purchase_date: formData.purchase_date || undefined,
          purchase_cost: formData.purchase_cost ? parseFloat(formData.purchase_cost) : undefined,
          status: formData.status,
          notes: formData.notes || undefined,
          created_by: userId || undefined,
        });
        setMachines((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save machine');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      supplier_id: '',
      responsible_user_id: '',
      purchase_date: '',
      purchase_cost: '',
      status: 'active',
      notes: '',
    });
  }

  const handleEdit = (machine: Machine) => {
    setEditingId(machine.id);
    setFormData({
      name: machine.name,
      category: machine.category,
      supplier_id: machine.supplier_id || '',
      responsible_user_id: machine.responsible_user_id || '',
      purchase_date: machine.purchase_date || '',
      purchase_cost: machine.purchase_cost?.toString() || '',
      status: machine.status,
      notes: machine.notes || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadMachineDocuments = async (machineId: string) => {
    try {
      const docs = await fetchMachineDocuments(machineId);
      setMachineDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    }
  };

  const handleViewDocuments = async (machineId: string) => {
    setSelectedMachineId(machineId);
    await loadMachineDocuments(machineId);
  };

  const handleUploadDocument = async () => {
    if (!selectedMachineId || !documentFile || !documentName.trim() || !userId) {
      setError('Please provide document name and file');
      return;
    }

    setUploadingDocument(true);
    setError(null);
    try {
      const doc = await uploadMachineDocument(selectedMachineId, documentFile, documentName.trim(), userId);
      setMachineDocuments((prev) => [doc, ...prev]);
      setDocumentName('');
      setDocumentFile(null);
      const fileInput = document.getElementById('document-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (docId: string, filePath: string) => {
    if (!canWrite) return;
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await deleteMachineDocument(docId, filePath);
      setMachineDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canWrite) return;

    try {
      await deleteMachine(id);
      setMachines((prev) => prev.filter((m) => m.id !== id));
      setShowDeleteConfirm(null);
      if (editingId === id) {
        setShowForm(false);
        setEditingId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete machine');
      setShowDeleteConfirm(null);
    }
  };

  // Derived options for filters
  const supplierOptions = useMemo(() =>
    suppliers
      .filter(s => s.supplier_type === 'machine' || s.supplier_type === 'multiple')
      .map(s => ({ value: s.id, label: s.name })),
    [suppliers]
  );

  const categoryOptions = useMemo(() =>
    Array.from(new Set(machines.map(m => m.category))).sort().map(cat => ({ value: cat, label: cat })),
    [machines]
  );

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'idle', label: 'Idle' },
  ];

  const activeFiltersCount = [
    filterSuppliers.length > 0,
    filterCategories.length > 0,
    filterStatuses.length > 0,
  ].filter(Boolean).length;


  const handleClearAllFilters = () => {
    setFilterSuppliers([]);
    setFilterCategories([]);
    setFilterStatuses([]);
    setSearchTerm('');
  };

  // Filter and search logic
  const filteredMachines = useMemo(() => {
    let filtered = [...machines];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((m) =>
        m.name.toLowerCase().includes(term) ||
        m.category.toLowerCase().includes(term) ||
        (m.supplier_name || '').toLowerCase().includes(term) ||
        (m.notes || '').toLowerCase().includes(term)
      );
    }

    // Supplier filter
    if (filterSuppliers.length > 0) {
      filtered = filtered.filter((m) => m.supplier_id && filterSuppliers.includes(m.supplier_id));
    }

    // Category filter
    if (filterCategories.length > 0) {
      filtered = filtered.filter((m) => filterCategories.includes(m.category));
    }

    // Status filter
    if (filterStatuses.length > 0) {
      filtered = filtered.filter((m) => filterStatuses.includes(m.status));
    }

    return filtered;
  }, [machines, searchTerm, filterSuppliers, filterCategories, filterStatuses]);

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
                placeholder="Search machines..."
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
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium ${showFilters
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {canWrite && (
              <ModernButton
                onClick={() => exportMachines(filteredMachines)}
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
                  resetForm();
                }}
                variant={showForm ? 'secondary' : 'primary'}
                size="sm"
                icon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                className={showForm ? "" : "bg-gray-900 hover:bg-gray-800 text-white"}
              >
                {showForm ? 'Close' : 'Add Machine'}
              </ModernButton>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 animate-slide-down">
            <FilterPanel
              activeFiltersCount={activeFiltersCount}
              onClearAll={handleClearAllFilters}
            >
              <MultiSelect
                label="Supplier"
                options={supplierOptions}
                value={filterSuppliers}
                onChange={setFilterSuppliers}
                placeholder="All Suppliers"
              />
              <MultiSelect
                label="Category"
                options={categoryOptions}
                value={filterCategories}
                onChange={setFilterCategories}
                placeholder="All Categories"
              />
              <MultiSelect
                label="Status"
                options={statusOptions}
                value={filterStatuses}
                onChange={setFilterStatuses}
                placeholder="All Statuses"
              />
            </FilterPanel>
          </div>
        )}
      </ModernCard>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {canWrite && showForm && (
        <ModernCard className="animate-slide-down border-gray-200 shadow-premium">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-green-500" />}
              {editingId ? 'Edit Machine' : 'Add New Machine'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Machine Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                  placeholder="Enter machine name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                  placeholder="e.g., Processing, Packaging"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplier_id: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                >
                  <option value="">Select Supplier</option>
                  {suppliers
                    .filter((s) => s.supplier_type === 'machine' || s.supplier_type === 'multiple')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsible Person</label>
                <select
                  value={formData.responsible_user_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, responsible_user_id: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                >
                  <option value="">Select Responsible Person</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Machine['status'] }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="idle">Idle</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, purchase_date: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Cost</label>
                  <input
                    type="number"
                    value={formData.purchase_cost}
                    onChange={(e) => setFormData((prev) => ({ ...prev, purchase_cost: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                    placeholder="0.00"
                    step="any"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                  rows={3}
                  placeholder="Additional information..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            {editingId && (
              <ModernButton
                onClick={() => setShowDeleteConfirm(editingId)}
                variant="danger"
                className="mr-auto"
              >
                Delete Machine
              </ModernButton>
            )}
            <ModernButton onClick={() => setShowForm(false)} variant="secondary">
              Cancel
            </ModernButton>
            <ModernButton onClick={() => void handleSubmit()}>
              {editingId ? 'Update Machine' : 'Create Machine'}
            </ModernButton>
          </div>
        </ModernCard>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            <span className="text-gray-500 font-medium">Loading machines...</span>
          </div>
        </div>
      ) : filteredMachines.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <Wrench className="w-12 h-12 text-gray-300" />
            <span className="text-gray-500 font-medium">{machines.length === 0 ? 'No machines available' : 'No machines match your filters'}</span>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Responsible</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Edited</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMachines.map((machine) => (
                  <tr key={machine.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">{machine.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {machine.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${machine.status === 'active'
                            ? 'bg-green-50 text-green-700'
                            : machine.status === 'maintenance'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${machine.status === 'active'
                            ? 'bg-green-500'
                            : machine.status === 'maintenance'
                              ? 'bg-amber-500'
                              : 'bg-gray-500'
                          }`}></span>
                        {machine.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{machine.supplier_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{machine.responsible_user_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {machine.purchase_cost ? `₹${machine.purchase_cost.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {machine.updated_by_name ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{machine.updated_by_name}</span>
                          <span className="text-xs text-gray-400">{new Date(machine.updated_at).toLocaleDateString()}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canWrite && (
                          <button
                            onClick={() => handleViewDocuments(machine.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Documents"
                          >
                            <File className="w-4 h-4" />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => handleEdit(machine)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredMachines.map((machine) => (
              <ModernCard key={machine.id} padding="sm" className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{machine.name}</h3>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {machine.category}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold capitalize ${machine.status === 'active'
                        ? 'bg-green-50 text-green-700'
                        : machine.status === 'maintenance'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                  >
                    {machine.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4 flex-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Supplier</span>
                    <span className="font-medium text-gray-900">{machine.supplier_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Responsible</span>
                    <span className="font-medium text-gray-900">{machine.responsible_user_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cost</span>
                    <span className="font-medium text-gray-900">
                      {machine.purchase_cost ? `₹${machine.purchase_cost.toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>
                </div>

                {canWrite && (
                  <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                    <button
                      onClick={() => handleViewDocuments(machine.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <File className="w-3.5 h-3.5" />
                      Docs
                    </button>
                    <button
                      onClick={() => handleEdit(machine)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                )}
              </ModernCard>
            ))}
          </div>
        </>
      )}

      {/* Documents Modal */}
      {selectedMachineId && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <ModernCard className="w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-down">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <File className="w-5 h-5 text-gray-500" />
                Documents - {machines.find(m => m.id === selectedMachineId)?.name}
              </h3>
              <button
                onClick={() => {
                  setSelectedMachineId(null);
                  setMachineDocuments([]);
                  setDocumentName('');
                  setDocumentFile(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {canWrite && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-500" />
                    Upload New Document
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Document Name
                      </label>
                      <input
                        type="text"
                        value={documentName}
                        onChange={(e) => setDocumentName(e.target.value)}
                        placeholder="e.g., Manual, Warranty, Invoice"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        File
                      </label>
                      <input
                        id="document-file-input"
                        type="file"
                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 bg-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <ModernButton
                      onClick={() => void handleUploadDocument()}
                      disabled={uploadingDocument || !documentFile || !documentName.trim()}
                      size="sm"
                      className=""
                    >
                      {uploadingDocument ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          Upload
                        </>
                      )}
                    </ModernButton>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900">Uploaded Documents</h4>
                {machineDocuments.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-gray-100 rounded-xl border-dashed">
                    <File className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium">No documents uploaded</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {machineDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <File className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{doc.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span>{doc.file_name}</span>
                              <span>•</span>
                              <span>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}</span>
                              <span>•</span>
                              <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View/Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {canWrite && (
                            <button
                              onClick={() => void handleDeleteDocument(doc.id, doc.file_path)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ModernCard>
        </div>
      )}

      {/* Info Dialog */}
      <InfoDialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title="Machines Guide"
        message="Manage your machinery and equipment including maintenance records and documents."
        type="info"
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <ModernCard className="w-full max-w-md bg-white shadow-2xl animate-slide-down">
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Machine?</h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete this machine? This action cannot be undone.
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
