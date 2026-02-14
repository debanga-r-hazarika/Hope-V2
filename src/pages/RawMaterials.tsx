import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Package, X, Eye, Search, Filter, Download, Archive, ArchiveRestore, Edit, AlertCircle, Save } from 'lucide-react';
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
import { fetchRawMaterialUnits } from '../lib/units';
import type { RawMaterialUnit } from '../types/units';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { useAuth } from '../contexts/AuthContext';
import { LotDetailsModal } from '../components/LotDetailsModal';
import { exportRawMaterials } from '../utils/excelExport';
import { InfoDialog } from '../components/ui/InfoDialog';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { SearchableTagDropdown } from '../components/SearchableTagDropdown';
import { MultiSelect } from '../components/ui/MultiSelect';
import { FilterPanel } from '../components/ui/FilterPanel';

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

  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rawMaterialTags, setRawMaterialTags] = useState<RawMaterialTag[]>([]);
  const [rawMaterialUnits, setRawMaterialUnits] = useState<RawMaterialUnit[]>([]);
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
    unit: '',
    condition: 'Kesa' as 'Kesa' | 'Poka' | 'Baduliye Khuwa' | 'Other',
    custom_condition: '',
    received_date: new Date().toISOString().split('T')[0],
    storage_notes: '',
    handover_to: '',
    amount_paid: '',
    usable: true,
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSuppliers, setFilterSuppliers] = useState<string[]>([]);
  const [filterConditions, setFilterConditions] = useState<string[]>([]);
  const [filterHandovers, setFilterHandovers] = useState<string[]>([]);
  const [filterUnits, setFilterUnits] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterUsability, setFilterUsability] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [materialsData, suppliersData, usersData, tagsData, unitsData] = await Promise.all([
        fetchRawMaterials(showArchived),
        fetchSuppliers(),
        fetchUsers(),
        fetchRawMaterialTags(false),
        fetchRawMaterialUnits(false),
      ]);
      setMaterials(materialsData);
      setSuppliers(suppliersData);
      setUsers(usersData);
      setRawMaterialTags(tagsData);
      setRawMaterialUnits(unitsData);

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

  const getUnitValue = () => formData.unit || '';
  const getSelectedUnit = (): RawMaterialUnit | null => rawMaterialUnits.find(u => u.display_name === formData.unit) || null;

  const handleQuantityChange = (value: string) => {
    const selectedUnit = getSelectedUnit();
    if (selectedUnit && !selectedUnit.allows_decimal) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue % 1 !== 0) {
        setError(`Unit "${selectedUnit.display_name}" does not allow decimal values. Please enter a whole number.`);
        return;
      }
    }
    setFormData((prev) => ({ ...prev, quantity_received: value }));
    setError(null);
  };

  const getConditionValue = () => formData.condition === 'Other' ? formData.custom_condition : formData.condition;

  const handleSubmit = async () => {
    if (!canWrite || !formData.name || !formData.raw_material_tag_ids || formData.raw_material_tag_ids.length === 0 || !formData.quantity_received || !getUnitValue()) {
      setError('Please fill in all required fields including at least one Raw Material Tag');
      return;
    }

    if (!authUser || !userId) {
      setError('User authentication required. Please wait for authentication to complete and try again.');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    try {
      const unitValue = getUnitValue();
      const conditionValue = getConditionValue();
      const quantityReceived = parseFloat(formData.quantity_received);
      if (isNaN(quantityReceived) || quantityReceived <= 0) {
        setError('Please enter a valid quantity');
        setSubmitting(false);
        return;
      }

      let result: RawMaterial;
      if (editingId) {
        const updateData = {
          name: formData.name,
          supplier_id: formData.supplier_id || undefined,
          raw_material_tag_ids: formData.raw_material_tag_ids.length > 0 ? formData.raw_material_tag_ids : undefined,
          unit: unitValue,
          condition: conditionValue,
          received_date: formData.received_date,
          storage_notes: formData.storage_notes || undefined,
          handover_to: formData.handover_to || undefined,
          amount_paid: formData.amount_paid ? parseFloat(formData.amount_paid) : undefined,
          usable: formData.usable,
        };
        result = await updateRawMaterial(editingId, updateData);
        setMaterials((prev) => prev.map((m) => (m.id === editingId ? result : m)));
      } else {
        const materialData = {
          name: formData.name,
          supplier_id: formData.supplier_id || undefined,
          raw_material_tag_ids: formData.raw_material_tag_ids.length > 0 ? formData.raw_material_tag_ids : undefined,
          quantity_received: quantityReceived,
          quantity_available: quantityReceived,
          unit: unitValue,
          condition: conditionValue,
          received_date: formData.received_date,
          storage_notes: formData.storage_notes || undefined,
          handover_to: formData.handover_to || undefined,
          amount_paid: formData.amount_paid ? parseFloat(formData.amount_paid) : undefined,
          usable: formData.usable,
          created_by: userId,
        };
        result = await createRawMaterial(materialData);
        setMaterials((prev) => [result, ...prev]);
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editingId ? 'update' : 'create'} raw material`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      supplier_id: '',
      raw_material_tag_ids: [],
      quantity_received: '',
      unit: '',
      condition: 'Kesa',
      custom_condition: '',
      received_date: new Date().toISOString().split('T')[0],
      storage_notes: '',
      handover_to: '',
      amount_paid: '',
      usable: true,
    });
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
      unit: material.unit || '',
      condition: ['Kesa', 'Poka', 'Baduliye Khuwa'].includes(material.condition || '') ? material.condition as 'Kesa' | 'Poka' | 'Baduliye Khuwa' : 'Other',
      custom_condition: ['Kesa', 'Poka', 'Baduliye Khuwa'].includes(material.condition || '') ? '' : (material.condition || ''),
      received_date: material.received_date,
      storage_notes: material.storage_notes || '',
      handover_to: material.handover_to || '',
      amount_paid: material.amount_paid ? material.amount_paid.toString() : '',
      usable: material.usable ?? true,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const status = lockStatus[id];
    if (status?.locked) {
      setError(`Cannot delete this lot. It is used in locked production batch(es): ${status.batchIds.join(', ')}`);
      setShowDeleteConfirm(null);
      return;
    }

    try {
      await deleteRawMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      const newLockStatus = { ...lockStatus };
      delete newLockStatus[id];
      setLockStatus(newLockStatus);
      setShowDeleteConfirm(null);

      // Close details modal after successful deletion
      setShowDetailsModal(false);
      setSelectedMaterial(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete raw material');
      setShowDeleteConfirm(null);
    }
  };

  // Derived options for filters
  const supplierOptions = useMemo(() =>
    suppliers
      .filter(s => s.supplier_type === 'raw_material' || s.supplier_type === 'multiple')
      .map(s => ({ value: s.id, label: s.name })),
    [suppliers]
  );

  const conditionOptions = useMemo(() => [
    { value: 'Kesa', label: 'Kesa' },
    { value: 'Poka', label: 'Poka' },
    { value: 'Baduliye Khuwa', label: 'Baduliye Khuwa' },
    { value: 'Other', label: 'Other' },
  ], []);

  const handoverOptions = useMemo(() =>
    users.map(u => ({ value: u.id, label: u.full_name })),
    [users]
  );

  const unitOptions = useMemo(() => {
    const uniqueUnits = Array.from(new Set(materials.map(m => m.unit))).sort();
    return uniqueUnits.map(u => ({ value: u, label: u }));
  }, [materials]);

  const usabilityOptions = useMemo(() => [
    { value: 'usable', label: 'Usable' },
    { value: 'not-usable', label: 'Not Usable' },
  ], []);

  const tagOptions = useMemo(() =>
    rawMaterialTags.map(t => ({ value: t.id, label: t.display_name })),
    [rawMaterialTags]
  );

  const activeFiltersCount = [
    filterSuppliers.length > 0,
    filterConditions.length > 0,
    filterHandovers.length > 0,
    filterUnits.length > 0,
    filterDateFrom !== '',
    filterDateTo !== '',
    filterUsability.length > 0,
    filterTags.length > 0,
  ].filter(Boolean).length;

  const handleClearAllFilters = () => {
    setFilterSuppliers([]);
    setFilterConditions([]);
    setFilterHandovers([]);
    setFilterUnits([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterUsability([]);
    setFilterTags([]);
    setSearchTerm('');
  };

  const filteredMaterials = useMemo(() => {
    let filtered = [...materials];

    if (!showArchived) {
      filtered = filtered.filter((m) => !m.is_archived);
    }

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

    if (filterSuppliers.length > 0) {
      filtered = filtered.filter((m) => m.supplier_id && filterSuppliers.includes(m.supplier_id));
    }

    if (filterConditions.length > 0) {
      filtered = filtered.filter((m) => m.condition && filterConditions.includes(m.condition));
    }

    if (filterHandovers.length > 0) {
      filtered = filtered.filter((m) => m.handover_to && filterHandovers.includes(m.handover_to));
    }

    if (filterUnits.length > 0) {
      filtered = filtered.filter((m) => m.unit && filterUnits.includes(m.unit));
    }

    if (filterUsability.length > 0) {
      // If both are selected, it's effectively "all" (or union of both)
      // If only 'usable' is selected
      if (filterUsability.includes('usable') && !filterUsability.includes('not-usable')) {
        filtered = filtered.filter(m => m.usable ?? true);
      }
      // If only 'not-usable' is selected
      else if (filterUsability.includes('not-usable') && !filterUsability.includes('usable')) {
        filtered = filtered.filter(m => !(m.usable ?? true));
      }
      // If both, do nothing (show all)
    }

    if (filterTags.length > 0) {
      filtered = filtered.filter((m) => {
        const itemTags = m.raw_material_tag_ids || (m.raw_material_tag_id ? [m.raw_material_tag_id] : []);
        return itemTags.some(tagId => filterTags.includes(tagId));
      });
    }

    if (filterDateFrom) filtered = filtered.filter((m) => m.received_date >= filterDateFrom);
    if (filterDateTo) filtered = filtered.filter((m) => m.received_date <= filterDateTo);

    return filtered;
  }, [
    materials,
    searchTerm,
    filterSuppliers,
    filterConditions,
    filterHandovers,
    filterUnits,
    filterDateFrom,
    filterDateTo,
    showArchived,
    filterUsability,
    filterTags
  ]);

  const displayedUsableMaterials = useMemo(() => {
    // If we are filtering by specific usability, we should respect that.
    // However, the view is split into two sections: Usable and Not Usable.
    // If the user selects "Not Usable" only, the Usable section should probably be empty or hidden?
    // The previous logic was:
    // const usableMaterials = useMemo(() => {
    //   if (filterUsability === 'not-usable') return [];
    //   return filteredMaterials.filter(m => m.usable ?? true);
    // }, ...);

    // With multi-select:
    // If 'not-usable' is selected and 'usable' is NOT selected -> Usable section empty.
    // If 'usable' is selected -> Usable section shows matches.
    // If neither selected -> Show all (default behavior implies showing everything available).

    const isUsableSelected = filterUsability.includes('usable');
    const isNotUsableSelected = filterUsability.includes('not-usable');

    if (filterUsability.length > 0 && !isUsableSelected) return [];

    return filteredMaterials.filter(m => m.usable ?? true);
  }, [filteredMaterials, filterUsability]);

  const displayedNotUsableMaterials = useMemo(() => {
    const isUsableSelected = filterUsability.includes('usable');
    const isNotUsableSelected = filterUsability.includes('not-usable');

    if (filterUsability.length > 0 && !isNotUsableSelected) return [];

    return filteredMaterials.filter(m => !(m.usable ?? true));
  }, [filteredMaterials, filterUsability]);

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
                placeholder="Search materials..."
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

            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium ${showArchived
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">{showArchived ? 'Hide Archived' : 'Show Archived'}</span>
            </button>

            {canWrite && (
              <ModernButton
                onClick={() => exportRawMaterials(filteredMaterials)}
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
              >
                {showForm ? 'Close' : 'Add Lot'}
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
                label="Condition"
                options={conditionOptions}
                value={filterConditions}
                onChange={setFilterConditions}
                placeholder="All Conditions"
              />

              <MultiSelect
                label="Tags"
                options={tagOptions}
                value={filterTags}
                onChange={setFilterTags}
                placeholder="All Tags"
              />

              <MultiSelect
                label="Collected by"
                options={handoverOptions}
                value={filterHandovers}
                onChange={setFilterHandovers}
                placeholder="All Users"
              />

              <MultiSelect
                label="Unit"
                options={unitOptions}
                value={filterUnits}
                onChange={setFilterUnits}
                placeholder="All Units"
              />

              <MultiSelect
                label="Usability"
                options={usabilityOptions}
                value={filterUsability}
                onChange={setFilterUsability}
                placeholder="All Materials"
              />

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">From Date</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">To Date</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
        <ModernCard className="animate-slide-down border-blue-100 shadow-premium">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-green-500" />}
              {editingId ? 'Edit Raw Material Lot' : 'Add New Lot'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Row 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Material Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value || '' }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="e.g., Banana"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Condition</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData((prev) => ({ ...prev, condition: e.target.value as any }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all mb-2"
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
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Specify condition"
                />
              )}
            </div>

            {/* Row 2 */}
            <div>
              <SearchableTagDropdown
                tags={rawMaterialTags}
                selectedIds={formData.raw_material_tag_ids}
                onChange={(selectedIds) => setFormData((prev) => ({ ...prev, raw_material_tag_ids: selectedIds }))}
                label="Raw Material Tags *"
                placeholder="Select tags..."
                required
                multiple
                emptyMessage="No active tags available."
                colorScheme="blue"
                disabled={!canWrite}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Received Date</label>
              <input
                type="date"
                value={formData.received_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, received_date: e.target.value || '' }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => {
                  if (e.target.value === 'add-new') {
                    setShowSupplierModal(true);
                  } else {
                    setFormData((prev) => ({ ...prev, supplier_id: e.target.value || '' }));
                  }
                }}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">Select Supplier</option>
                {suppliers
                  .filter((s) => s.supplier_type === 'raw_material' || s.supplier_type === 'multiple')
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                <option value="add-new" className="text-blue-600 font-medium">➕ Add New Supplier</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid</label>
                <input
                  type="number"
                  value={formData.amount_paid}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount_paid: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="0.00"
                  step="any"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Collected by</label>
                <select
                  value={formData.handover_to}
                  onChange={(e) => setFormData((prev) => ({ ...prev, handover_to: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select Person</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity *</label>
                <input
                  type="number"
                  value={formData.quantity_received}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="100"
                  step={getSelectedUnit()?.allows_decimal ? 'any' : '1'}
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit *</label>
                <select
                  value={formData.unit}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, unit: e.target.value }));
                    const selectedUnit = rawMaterialUnits.find(u => u.display_name === e.target.value);
                    if (selectedUnit && !selectedUnit.allows_decimal && formData.quantity_received) {
                      const numValue = parseFloat(formData.quantity_received);
                      if (!isNaN(numValue) && numValue % 1 !== 0) {
                        setFormData((prev) => ({ ...prev, quantity_received: Math.floor(numValue).toString() }));
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select unit</option>
                  {rawMaterialUnits.map((unit) => (
                    <option key={unit.id} value={unit.display_name}>{unit.display_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Usability Status</label>
              <div className="flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200 h-[46px] items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.usable === true}
                    onChange={() => setFormData((prev) => ({ ...prev, usable: true }))}
                    className="w-4 h-4 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Usable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.usable === false}
                    onChange={() => setFormData((prev) => ({ ...prev, usable: false }))}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Not Usable</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
            <ModernButton
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
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
              {editingId ? 'Update Lot' : 'Create Lot'}
            </ModernButton>
          </div>
        </ModernCard>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Loading inventory...</p>
          </div>
        ) : (
          <>
            {/* Usable Materials Section */}
            {(filterUsability.length === 0 || filterUsability.includes('usable')) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" />
                  <h2 className="text-lg font-bold text-gray-900">Usable Materials</h2>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {displayedUsableMaterials.length}
                  </span>
                </div>

                {displayedUsableMaterials.length === 0 ? (
                  <ModernCard className="text-center py-12 bg-gray-50/50 border-dashed">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No usable materials found</p>
                  </ModernCard>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lot ID</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Condition</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Available</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Edited</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {displayedUsableMaterials.map((material) => (
                            <tr key={material.id} className="hover:bg-blue-50/30 transition-colors group">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-mono text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                  {material.lot_id}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-900">{material.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{material.supplier_name || '—'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{material.condition}</td>
                              <td className="px-6 py-4">
                                <span className={`font-semibold ${material.quantity_available === 0 ? 'text-red-600' :
                                  material.quantity_available < material.quantity_received * 0.2 ? 'text-amber-600' : 'text-green-600'
                                  }`}>
                                  {material.unit === 'Pieces' ? Math.floor(material.quantity_available) : material.quantity_available.toFixed(2)} {material.unit}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{material.received_date}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {material.updated_by_name ? (
                                  <div className="flex flex-col">
                                    <span className="font-medium">{material.updated_by_name}</span>
                                    <span className="text-xs text-gray-400">{new Date(material.updated_at).toLocaleDateString()}</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleViewDetails(material)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {canWrite && material.is_archived && (
                                    <button onClick={() => handleUnarchive(material.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Unarchive">
                                      <ArchiveRestore className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canWrite && !material.is_archived && material.quantity_available <= 5 && (
                                    <button onClick={() => handleArchive(material.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Archive">
                                      <Archive className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {displayedUsableMaterials.map((material) => (
                        <ModernCard key={material.id} padding="sm" className="flex flex-col h-full">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900">{material.name}</h3>
                              <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                                {material.lot_id}
                              </span>
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${material.quantity_available === 0 ? 'bg-red-100 text-red-700' :
                              material.quantity_available < material.quantity_received * 0.2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                              }`}>
                              {material.unit === 'Pieces' ? Math.floor(material.quantity_available) : material.quantity_available.toFixed(1)} {material.unit}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600 mb-4 flex-1">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Supplier</span>
                              <span className="font-medium text-gray-900">{material.supplier_name || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Condition</span>
                              <span className="font-medium text-gray-900">{material.condition}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Received</span>
                              <span className="font-medium text-gray-900">{material.received_date}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                            <button
                              onClick={() => handleViewDetails(material)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                            {canWrite && material.is_archived && (
                              <button
                                onClick={() => handleUnarchive(material.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canWrite && material.quantity_available <= 5 && !material.is_archived && (
                              <button
                                onClick={() => handleArchive(material.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </ModernCard>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Not Usable Materials Section */}
            {(filterUsability.length === 0 || filterUsability.includes('not-usable')) && (
              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                  <h2 className="text-lg font-bold text-gray-900">Not Usable Materials</h2>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {displayedNotUsableMaterials.length}
                  </span>
                </div>

                {displayedNotUsableMaterials.length === 0 ? (
                  <ModernCard className="text-center py-12 bg-gray-50/50 border-dashed">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No materials marked as not usable</p>
                  </ModernCard>
                ) : (
                  <>
                    {/* Similar Table/Card structure for Not Usable materials - Reusing layout */}
                    <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lot ID</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Condition</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Available</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Edited</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {displayedNotUsableMaterials.map((material) => (
                            <tr key={material.id} className="hover:bg-amber-50/30 transition-colors group">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-mono text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                  {material.lot_id}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-900">{material.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{material.supplier_name || '—'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{material.condition}</td>
                              <td className="px-6 py-4">
                                <span className="font-semibold text-amber-600">
                                  {material.unit === 'Pieces' ? Math.floor(material.quantity_available) : material.quantity_available.toFixed(2)} {material.unit}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{material.received_date}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {material.updated_by_name ? (
                                  <div className="flex flex-col">
                                    <span className="font-medium">{material.updated_by_name}</span>
                                    <span className="text-xs text-gray-400">{new Date(material.updated_at).toLocaleDateString()}</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleViewDetails(material)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards for Not Usable */}
                    <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {displayedNotUsableMaterials.map((material) => (
                        <ModernCard key={material.id} padding="sm" className="flex flex-col h-full border-l-4 border-l-amber-400">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900">{material.name}</h3>
                              <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                                {material.lot_id}
                              </span>
                            </div>
                            <span className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                              {material.unit === 'Pieces' ? Math.floor(material.quantity_available) : material.quantity_available.toFixed(1)} {material.unit}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600 mb-4 flex-1">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Supplier</span>
                              <span className="font-medium text-gray-900">{material.supplier_name || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Condition</span>
                              <span className="font-medium text-gray-900">{material.condition}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                            <button
                              onClick={() => handleViewDetails(material)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          </div>
                        </ModernCard>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Supplier Creation Modal */}
      {canWrite && showSupplierModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <ModernCard className="w-full max-w-md bg-white shadow-2xl animate-slide-down">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Add New Supplier</h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Name</label>
                <input
                  type="text"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData((prev) => ({ ...prev, name: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Type</label>
                <select
                  value={supplierFormData.supplier_type}
                  onChange={(e) => setSupplierFormData((prev) => ({ ...prev, supplier_type: e.target.value as Supplier['supplier_type'] || 'raw_material' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="raw_material">Raw Material</option>
                  <option value="recurring_product">Recurring Product</option>
                  <option value="machine">Machine</option>
                  <option value="multiple">Multiple</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <ModernButton onClick={() => setShowSupplierModal(false)} variant="secondary">
                Cancel
              </ModernButton>
              <ModernButton onClick={() => void handleCreateSupplier()}>
                Create Supplier
              </ModernButton>
            </div>
          </ModernCard>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <ModernCard className="w-full max-w-md bg-white shadow-2xl animate-slide-down">
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Raw Material?</h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete this lot? This action cannot be undone.
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

      {/* Info Dialog */}
      <InfoDialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title="Raw Materials Guide"
        message="Manage your raw material inventory here. Add new lots, track quantities, and archive lots with low stock (≤5). Use filters to find specific materials quickly. Archived lots are hidden from production by default but can be viewed using the 'Show Archived' toggle."
        type="info"
      />

      {/* Lot Details Modal */}
      {selectedMaterial && (
        <LotDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMaterial(null);
          }}
          onEdit={handleEditFromModal}
          onDelete={() => setShowDeleteConfirm(selectedMaterial.id)}
          lot={selectedMaterial}
          type="raw-material"
          isLocked={lockStatus[selectedMaterial.id]?.locked || false}
          batchIds={lockStatus[selectedMaterial.id]?.batchIds || []}
          canEdit={canWrite}
          onRefresh={async () => {
            await loadData();
            const updatedMaterials = await fetchRawMaterials(showArchived);
            const updated = updatedMaterials.find(m => m.id === selectedMaterial.id);
            if (updated) setSelectedMaterial(updated);
          }}
        />
      )}
    </div>
  );
}
