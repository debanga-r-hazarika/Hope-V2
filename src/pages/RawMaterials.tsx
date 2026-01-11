import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Package, X, Eye, Search, Filter, Download, Archive, ArchiveRestore } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { RawMaterial, Supplier } from '../types/operations';
import {
  createRawMaterial,
  createSupplier,
  deleteRawMaterial,
  fetchRawMaterials,
  fetchSuppliers,
  fetchUsers,
  updateRawMaterial,
  checkRawMaterialInLockedBatches,
  archiveRawMaterial,
  unarchiveRawMaterial,
} from '../lib/operations';
import { fetchRawMaterialTags } from '../lib/tags';
import type { RawMaterialTag } from '../types/tags';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { useAuth } from '../contexts/AuthContext';
import { LotDetailsModal } from '../components/LotDetailsModal';
import { exportRawMaterials } from '../utils/excelExport';
import { InfoDialog } from '../components/ui/InfoDialog';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { SearchableTagDropdown } from '../components/SearchableTagDropdown';

interface RawMaterialsProps {
  accessLevel: AccessLevel;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

export function RawMaterials({ accessLevel }: RawMaterialsProps) {
  const { userId, loading: moduleLoading } = useModuleAccess();
  const { user: authUser, profile } = useAuth();
  const canWrite = accessLevel === 'read-write';

  console.log('RawMaterials render:', {
    userId,
    authUser: authUser?.id,
    profile: profile?.id,
    accessLevel,
    canWrite,
    moduleLoading
  });
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rawMaterialTags, setRawMaterialTags] = useState<RawMaterialTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [lockStatus, setLockStatus] = useState<Record<string, { locked: boolean; batchIds: string[] }>>({});
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    supplier_type: 'raw_material' as Supplier['supplier_type'],
  });
  const [formData, setFormData] = useState({
    name: '',
    supplier_id: '',
    raw_material_tag_ids: [] as string[],
    quantity_received: '',
    unit: 'Gm.' as 'Gm.' | 'Pieces' | 'Ltr' | 'Other',
    custom_unit: '',
    condition: 'Kesa' as 'Kesa' | 'Poka' | 'Baduliye Khuwa' | 'Other',
    custom_condition: '',
    received_date: new Date().toISOString().split('T')[0],
    storage_notes: '',
    handover_to: '',
    amount_paid: '',
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [filterHandover, setFilterHandover] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [materialsData, suppliersData, usersData, tagsData] = await Promise.all([
        fetchRawMaterials(showArchived),
        fetchSuppliers(),
        fetchUsers(),
        fetchRawMaterialTags(false), // Only fetch active tags
      ]);
      setMaterials(materialsData);
      setSuppliers(suppliersData);
      setUsers(usersData);
      setRawMaterialTags(tagsData);

      // Check lock status for all materials
      const lockStatusMap: Record<string, { locked: boolean; batchIds: string[] }> = {};
      for (const material of materialsData) {
        const checkResult = await checkRawMaterialInLockedBatches(material.id);
        lockStatusMap[material.id] = checkResult;
      }
      setLockStatus(lockStatusMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    void loadData();
  }, [accessLevel, showArchived]);

  const handleCreateSupplier = async () => {
    if (!supplierFormData.name.trim()) {
      setError('Supplier name is required');
      return;
    }

    try {
      const created = await createSupplier({
        name: supplierFormData.name,
        supplier_type: supplierFormData.supplier_type,
        created_by: userId || undefined,
      });

      setSuppliers((prev) => [...prev, created]);
      setFormData((prev) => ({ ...prev, supplier_id: created.id }));
      setShowSupplierModal(false);
      setSupplierFormData({ name: '', supplier_type: 'raw_material' });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
    }
  };

  const getUnitValue = () => {
    return formData.unit === 'Other' ? formData.custom_unit : formData.unit;
  };

  const getConditionValue = () => {
    return formData.condition === 'Other' ? formData.custom_condition : formData.condition;
  };

  const handleSubmit = async () => {
    if (!canWrite || !formData.name || !formData.raw_material_tag_ids || formData.raw_material_tag_ids.length === 0 || !formData.quantity_received || !getUnitValue()) {
      setError('Please fill in all required fields including at least one Raw Material Tag');
      return;
    }

    if (!authUser || !userId) {
      setError('User authentication required. Please wait for authentication to complete and try again.');
      console.error('Authentication check failed:', {
        authUser: !!authUser,
        userId,
        profile: profile?.id,
        moduleLoading
      });
      return;
    }

    try {
      const unitValue = getUnitValue();
      const conditionValue = getConditionValue();
      const quantityReceived = parseFloat(formData.quantity_received);
      if (isNaN(quantityReceived) || quantityReceived <= 0) {
        setError('Please enter a valid quantity');
        return;
      }

      const materialData = {
        name: formData.name,
        supplier_id: formData.supplier_id || undefined,
        raw_material_tag_ids: formData.raw_material_tag_ids.length > 0 ? formData.raw_material_tag_ids : undefined,
        quantity_received: quantityReceived,
        quantity_available: quantityReceived, // Initialize available quantity to received quantity
        unit: unitValue,
        condition: conditionValue,
        received_date: formData.received_date,
        storage_notes: formData.storage_notes || undefined,
        handover_to: formData.handover_to || undefined,
        amount_paid: formData.amount_paid ? parseFloat(formData.amount_paid) : undefined,
        created_by: userId,
      };

      console.log(`${editingId ? 'Updating' : 'Creating'} raw material with data:`, materialData);

      let result: RawMaterial;
      if (editingId) {
        result = await updateRawMaterial(editingId, materialData);
        setMaterials((prev) => prev.map((m) => (m.id === editingId ? result : m)));
      } else {
        result = await createRawMaterial(materialData);
        setMaterials((prev) => [result, ...prev]);
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        supplier_id: '',
        raw_material_tag_ids: [],
        quantity_received: '',
        unit: 'Gm.',
        custom_unit: '',
        condition: 'Kesa',
        custom_condition: '',
        received_date: new Date().toISOString().split('T')[0],
        storage_notes: '',
        handover_to: '',
        amount_paid: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editingId ? 'update' : 'create'} raw material`);
    }
  };

  const handleViewDetails = (material: RawMaterial) => {
    setSelectedMaterial(material);
    setShowDetailsModal(true);
  };

  const handleEditFromModal = () => {
    if (!selectedMaterial) return;
    
    const status = lockStatus[selectedMaterial.id];
    if (status?.locked) {
      setError(`Cannot edit this lot. It is used in locked production batch(es): ${status.batchIds.join(', ')}`);
      return;
    }

    handleEdit(selectedMaterial);
  };

  const handleEdit = (material: RawMaterial) => {
    setEditingId(material.id);
    setFormData({
      name: material.name,
      supplier_id: material.supplier_id || '',
      raw_material_tag_ids: material.raw_material_tag_ids || (material.raw_material_tag_id ? [material.raw_material_tag_id] : []),
      quantity_received: material.quantity_received.toString(),
      unit: ['Gm.', 'Pieces', 'Ltr'].includes(material.unit) ? material.unit as 'Gm.' | 'Pieces' | 'Ltr' : 'Other',
      custom_unit: ['Gm.', 'Pieces', 'Ltr'].includes(material.unit) ? '' : material.unit,
      condition: ['Kesa', 'Poka', 'Baduliye Khuwa'].includes(material.condition || '') ? material.condition as 'Kesa' | 'Poka' | 'Baduliye Khuwa' : 'Other',
      custom_condition: ['Kesa', 'Poka', 'Baduliye Khuwa'].includes(material.condition || '') ? '' : (material.condition || ''),
      received_date: material.received_date,
      storage_notes: material.storage_notes || '',
      handover_to: material.handover_to || '',
      amount_paid: material.amount_paid ? material.amount_paid.toString() : '',
    });
    setShowForm(true);
  };

  const handleArchive = async (id: string) => {
    if (!canWrite) return;
    
    const material = materials.find(m => m.id === id);
    if (!material) return;
    
    if (material.quantity_available > 5) {
      setError('Can only archive lots with quantity 5 or less');
      return;
    }

    try {
      setError(null);
      await archiveRawMaterial(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive material');
    }
  };

  const handleUnarchive = async (id: string) => {
    if (!canWrite) return;

    try {
      setError(null);
      await unarchiveRawMaterial(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unarchive material');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canWrite) return;

    // Check if lot is used in locked batches
    const status = lockStatus[id];
    if (status?.locked) {
      setError(`Cannot delete this lot. It is used in locked production batch(es): ${status.batchIds.join(', ')}`);
      setShowDeleteConfirm(null);
      return;
    }

    try {
      await deleteRawMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      // Remove from lock status
      const newLockStatus = { ...lockStatus };
      delete newLockStatus[id];
      setLockStatus(newLockStatus);
      setShowDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete raw material');
      setShowDeleteConfirm(null);
    }
  };

  // Filter and search logic
  const filteredMaterials = useMemo(() => {
    let filtered = [...materials];

    // Archive filter - if not showing archived, filter them out
    if (!showArchived) {
      filtered = filtered.filter((m) => !m.is_archived);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((m) =>
        m.name.toLowerCase().includes(term) ||
        m.lot_id.toLowerCase().includes(term) ||
        (m.supplier_name || '').toLowerCase().includes(term) ||
        (m.condition || '').toLowerCase().includes(term) ||
        (m.storage_notes || '').toLowerCase().includes(term)
      );
    }

    // Supplier filter
    if (filterSupplier !== 'all') {
      filtered = filtered.filter((m) => m.supplier_id === filterSupplier);
    }

    // Condition filter
    if (filterCondition !== 'all') {
      filtered = filtered.filter((m) => m.condition === filterCondition);
    }

    // Handover filter
    if (filterHandover !== 'all') {
      filtered = filtered.filter((m) => m.handover_to === filterHandover);
    }

    // Unit filter
    if (filterUnit !== 'all') {
      filtered = filtered.filter((m) => m.unit === filterUnit);
    }

    // Date range filter
    if (filterDateFrom) {
      filtered = filtered.filter((m) => m.received_date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter((m) => m.received_date <= filterDateTo);
    }

    return filtered;
  }, [materials, searchTerm, filterSupplier, filterCondition, filterHandover, filterUnit, filterDateFrom, filterDateTo]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6 pt-4">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Raw Materials</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Manage raw material inventory and lots</p>
          </div>
          {canWrite && authUser && (userId || !moduleLoading) && (
            <div className="flex flex-wrap gap-2">
              <ModernButton
                onClick={() => setShowInfoDialog(true)}
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm"
              >
                <Package className="w-4 h-4 mr-1" />
                Help
              </ModernButton>
              <ModernButton
                onClick={() => exportRawMaterials(filteredMaterials)}
                variant="secondary"
                size="sm"
                className="text-xs sm:text-sm"
              >
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Export</span>
              </ModernButton>
              <ModernButton
                onClick={() => {
                  setShowForm(!showForm);
                  setEditingId(null);
                  setFormData({
                    name: '',
                    supplier_id: '',
                    raw_material_tag_ids: [],
                    quantity_received: '',
                    unit: 'Gm.',
                    custom_unit: '',
                    condition: 'Kesa',
                    custom_condition: '',
                    received_date: new Date().toISOString().split('T')[0],
                    storage_notes: '',
                    handover_to: '',
                    amount_paid: '',
                  });
                }}
                variant="success"
                size="sm"
                className="text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Add Lot</span>
                <span className="sm:hidden">Add</span>
              </ModernButton>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <ModernCard className="bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </ModernCard>
        )}

        {/* Search and Filters */}
        <ModernCard>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, lot ID, supplier, condition..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
          
          {/* Show Archived Toggle */}
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center justify-center gap-2 px-4 py-2 border-2 rounded-lg transition-all font-medium ${
              showArchived
                ? 'bg-gray-50 border-gray-400 text-gray-700 shadow-sm'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
            }`}
            title={showArchived ? 'Hide archived lots' : 'Show archived lots'}
          >
            <Package className="w-4 h-4" />
            <span className="text-sm">{showArchived ? 'Hide Archived' : 'Show Archived'}</span>
          </button>
          
          {/* Filter Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowFilters(!showFilters);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 border-2 rounded-lg transition-all font-medium ${
              showFilters || filterSupplier !== 'all' || filterCondition !== 'all' || filterHandover !== 'all' || filterUnit !== 'all' || filterDateFrom || filterDateTo
                ? 'bg-green-50 border-green-400 text-green-700 shadow-sm'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
            {(filterSupplier !== 'all' || filterCondition !== 'all' || filterHandover !== 'all' || filterUnit !== 'all' || filterDateFrom || filterDateTo) && (
              <span className="bg-green-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {[filterSupplier !== 'all', filterCondition !== 'all', filterHandover !== 'all', filterUnit !== 'all', filterDateFrom, filterDateTo].filter(Boolean).length}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Suppliers</option>
                {suppliers
                  .filter((s) => s.supplier_type === 'raw_material' || s.supplier_type === 'multiple')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Condition
              </label>
              <select
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Conditions</option>
                <option value="Kesa">Kesa</option>
                <option value="Poka">Poka</option>
                <option value="Baduliye Khuwa">Baduliye Khuwa</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Handover To
              </label>
              <select
                value={filterHandover}
                onChange={(e) => setFilterHandover(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Unit
              </label>
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Units</option>
                {materials && materials.length > 0 && Array.from(new Set(materials.map((m) => m.unit))).sort().map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Received Date From
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full min-w-0 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Received Date To
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full min-w-0 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex items-end">
              <button
                onClick={() => {
                  setFilterSupplier('all');
                  setFilterCondition('all');
                  setFilterHandover('all');
                  setFilterUnit('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                  setSearchTerm('');
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
        </ModernCard>

      {canWrite && showForm && authUser && (userId || !moduleLoading) && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 space-y-4">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">
            {editingId ? 'Edit Raw Material Lot' : 'Add New Raw Material Lot'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Material Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value || '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                placeholder="e.g., Banana"
              />
            </div>
            <div>
              <SearchableTagDropdown
                tags={rawMaterialTags}
                selectedIds={formData.raw_material_tag_ids}
                onChange={(selectedIds) => setFormData((prev) => ({ ...prev, raw_material_tag_ids: selectedIds }))}
                label="Raw Material Tags"
                placeholder="Select one or more tags..."
                required
                multiple
                emptyMessage="No active tags available. Create tags in the Admin page first."
                colorScheme="green"
                disabled={!canWrite}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.supplier_id}
                  onChange={(e) => {
                    if (e.target.value === 'add-new') {
                      setShowSupplierModal(true);
                    } else {
                      setFormData((prev) => ({ ...prev, supplier_id: e.target.value || '' }));
                    }
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Supplier</option>
                  {suppliers
                    .filter((s) => s.supplier_type === 'raw_material' || s.supplier_type === 'multiple')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  <option value="add-new" className="text-blue-600 font-medium">
                    ➕ Add New Supplier
                  </option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity Received
              </label>
              <input
                type="number"
                value={formData.quantity_received}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity_received: e.target.value || '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                placeholder="100"
                step="any"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit of Measure
              </label>
              <div className="space-y-2">
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value as 'Gm.' | 'Pieces' | 'Ltr' | 'Other' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="Gm.">Gm.</option>
                  <option value="Pieces">Pieces</option>
                  <option value="Ltr">Ltr</option>
                  <option value="Other">Other - Please Specify</option>
                </select>
                {formData.unit === 'Other' && (
                  <input
                    type="text"
                    value={formData.custom_unit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, custom_unit: e.target.value || '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    placeholder="Specify unit (e.g., kg, tons)"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition
              </label>
              <div className="space-y-2">
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData((prev) => ({ ...prev, condition: e.target.value as 'Kesa' | 'Poka' | 'Baduliye Khuwa' | 'Other' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="Kesa">Kesa</option>
                  <option value="Poka">Poka</option>
                  <option value="Baduliye Khuwa">Baduliye Khuwa</option>
                  <option value="Other">Other - Please Specify</option>
                </select>
                {formData.condition === 'Other' && (
                  <input
                    type="text"
                    value={formData.custom_condition}
                    onChange={(e) => setFormData((prev) => ({ ...prev, custom_condition: e.target.value || '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    placeholder="Specify condition"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Handover To
              </label>
              <select
                value={formData.handover_to}
                onChange={(e) => setFormData((prev) => ({ ...prev, handover_to: e.target.value || '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select Person</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Paid to Supplier
              </label>
              <input
                type="number"
                value={formData.amount_paid}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount_paid: e.target.value || '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
                step="any"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Received Date
              </label>
              <input
                type="date"
                value={formData.received_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, received_date: e.target.value || '' }))}
                className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Storage Notes
              </label>
              <input
                type="text"
                value={formData.storage_notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, storage_notes: e.target.value || '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                placeholder="Location, temperature, etc."
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData({
                  name: '',
                  supplier_id: '',
                  quantity_received: '',
                  unit: 'Gm.',
                  custom_unit: '',
                  condition: 'Kesa',
                  custom_condition: '',
                  received_date: new Date().toISOString().split('T')[0],
                  storage_notes: '',
                  handover_to: '',
                  amount_paid: '',
                });
              }}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              {editingId ? 'Update Lot' : 'Create Lot'}
            </button>
          </div>
        </div>
      )}

      {/* Supplier Creation Modal */}
      {canWrite && showSupplierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add New Supplier</h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData((prev) => ({ ...prev, name: e.target.value || '' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Type
                </label>
                <select
                  value={supplierFormData.supplier_type}
                  onChange={(e) => setSupplierFormData((prev) => ({ ...prev, supplier_type: e.target.value as Supplier['supplier_type'] || 'raw_material' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="raw_material">Raw Material</option>
                  <option value="recurring_product">Recurring Product</option>
                  <option value="machine">Machine</option>
                  <option value="multiple">Multiple</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowSupplierModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateSupplier()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Handover To</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount Paid</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading materials...</span>
                  </div>
                </td>
              </tr>
            ) : filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="w-8 h-8 text-gray-400" />
                    <span>{materials.length === 0 ? 'No raw materials found' : 'No materials match your filters'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredMaterials.map((material) => (
                <tr key={material.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{material.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-mono">{material.lot_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{material.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{material.condition || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {material.quantity_received} {material.unit}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`font-semibold ${
                        material.quantity_available === 0
                          ? 'text-red-600'
                          : material.quantity_available < material.quantity_received * 0.2
                            ? 'text-amber-600'
                            : 'text-green-600'
                      }`}
                    >
                      {material.quantity_available} {material.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{material.handover_to_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {material.amount_paid ? `₹${material.amount_paid.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{material.received_date}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetails(material)}
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden xl:inline">View</span>
                      </button>
                      {canWrite && material.is_archived ? (
                        <button
                          onClick={() => handleUnarchive(material.id)}
                          className="text-sm text-green-600 hover:text-green-700 transition-colors flex items-center gap-1"
                          title="Unarchive"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                          <span className="hidden xl:inline">Unarchive</span>
                        </button>
                      ) : canWrite && material.quantity_available <= 5 ? (
                        <button
                          onClick={() => handleArchive(material.id)}
                          className="text-sm text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-1"
                          title="Archive (quantity <= 5)"
                        >
                          <Archive className="w-4 h-4" />
                          <span className="hidden xl:inline">Archive</span>
                        </button>
                      ) : null}
                      {canWrite && (
                        <button
                          onClick={() => setShowDeleteConfirm(material.id)}
                          className="text-sm text-red-600 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
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
              <span className="text-gray-500">Loading materials...</span>
            </div>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Package className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">{materials.length === 0 ? 'No raw materials found' : 'No materials match your filters'}</span>
            </div>
          </div>
        ) : (
          filteredMaterials.map((material) => (
            <ModernCard key={material.id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-base">{material.name}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">Lot: {material.lot_id}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    material.quantity_available === 0
                      ? 'bg-red-50 text-red-600'
                      : material.quantity_available < material.quantity_received * 0.2
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-green-50 text-green-600'
                  }`}
                >
                  {material.quantity_available} {material.unit}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Supplier:</span>
                  <span className="ml-1 text-gray-900">{material.supplier_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Condition:</span>
                  <span className="ml-1 text-gray-900">{material.condition || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Received:</span>
                  <span className="ml-1 text-gray-900">{material.quantity_received} {material.unit}</span>
                </div>
                <div>
                  <span className="text-gray-500">Handover:</span>
                  <span className="ml-1 text-gray-900">{material.handover_to_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Amount:</span>
                  <span className="ml-1 text-gray-900">
                    {material.amount_paid ? `₹${material.amount_paid.toLocaleString('en-IN')}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <span className="ml-1 text-gray-900">{material.received_date}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleViewDetails(material)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
                {canWrite && material.is_archived ? (
                  <button
                    onClick={() => handleUnarchive(material.id)}
                    className="px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                    title="Unarchive"
                  >
                    <ArchiveRestore className="w-4 h-4" />
                    Unarchive
                  </button>
                ) : canWrite && material.quantity_available <= 5 ? (
                  <button
                    onClick={() => handleArchive(material.id)}
                    className="px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1"
                    title="Archive (quantity <= 5)"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                ) : null}
                {canWrite && (
                  <ModernButton
                    onClick={() => setShowDeleteConfirm(material.id)}
                    variant="danger"
                    size="sm"
                    className="text-xs"
                  >
                    Delete
                  </ModernButton>
                )}
              </div>
            </ModernCard>
          ))
        )}
      </div>

        {/* Info Dialog */}
        <InfoDialog
          isOpen={showInfoDialog}
          onClose={() => setShowInfoDialog(false)}
          title="Raw Materials Guide"
          message="Manage your raw material inventory here. Add new lots, track quantities, and archive lots with low stock (≤5). Use filters to find specific materials quickly. Archived lots are hidden from production by default but can be viewed using the 'Show Archived' toggle."
          type="info"
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-50"
                onClick={() => setShowDeleteConfirm(null)}
              />
              <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-6 pt-6 pb-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mx-auto sm:mx-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                      <X className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Raw Material Lot</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Are you sure you want to delete this lot? This action cannot be undone. The lot will be permanently removed from the system.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <ModernButton
                    onClick={() => setShowDeleteConfirm(null)}
                    variant="outline"
                    size="md"
                  >
                    Cancel
                  </ModernButton>
                  <ModernButton
                    onClick={() => handleDelete(showDeleteConfirm)}
                    variant="danger"
                    size="md"
                  >
                    Delete Lot
                  </ModernButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lot Details Modal */}
        {selectedMaterial && (
        <LotDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMaterial(null);
          }}
          onEdit={handleEditFromModal}
          lot={selectedMaterial}
          type="raw-material"
          isLocked={lockStatus[selectedMaterial.id]?.locked || false}
          batchIds={lockStatus[selectedMaterial.id]?.batchIds || []}
          canEdit={canWrite}
        />
        )}
      </div>
    </div>
  );
}
