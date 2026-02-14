import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Package, X, Eye, Search, Filter, Download, Archive, ArchiveRestore, Save, Edit, AlertCircle } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { RecurringProduct, Supplier } from '../types/operations';
import {
  createRecurringProduct,
  createSupplier,
  deleteRecurringProduct,
  fetchRecurringProducts,
  fetchSuppliers,
  fetchUsers,
  updateRecurringProduct,
  checkRecurringProductInLockedBatches,
  archiveRecurringProduct,
  unarchiveRecurringProduct,
} from '../lib/operations';
import { fetchRecurringProductTags } from '../lib/tags';
import type { RecurringProductTag } from '../types/tags';
import { fetchRecurringProductUnits } from '../lib/units';
import type { RecurringProductUnit } from '../types/units';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { useAuth } from '../contexts/AuthContext';
import { LotDetailsModal } from '../components/LotDetailsModal';
import { exportRecurringProducts } from '../utils/excelExport';
import { InfoDialog } from '../components/ui/InfoDialog';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { SearchableTagDropdown } from '../components/SearchableTagDropdown';
import { MultiSelect } from '../components/ui/MultiSelect';
import { FilterPanel } from '../components/ui/FilterPanel';

interface User {
  id: string;
  full_name: string;
  email: string;
}

interface RecurringProductsProps {
  accessLevel: AccessLevel;
}

