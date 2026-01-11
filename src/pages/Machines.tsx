import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Wrench, Search, Filter, X, Download, Upload, File, Trash2 } from 'lucide-react';
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

interface MachinesProps {
  accessLevel: AccessLevel;
}

export function Machines({ accessLevel }: MachinesProps) {
  const { userId } = useModuleAccess();
  const canWrite = accessLevel === 'read-write';
  const [machines, setMachines] = useState<Machine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<Array<{id: string, full_name: string, email: string}>>([]);
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
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save machine');
    }
  };

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete machine');
      setShowDeleteConfirm(null);
    }
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
    if (filterSupplier !== 'all') {
      filtered = filtered.filter((m) => m.supplier_id === filterSupplier);
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter((m) => m.category === filterCategory);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((m) => m.status === filterStatus);
    }

    return filtered;
  }, [machines, searchTerm, filterSupplier, filterCategory, filterStatus]);

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
        <div className="flex justify-end gap-2">
          <button
            onClick={() => exportMachines(filteredMachines)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            title="Export to Excel"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
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
            }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Machine</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, category, supplier, notes..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Filter Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowFilters(!showFilters);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 border-2 rounded-lg transition-all font-medium ${
              showFilters || filterSupplier !== 'all' || filterCategory !== 'all' || filterStatus !== 'all'
                ? 'bg-gray-50 border-gray-400 text-gray-700 shadow-sm'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
            {(filterSupplier !== 'all' || filterCategory !== 'all' || filterStatus !== 'all') && (
              <span className="bg-gray-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {[filterSupplier !== 'all', filterCategory !== 'all', filterStatus !== 'all'].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-500"
              >
                <option value="all">All Suppliers</option>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-500"
              >
                <option value="all">All Categories</option>
                {Array.from(new Set(machines.map((m) => m.category))).sort().map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="idle">Idle</option>
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex items-end">
              <button
                onClick={() => {
                  setFilterSupplier('all');
                  setFilterCategory('all');
                  setFilterStatus('all');
                  setSearchTerm('');
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {canWrite && showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 space-y-4">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">
            {editingId ? 'Edit Machine' : 'Add New Machine'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Machine Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                placeholder="Enter machine name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                placeholder="e.g., Processing, Packaging"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplier_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Responsible
              </label>
              <select
                value={formData.responsible_user_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, responsible_user_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
              >
                <option value="">Select Responsible Person</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Machine['status'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="idle">Idle</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, purchase_date: e.target.value }))}
                className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Cost
              </label>
              <input
                type="number"
                value={formData.purchase_cost}
                onChange={(e) => setFormData((prev) => ({ ...prev, purchase_cost: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                placeholder="Reference only"
                step="any"
                min="0"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                rows={3}
                placeholder="Additional information"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              className="w-full sm:w-auto px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsible</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
              {canWrite && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading machines...</span>
                  </div>
                </td>
              </tr>
            ) : filteredMachines.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Wrench className="w-8 h-8 text-gray-400" />
                    <span>{machines.length === 0 ? 'No machines found' : 'No machines match your filters'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredMachines.map((machine) => (
                <tr key={machine.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{machine.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{machine.category}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{machine.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{machine.responsible_user_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        machine.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : machine.status === 'maintenance'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {machine.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{machine.purchase_date || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {machine.purchase_cost ? `₹${machine.purchase_cost.toLocaleString('en-IN')}` : '—'}
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDocuments(machine.id)}
                          className="text-sm text-green-600 hover:text-green-700 transition-colors"
                          title="View Documents"
                        >
                          <File className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(machine)}
                          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(machine.id)}
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
              <span className="text-gray-500">Loading machines...</span>
            </div>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Wrench className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">{machines.length === 0 ? 'No machines found' : 'No machines match your filters'}</span>
            </div>
          </div>
        ) : (
          filteredMachines.map((machine) => (
            <div key={machine.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-base">{machine.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{machine.category}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    machine.status === 'active'
                      ? 'bg-green-50 text-green-700'
                      : machine.status === 'maintenance'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {machine.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Supplier:</span>
                  <span className="ml-1 text-gray-900">{machine.supplier_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Responsible:</span>
                  <span className="ml-1 text-gray-900">{machine.responsible_user_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Purchase Date:</span>
                  <span className="ml-1 text-gray-900">{machine.purchase_date || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Cost:</span>
                  <span className="ml-1 text-gray-900">
                    {machine.purchase_cost ? `₹${machine.purchase_cost.toLocaleString('en-IN')}` : '—'}
                  </span>
                </div>
              </div>

              {canWrite && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleViewDocuments(machine.id)}
                    className="flex-1 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <File className="w-4 h-4" />
                    Documents
                  </button>
                  <button
                    onClick={() => handleEdit(machine)}
                    className="flex-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(machine.id)}
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

      {/* Documents Modal */}
      {selectedMachineId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Important Documents - {machines.find(m => m.id === selectedMachineId)?.name}
                </h3>
                <button
                  onClick={() => {
                    setSelectedMachineId(null);
                    setMachineDocuments([]);
                    setDocumentName('');
                    setDocumentFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {canWrite && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Upload New Document</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Document Name
                      </label>
                      <input
                        type="text"
                        value={documentName}
                        onChange={(e) => setDocumentName(e.target.value)}
                        placeholder="e.g., Manual, Warranty, Invoice"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        File (PDF, Images, etc.)
                      </label>
                      <input
                        id="document-file-input"
                        type="file"
                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                      />
                    </div>
                    <button
                      onClick={() => void handleUploadDocument()}
                      disabled={uploadingDocument || !documentFile || !documentName.trim()}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {uploadingDocument ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload Document
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Uploaded Documents</h4>
                {machineDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <File className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {machineDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-500">
                              {doc.file_name} • {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''} • {new Date(doc.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              View
                            </a>
                          )}
                          {canWrite && (
                            <button
                              onClick={() => void handleDeleteDocument(doc.id, doc.file_path)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
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
          </div>
        </div>
      )}
    </div>
  );
}