export function RecurringProducts({ accessLevel }: RecurringProductsProps) {
  const { userId, loading: moduleLoading } = useModuleAccess();
  const { user: authUser, profile } = useAuth();
  const canWrite = accessLevel === 'read-write';

  const [products, setProducts] = useState<RecurringProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [recurringProductTags, setRecurringProductTags] = useState<RecurringProductTag[]>([]);
  const [recurringProductUnits, setRecurringProductUnits] = useState<RecurringProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<RecurringProduct | null>(null);
  const [lockStatus, setLockStatus] = useState<Record<string, { locked: boolean; batchIds: string[] }>>({});
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    supplier_type: 'recurring_product' as Supplier['supplier_type'],
  });
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    supplier_id: '',
    recurring_product_tag_ids: [] as string[],
    quantity_received: '',
    unit: '',
    received_date: new Date().toISOString().split('T')[0],
    notes: '',
    handover_to: '',
    amount_paid: '',
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSuppliers, setFilterSuppliers] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterHandovers, setFilterHandovers] = useState<string[]>([]);
  const [filterUnits, setFilterUnits] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, suppliersData, usersData, tagsData, unitsData] = await Promise.all([
        fetchRecurringProducts(showArchived),
        fetchSuppliers(),
        fetchUsers(),
        fetchRecurringProductTags(), // Only fetch active tags
        fetchRecurringProductUnits(), // Only fetch active units
      ]);
      setProducts(productsData);
      setSuppliers(suppliersData);
      setUsers(usersData);
      setRecurringProductTags(tagsData);
      setRecurringProductUnits(unitsData);

      // Check lock status for all products
      const lockStatusMap: Record<string, { locked: boolean; batchIds: string[] }> = {};
      for (const product of productsData) {
        const checkResult = await checkRecurringProductInLockedBatches(product.id);
        lockStatusMap[product.id] = checkResult;
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
      setSupplierFormData({ name: '', supplier_type: 'recurring_product' });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
    }
  };

  const getUnitValue = () => {
    return formData.unit || '';
  };

  const getSelectedUnit = (): RecurringProductUnit | null => {
    return recurringProductUnits.find(u => u.display_name === formData.unit) || null;
  };

  const handleQuantityChange = (value: string) => {
    const selectedUnit = getSelectedUnit();
    if (selectedUnit && !selectedUnit.allows_decimal) {
      // Only allow whole numbers
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue % 1 !== 0) {
        setError(`Unit "${selectedUnit.display_name}" does not allow decimal values. Please enter a whole number.`);
        return;
      }
    }
    setFormData((prev) => ({ ...prev, quantity_received: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!canWrite || !formData.name || !formData.category || !formData.recurring_product_tag_ids || formData.recurring_product_tag_ids.length === 0 || !formData.quantity_received || !getUnitValue()) {
      setError('Please fill in all required fields including at least one Recurring Product Tag');
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

    if (submitting) return; // Prevent multiple submissions

    setSubmitting(true);
    try {
      const unitValue = getUnitValue();
      const quantityReceived = parseFloat(formData.quantity_received);
      if (isNaN(quantityReceived) || quantityReceived <= 0) {
        setError('Please enter a valid quantity');
        setSubmitting(false);
        return;
      }

      let result: RecurringProduct;
      if (editingId) {
        // When editing, exclude quantity_received, quantity_available, and created_by
        // These are managed by the system and should not be changed
        const updateData = {
          name: formData.name,
          category: formData.category,
          supplier_id: formData.supplier_id || undefined,
          recurring_product_tag_ids: formData.recurring_product_tag_ids.length > 0 ? formData.recurring_product_tag_ids : undefined,
          unit: unitValue,
          received_date: formData.received_date,
          notes: formData.notes || undefined,
          handover_to: formData.handover_to || undefined,
          amount_paid: formData.amount_paid ? parseFloat(formData.amount_paid) : undefined,
        };
        console.log('Updating recurring product with data:', updateData);
        console.log('Using userId:', userId);
        result = await updateRecurringProduct(editingId, updateData);
        setProducts((prev) => prev.map((p) => (p.id === editingId ? result : p)));
      } else {
        // When creating, include all fields
        const productData = {
          name: formData.name,
          category: formData.category,
          supplier_id: formData.supplier_id || undefined,
          recurring_product_tag_ids: formData.recurring_product_tag_ids.length > 0 ? formData.recurring_product_tag_ids : undefined,
          quantity_received: quantityReceived,
          quantity_available: quantityReceived, // Initialize available quantity to received quantity
          unit: unitValue,
          received_date: formData.received_date,
          notes: formData.notes || undefined,
          handover_to: formData.handover_to || undefined,
          amount_paid: formData.amount_paid ? parseFloat(formData.amount_paid) : undefined,
          created_by: userId,
        };
        console.log('Creating recurring product with data:', productData);
        console.log('Using userId:', userId);
        result = await createRecurringProduct(productData);
        setProducts((prev) => [result, ...prev]);
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        category: '',
        supplier_id: '',
        recurring_product_tag_ids: [],
        quantity_received: '',
        unit: '',
        received_date: new Date().toISOString().split('T')[0],
        notes: '',
        handover_to: '',
        amount_paid: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editingId ? 'update' : 'create'} recurring product`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = (product: RecurringProduct) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const handleEditFromModal = () => {
    if (!selectedProduct) return;

    const status = lockStatus[selectedProduct.id];
    if (status?.locked) {
      setError(`Cannot edit this lot. It is used in locked production batch(es): ${status.batchIds.join(', ')}`);
      return;
    }

    handleEdit(selectedProduct);
  };

  const handleEdit = (product: RecurringProduct) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      category: product.category,
      supplier_id: product.supplier_id || '',
      recurring_product_tag_ids: product.recurring_product_tag_ids || (product.recurring_product_tag_id ? [product.recurring_product_tag_id] : []),
      quantity_received: product.quantity_received.toString(),
      unit: product.unit || '',
      received_date: product.received_date,
      notes: product.notes || '',
      handover_to: product.handover_to || '',
      amount_paid: product.amount_paid ? product.amount_paid.toString() : '',
    });
    setShowForm(true);
  };

  const handleArchive = async (id: string) => {
    if (!canWrite) return;

    const product = products.find(p => p.id === id);
    if (!product) return;

    if (product.quantity_available > 5) {
      setError('Can only archive lots with quantity 5 or less');
      return;
    }

    try {
      setError(null);
      await archiveRecurringProduct(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive product');
    }
  };

  const handleUnarchive = async (id: string) => {
    if (!canWrite) return;

    try {
      setError(null);
      await unarchiveRecurringProduct(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unarchive product');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canWrite) return;

    // Check if lot is used in locked batches
    const status = lockStatus[id];
    if (status?.locked) {
      setError(`Cannot delete this lot. It is used in locked production batch(es): ${status.batchIds.join(', ')}`);
      return;
    }

    if (!confirm('Delete this recurring product?')) return;

    try {
      await deleteRecurringProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      // Remove from lock status
      const newLockStatus = { ...lockStatus };
      delete newLockStatus[id];
      setLockStatus(newLockStatus);

      // Close modals after successful deletion
      setShowDeleteConfirm(null);
      setShowDetailsModal(false);
      setSelectedProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recurring product');
    }
  };

  // Derived options for filters
  const supplierOptions = useMemo(() =>
    suppliers
      .filter(s => s.supplier_type === 'recurring_product' || s.supplier_type === 'multiple')
      .map(s => ({ value: s.id, label: s.name })),
    [suppliers]
  );

  const categoryOptions = useMemo(() =>
    Array.from(new Set(products.map(p => p.category))).sort().map(cat => ({ value: cat, label: cat })),
    [products]
  );

  const handoverOptions = useMemo(() =>
    users.map(u => ({ value: u.id, label: u.full_name })),
    [users]
  );

  const unitOptions = useMemo(() => {
    const uniqueUnits = Array.from(new Set(products.map(p => p.unit))).sort();
    return uniqueUnits.map(u => ({ value: u, label: u }));
  }, [products]);

  const tagOptions = useMemo(() =>
    recurringProductTags.map(t => ({ value: t.id, label: t.display_name })),
    [recurringProductTags]
  );

  const activeFiltersCount = [
    filterSuppliers.length > 0,
    filterCategories.length > 0,
    filterHandovers.length > 0,
    filterUnits.length > 0,
    filterDateFrom !== '',
    filterDateTo !== '',
    filterTags.length > 0,
  ].filter(Boolean).length;

  const handleClearAllFilters = () => {
    setFilterSuppliers([]);
    setFilterCategories([]);
    setFilterHandovers([]);
    setFilterUnits([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterTags([]);
    setSearchTerm('');
  };

  // Filter and search logic
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Archive filter - if not showing archived, filter them out
    if (!showArchived) {
      filtered = filtered.filter((p) => !p.is_archived);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(term) ||
        p.lot_id.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (p.supplier_name || '').toLowerCase().includes(term) ||
        (p.notes || '').toLowerCase().includes(term)
      );
    }

    // Supplier filter
    if (filterSuppliers.length > 0) {
      filtered = filtered.filter((p) => p.supplier_id && filterSuppliers.includes(p.supplier_id));
    }

    // Category filter
    if (filterCategories.length > 0) {
      filtered = filtered.filter((p) => filterCategories.includes(p.category));
    }

    // Tag filter
    if (filterTags.length > 0) {
      filtered = filtered.filter((p) => {
        const itemTags = p.recurring_product_tag_ids || (p.recurring_product_tag_id ? [p.recurring_product_tag_id] : []);
        return itemTags.some(tagId => filterTags.includes(tagId));
      });
    }

    // Handover filter
    if (filterHandovers.length > 0) {
      filtered = filtered.filter((p) => p.handover_to && filterHandovers.includes(p.handover_to));
    }

    // Unit filter
    if (filterUnits.length > 0) {
      filtered = filtered.filter((p) => p.unit && filterUnits.includes(p.unit));
    }

    // Date range filter
    if (filterDateFrom) {
      filtered = filtered.filter((p) => p.received_date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter((p) => p.received_date <= filterDateTo);
    }

    return filtered;
  }, [
    products,
    searchTerm,
    filterSuppliers,
    filterCategories,
    filterHandovers,
    filterUnits,
    filterDateFrom,
    filterDateTo,
    filterTags,
    showArchived
  ]);

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
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
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
                ? 'bg-purple-50 border-purple-200 text-purple-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold">
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
                onClick={() => exportRecurringProducts(filteredProducts)}
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
                  setFormData({
                    name: '',
                    category: '',
                    supplier_id: '',
                    recurring_product_tag_ids: [],
                    quantity_received: '',
                    unit: '',
                    received_date: new Date().toISOString().split('T')[0],
                    notes: '',
                    handover_to: '',
                    amount_paid: '',
                  });
                }}
                variant={showForm ? 'secondary' : 'primary'}
                size="sm"
                icon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                className={showForm ? "" : "bg-purple-600 hover:bg-purple-700 text-white"}
              >
                {showForm ? 'Close' : 'Add Product'}
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

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">From Date</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">To Date</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
        <ModernCard className="animate-slide-down border-purple-100 shadow-premium">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-purple-500" /> : <Plus className="w-5 h-5 text-green-500" />}
              {editingId ? 'Edit Recurring Product' : 'Add New Product'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="e.g., Plastic Packets"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="e.g., Packaging"
                />
              </div>

              <div>
                <SearchableTagDropdown
                  tags={recurringProductTags}
                  selectedIds={formData.recurring_product_tag_ids}
                  onChange={(selectedIds) => setFormData((prev) => ({ ...prev, recurring_product_tag_ids: selectedIds }))}
                  label="Product Tags *"
                  placeholder="Select tags..."
                  required
                  multiple
                  emptyMessage="No active tags available."
                  colorScheme="purple"
                  disabled={!canWrite}
                />
              </div>

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
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                >
                  <option value="">Select Supplier</option>
                  {suppliers
                    .filter((s) => s.supplier_type === 'recurring_product' || s.supplier_type === 'multiple')
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  <option value="add-new" className="text-purple-600 font-medium">➕ Add New Supplier</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity Received *</label>
                  <input
                    type="number"
                    value={formData.quantity_received}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    placeholder="1000"
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
                      const selectedUnit = recurringProductUnits.find(u => u.display_name === e.target.value);
                      if (selectedUnit && !selectedUnit.allows_decimal && formData.quantity_received) {
                        const numValue = parseFloat(formData.quantity_received);
                        if (!isNaN(numValue) && numValue % 1 !== 0) {
                          setFormData((prev) => ({ ...prev, quantity_received: Math.floor(numValue).toString() }));
                        }
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  >
                    <option value="">Select unit</option>
                    {recurringProductUnits.map((unit) => (
                      <option key={unit.id} value={unit.display_name}>
                        {unit.display_name} {unit.allows_decimal ? '(decimals)' : '(whole)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Received Date</label>
                <input
                  type="date"
                  value={formData.received_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, received_date: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid</label>
                  <input
                    type="number"
                    value={formData.amount_paid}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amount_paid: e.target.value || '' }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
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
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  >
                    <option value="">Select Person</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  rows={4}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
            <ModernButton
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData({
                  name: '',
                  category: '',
                  supplier_id: '',
                  recurring_product_tag_ids: [],
                  quantity_received: '',
                  unit: '',
                  received_date: new Date().toISOString().split('T')[0],
                  notes: '',
                  handover_to: '',
                  amount_paid: '',
                });
              }}
              variant="secondary"
            >
              Cancel
            </ModernButton>
            <ModernButton
              onClick={() => void handleSubmit()}
              loading={submitting}
              icon={<Save className="w-4 h-4" />}
              className="bg-purple-600 hover:bg-purple-700 text-white border-transparent"
            >
              {editingId ? 'Update Product' : 'Create Product'}
            </ModernButton>
          </div>
        </ModernCard>
      )}

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
                  onChange={(e) => setSupplierFormData((prev) => ({ ...prev, supplier_type: e.target.value as Supplier['supplier_type'] || 'recurring_product' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="recurring_product">Recurring Product</option>
                  <option value="raw_material">Raw Material</option>
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

      {/* Main Content Area */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Loading products...</p>
          </div>
        ) : (
          <>
            {filteredProducts.length === 0 ? (
              <ModernCard className="text-center py-12 bg-gray-50/50 border-dashed">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No products found</p>
              </ModernCard>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lot ID</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Available</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Edited</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-purple-50/30 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                              {product.lot_id}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{product.supplier_name || '—'}</td>
                          <td className="px-6 py-4">
                            <span className={`font-semibold ${product.quantity_available === 0 ? 'text-red-600' :
                              product.quantity_available < product.quantity_received * 0.2 ? 'text-amber-600' : 'text-green-600'
                              }`}>
                              {(() => {
                                const unit = recurringProductUnits.find(u => u.display_name === product.unit);
                                return (unit?.allows_decimal ?? false)
                                  ? product.quantity_available.toFixed(2)
                                  : Math.floor(product.quantity_available);
                              })()} {product.unit}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{product.received_date}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {product.updated_by_name ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{product.updated_by_name}</span>
                                <span className="text-xs text-gray-400">{new Date(product.updated_at).toLocaleDateString()}</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleViewDetails(product)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                                <Eye className="w-4 h-4" />
                              </button>
                              {canWrite && product.is_archived && (
                                <button onClick={() => handleUnarchive(product.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Unarchive">
                                  <ArchiveRestore className="w-4 h-4" />
                                </button>
                              )}
                              {canWrite && !product.is_archived && product.quantity_available <= 5 && (
                                <button onClick={() => handleArchive(product.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Archive">
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
                  {filteredProducts.map((product) => (
                    <ModernCard key={product.id} padding="sm" className="flex flex-col h-full">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900">{product.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block">
                              {product.lot_id}
                            </span>
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px]">
                              {product.category}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${product.quantity_available === 0 ? 'bg-red-100 text-red-700' :
                          product.quantity_available < product.quantity_received * 0.2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                          {(() => {
                            const unit = recurringProductUnits.find(u => u.display_name === product.unit);
                            return (unit?.allows_decimal ?? false)
                              ? product.quantity_available.toFixed(1)
                              : Math.floor(product.quantity_available);
                          })()} {product.unit}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600 mb-4 flex-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Supplier</span>
                          <span className="font-medium text-gray-900">{product.supplier_name || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Received</span>
                          <span className="font-medium text-gray-900">{product.quantity_received} {product.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Handover</span>
                          <span className="font-medium text-gray-900">{product.handover_to_name || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount</span>
                          <span className="font-medium text-gray-900">
                            {product.amount_paid ? `₹${product.amount_paid.toLocaleString('en-IN')}` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Date</span>
                          <span className="font-medium text-gray-900">{product.received_date}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                        <button
                          onClick={() => handleViewDetails(product)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        {canWrite && product.is_archived && (
                          <button
                            onClick={() => handleUnarchive(product.id)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canWrite && product.quantity_available <= 5 && !product.is_archived && (
                          <button
                            onClick={() => handleArchive(product.id)}
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
          </>
        )}
      </div>

      {/* Lot Details Modal */}
      {selectedProduct && (
        <LotDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedProduct(null);
          }}
          onEdit={handleEditFromModal}
          onDelete={() => setShowDeleteConfirm(selectedProduct.id)}
          lot={selectedProduct}
          type="recurring-product"
          isLocked={lockStatus[selectedProduct.id]?.locked || false}
          batchIds={lockStatus[selectedProduct.id]?.batchIds || []}
          canEdit={canWrite}
          onRefresh={async () => {
            await loadData();
            const updatedProducts = await fetchRecurringProducts(showArchived);
            const updated = updatedProducts.find(p => p.id === selectedProduct.id);
            if (updated) setSelectedProduct(updated);
          }}
        />
      )}

      {/* Info Dialog */}
      <InfoDialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title="Recurring Products Guide"
        message="Manage your recurring products (packaging, consumables) inventory here. Add new lots, track quantities, and archive lots with low stock (≤5). Use filters to find specific products quickly. Archived lots are hidden from production by default but can be viewed using the 'Show Archived' toggle."
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Recurring Product?</h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete this product? This action cannot be undone.
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
