import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Package, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Search, X, Trash2, Edit, Eye, Filter } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  ProductionBatch,
  RawMaterial,
  RecurringProduct,
  BatchRawMaterial,
  BatchRecurringProduct,
} from '../types/operations';
import {
  createProductionBatch,
  fetchProductionBatches,
  addBatchRawMaterial,
  addBatchRecurringProduct,
  completeProductionBatch,
  fetchRawMaterials,
  fetchRecurringProducts,
  fetchUsers,
  fetchBatchRawMaterials,
  fetchBatchRecurringProducts,
  deleteBatchRawMaterial,
  deleteBatchRecurringProduct,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { QuantityInputModal } from '../components/QuantityInputModal';
import { BatchDetailsModal } from '../components/BatchDetailsModal';

interface ProductionProps {
  accessLevel: AccessLevel;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

// Step definitions
type Step = 'start' | 'raw-materials' | 'recurring-products' | 'output' | 'complete';

interface BatchFormData {
  responsible_user_id: string;
  notes: string;
}

interface OutputFormData {
  product_type: string;
  quantity: number;
  unit: string;
  custom_unit: string;
  qa_status: 'approved' | 'rejected' | 'hold';
}

export function Production({ accessLevel }: ProductionProps) {
  const { userId } = useModuleAccess();
  const canWrite = accessLevel === 'read-write';

  // State
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [recurringProducts, setRecurringProducts] = useState<RecurringProduct[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRawMaterials, setSelectedRawMaterials] = useState<BatchRawMaterial[]>([]);
  const [selectedRecurringProducts, setSelectedRecurringProducts] = useState<BatchRecurringProduct[]>([]);
  const [lotIdSearch, setLotIdSearch] = useState<string>('');
  const [recurringProductSearch, setRecurringProductSearch] = useState<string>('');
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [selectedBatchRawMaterials, setSelectedBatchRawMaterials] = useState<BatchRawMaterial[]>([]);
  const [selectedBatchRecurringProducts, setSelectedBatchRecurringProducts] = useState<BatchRecurringProduct[]>([]);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('start');
  const [currentBatch, setCurrentBatch] = useState<ProductionBatch | null>(null);

  // Modal state
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    type: 'raw-material' | 'recurring-product';
    itemId: string;
    itemName: string;
    lotId: string;
    maxQuantity: number;
    unit: string;
  } | null>(null);

  // Form data
  const [batchFormData, setBatchFormData] = useState<BatchFormData>({
    responsible_user_id: '',
    notes: '',
  });

  const [outputFormData, setOutputFormData] = useState<OutputFormData>({
    product_type: '',
    quantity: 0,
    unit: 'Kg.',
    custom_unit: '',
    qa_status: 'approved',
  });

  // Search and filter states for batches list
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [filterResponsible, setFilterResponsible] = useState<string>('all');
  const [filterQAStatus, setFilterQAStatus] = useState<string>('all');
  const [filterLockStatus, setFilterLockStatus] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showBatchFilters, setShowBatchFilters] = useState(false);

  const steps = [
    { id: 'start' as Step, name: 'Start Batch', description: 'Create new production batch' },
    { id: 'raw-materials' as Step, name: 'Raw Materials', description: 'Select raw materials to consume' },
    { id: 'recurring-products' as Step, name: 'Packaging', description: 'Select packaging materials' },
    { id: 'output' as Step, name: 'Output', description: 'Define finished product' },
    { id: 'complete' as Step, name: 'Complete', description: 'Finalize production batch' },
  ];

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [batchesData, rawMaterialsData, recurringProductsData, usersData] = await Promise.all([
        fetchProductionBatches(),
        fetchRawMaterials(),
        fetchRecurringProducts(),
        fetchUsers(),
      ]);

      setBatches(batchesData);
      setRawMaterials(rawMaterialsData);
      setRecurringProducts(recurringProductsData);
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

  const resetWizard = () => {
    setCurrentStep('start');
    setCurrentBatch(null);
    setBatchFormData({ responsible_user_id: '', notes: '' });
    setOutputFormData({ product_type: '', quantity: 0, unit: 'Kg.', custom_unit: '', qa_status: 'approved' });
  };

  const startNewBatch = async () => {
    if (!canWrite || !userId || !batchFormData.responsible_user_id) {
      setError('Please select a responsible user');
      return;
    }

    try {
      setError(null);
      const batchData = {
        responsible_user_id: batchFormData.responsible_user_id,
        responsible_user_name: users.find(u => u.id === batchFormData.responsible_user_id)?.full_name || '',
        notes: batchFormData.notes || undefined,
        created_by: userId,
      };

      const newBatch = await createProductionBatch(batchData);
      setCurrentBatch(newBatch);
      setCurrentStep('raw-materials');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch');
    }
  };

  const handleViewBatchDetails = async (batch: ProductionBatch) => {
    setSelectedBatch(batch);
    setShowBatchDetailsModal(true);

    // Load batch raw materials and recurring products
    try {
      const [rawMaterialsData, recurringProductsData] = await Promise.all([
        fetchBatchRawMaterials(batch.id),
        fetchBatchRecurringProducts(batch.id),
      ]);
      setSelectedBatchRawMaterials(rawMaterialsData);
      setSelectedBatchRecurringProducts(recurringProductsData);
    } catch (err) {
      console.error('Failed to load batch details:', err);
      setSelectedBatchRawMaterials([]);
      setSelectedBatchRecurringProducts([]);
    }
  };

  const handleEditBatchFromModal = () => {
    if (!selectedBatch) return;
    
    if (selectedBatch.is_locked) {
      setError('Cannot edit locked batch. This batch has been completed.');
      return;
    }

    handleEditBatch(selectedBatch);
  };

  const handleEditBatch = (batch: ProductionBatch) => {
    if (batch.is_locked) {
      setError('Cannot edit locked batch. This batch has been completed.');
      return;
    }

    setCurrentBatch(batch);
    setBatchFormData({
      responsible_user_id: batch.responsible_user_id || '',
      notes: batch.notes || '',
    });
    setOutputFormData({
      product_type: batch.output_product_type || '',
      quantity: batch.output_quantity || 0,
      unit: batch.output_unit || 'Kg.',
      custom_unit: ['Kg.', 'Gm.', 'Ltr', 'Pieces', 'Boxes', 'Bottle'].includes(batch.output_unit || '') ? '' : (batch.output_unit || ''),
      qa_status: (batch.qa_status as 'approved' | 'rejected' | 'hold') || 'approved',
    });
    setCurrentStep('raw-materials');
    setShowWizard(true);
  };

  const loadSelectedRawMaterials = async () => {
    if (!currentBatch) {
      setSelectedRawMaterials([]);
      return;
    }

    try {
      const selected = await fetchBatchRawMaterials(currentBatch.id);
      setSelectedRawMaterials(selected);
    } catch (err) {
      console.error('Failed to load selected raw materials:', err);
      setSelectedRawMaterials([]);
    }
  };

  const loadSelectedRecurringProducts = async () => {
    if (!currentBatch) {
      setSelectedRecurringProducts([]);
      return;
    }

    try {
      const selected = await fetchBatchRecurringProducts(currentBatch.id);
      setSelectedRecurringProducts(selected);
    } catch (err) {
      console.error('Failed to load selected recurring products:', err);
      setSelectedRecurringProducts([]);
    }
  };

  useEffect(() => {
    if (currentBatch && currentStep === 'raw-materials') {
      void loadSelectedRawMaterials();
    }
    if (currentBatch && currentStep === 'recurring-products') {
      void loadSelectedRecurringProducts();
    }
    // Reset search when switching steps
    if (currentStep !== 'raw-materials') {
      setLotIdSearch('');
    }
    if (currentStep !== 'recurring-products') {
      setRecurringProductSearch('');
    }
  }, [currentBatch?.id, currentStep]);

  const removeRawMaterialFromBatch = async (batchRawMaterialId: string, rawMaterialId: string, quantity: number) => {
    if (!currentBatch || currentBatch.is_locked) {
      setError('Cannot modify locked batch.');
      return;
    }

    try {
      setError(null);
      await deleteBatchRawMaterial(batchRawMaterialId, rawMaterialId, quantity);
      await Promise.all([loadData(), loadSelectedRawMaterials()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove raw material');
    }
  };

  const [editingBatchItem, setEditingBatchItem] = useState<{ type: 'raw-material' | 'recurring-product'; id: string; materialId: string; quantity: number } | null>(null);

  const editRawMaterialInBatch = (selected: BatchRawMaterial) => {
    if (!currentBatch || currentBatch.is_locked) {
      setError('Cannot modify locked batch.');
      return;
    }

    const material = rawMaterials.find(m => m.id === selected.raw_material_id);
    if (!material) return;

    // Store the item being edited so we can remove it after new quantity is confirmed
    setEditingBatchItem({
      type: 'raw-material',
      id: selected.id,
      materialId: selected.raw_material_id,
      quantity: selected.quantity_consumed,
    });

    setModalConfig({
      type: 'raw-material',
      itemId: selected.raw_material_id,
      itemName: selected.raw_material_name,
      lotId: selected.lot_id,
      maxQuantity: material.quantity_available + selected.quantity_consumed, // Add back the consumed quantity
      unit: selected.unit,
    });
    setShowQuantityModal(true);
  };

  const removeRecurringProductFromBatch = async (batchRecurringProductId: string, recurringProductId: string, quantity: number) => {
    if (!currentBatch || currentBatch.is_locked) {
      setError('Cannot modify locked batch.');
      return;
    }

    try {
      setError(null);
      await deleteBatchRecurringProduct(batchRecurringProductId, recurringProductId, quantity);
      await Promise.all([loadData(), loadSelectedRecurringProducts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove recurring product');
    }
  };

  const editRecurringProductInBatch = (selected: BatchRecurringProduct) => {
    if (!currentBatch || currentBatch.is_locked) {
      setError('Cannot modify locked batch.');
      return;
    }

    const product = recurringProducts.find(p => p.id === selected.recurring_product_id);
    if (!product) return;

    // Store the item being edited so we can remove it after new quantity is confirmed
    setEditingBatchItem({
      type: 'recurring-product',
      id: selected.id,
      materialId: selected.recurring_product_id,
      quantity: selected.quantity_consumed,
    });

    setModalConfig({
      type: 'recurring-product',
      itemId: selected.recurring_product_id,
      itemName: selected.recurring_product_name,
      lotId: product.lot_id || '',
      maxQuantity: product.quantity_available + selected.quantity_consumed,
      unit: selected.unit,
    });
    setShowQuantityModal(true);
  };

  const addRawMaterialToBatch = async (materialId: string, quantity: number) => {
    if (!currentBatch) {
      setError('No batch selected. Please create a batch first.');
      return;
    }

    if (currentBatch.is_locked) {
      setError('Cannot modify locked batch. This batch has been completed.');
      return;
    }

    try {
      setError(null);
      
      // If editing, remove the old entry first
      if (editingBatchItem && editingBatchItem.type === 'raw-material' && editingBatchItem.materialId === materialId) {
        await deleteBatchRawMaterial(editingBatchItem.id, materialId, editingBatchItem.quantity);
        setEditingBatchItem(null);
      }

      await addBatchRawMaterial(currentBatch.id, materialId, quantity);

      // Refresh data to show updated quantities and selected materials
      await Promise.all([loadData(), loadSelectedRawMaterials()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add raw material');
    }
  };

  const addRecurringProductToBatch = async (productId: string, quantity: number) => {
    if (!currentBatch) {
      setError('No batch selected. Please create a batch first.');
      return;
    }

    if (currentBatch.is_locked) {
      setError('Cannot modify locked batch. This batch has been completed.');
      return;
    }

    try {
      setError(null);
      
      // If editing, remove the old entry first
      if (editingBatchItem && editingBatchItem.type === 'recurring-product' && editingBatchItem.materialId === productId) {
        await deleteBatchRecurringProduct(editingBatchItem.id, productId, editingBatchItem.quantity);
        setEditingBatchItem(null);
      }

      await addBatchRecurringProduct(currentBatch.id, productId, quantity);

      // Refresh data to show updated quantities and selected products
      await Promise.all([loadData(), loadSelectedRecurringProducts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recurring product');
    }
  };

  const finalizeBatch = async () => {
    if (!currentBatch || !outputFormData.product_type || outputFormData.quantity <= 0) {
      setError('Please fill in all output details');
      return;
    }

    // Validate custom unit if "Other" is selected
    if (outputFormData.unit === 'Other' && !outputFormData.custom_unit.trim()) {
      setError('Please specify the custom unit');
      return;
    }

    try {
      setError(null);
      // Use custom_unit if "Other" is selected, otherwise use the selected unit
      const unitValue = outputFormData.unit === 'Other' ? outputFormData.custom_unit.trim() : outputFormData.unit;
      
      await completeProductionBatch(currentBatch.id, {
        product_type: outputFormData.product_type,
        quantity: outputFormData.quantity,
        unit: unitValue,
        qa_status: outputFormData.qa_status,
      });

      // Refresh data and close wizard
      await loadData();
      setShowWizard(false);
      resetWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete batch');
    }
  };

  // Filter and search logic for batches
  const filteredBatches = useMemo(() => {
    let filtered = [...batches];

    // Search filter
    if (batchSearchTerm.trim()) {
      const term = batchSearchTerm.toLowerCase();
      filtered = filtered.filter((b) =>
        b.batch_id.toLowerCase().includes(term) ||
        (b.output_product_type || '').toLowerCase().includes(term) ||
        (b.responsible_user_name || '').toLowerCase().includes(term) ||
        (b.notes || '').toLowerCase().includes(term)
      );
    }

    // Responsible user filter
    if (filterResponsible !== 'all') {
      filtered = filtered.filter((b) => b.responsible_user_id === filterResponsible);
    }

    // QA Status filter
    if (filterQAStatus !== 'all') {
      filtered = filtered.filter((b) => b.qa_status === filterQAStatus);
    }

    // Lock status filter
    if (filterLockStatus !== 'all') {
      if (filterLockStatus === 'locked') {
        filtered = filtered.filter((b) => b.is_locked === true);
      } else if (filterLockStatus === 'draft') {
        filtered = filtered.filter((b) => b.is_locked === false);
      }
    }

    // Date range filter
    if (filterDateFrom) {
      filtered = filtered.filter((b) => b.batch_date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter((b) => b.batch_date <= filterDateTo);
    }

    return filtered;
  }, [batches, batchSearchTerm, filterResponsible, filterQAStatus, filterLockStatus, filterDateFrom, filterDateTo]);

  const renderStepIndicator = () => (
    <div className="mb-6 md:mb-8">
      {/* Mobile: Vertical Steps */}
      <div className="md:hidden space-y-4">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
          return (
            <div key={step.id} className="flex items-start gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 ${
                isActive
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : isCompleted
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-gray-300 text-gray-300'
              }`}>
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              <div className="flex-1 pt-1">
                <p className={`text-sm font-medium ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Desktop: Horizontal Steps */}
      <div className="hidden md:flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              currentStep === step.id
                ? 'bg-blue-600 border-blue-600 text-white'
                : steps.findIndex(s => s.id === currentStep) > index
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'border-gray-300 text-gray-300'
            }`}>
              {steps.findIndex(s => s.id === currentStep) > index ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            <div className="ml-3 hidden lg:block">
              <p className={`text-sm font-medium ${
                currentStep === step.id ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step.name}
              </p>
              <p className="text-xs text-gray-400">{step.description}</p>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="w-5 h-5 text-gray-300 mx-4 hidden md:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'start':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Responsible User *
              </label>
              <select
                value={batchFormData.responsible_user_id}
                onChange={(e) => setBatchFormData(prev => ({ ...prev, responsible_user_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select responsible user</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={batchFormData.notes}
                onChange={(e) => setBatchFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional notes about this production batch"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
              <button
                onClick={() => {
                  setShowWizard(false);
                  resetWizard();
                }}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startNewBatch}
                disabled={!batchFormData.responsible_user_id}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Start Batch
              </button>
            </div>
          </div>
        );

      case 'raw-materials':
        // Get selected material IDs
        const selectedMaterialIds = new Set(selectedRawMaterials.map(s => s.raw_material_id));
        
        // Filter available materials (exclude already selected and apply search filter)
        const availableMaterials = rawMaterials.filter(material => {
          const matchesSearch = !lotIdSearch || 
            material.lot_id.toLowerCase().includes(lotIdSearch.toLowerCase()) ||
            material.name.toLowerCase().includes(lotIdSearch.toLowerCase());
          return !selectedMaterialIds.has(material.id) && matchesSearch;
        });

        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Select raw materials to consume in this production batch. You can add multiple materials from different lots.
              </p>
            </div>

            {/* Selected Raw Materials */}
            {selectedRawMaterials.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Selected Raw Materials</h3>
                <div className="space-y-2">
                  {selectedRawMaterials.map((selected) => {
                    const material = rawMaterials.find(m => m.id === selected.raw_material_id);
                    const isLocked = currentBatch?.is_locked || false;
                    return (
                      <div key={selected.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{selected.raw_material_name}</h4>
                            <p className="text-sm text-gray-600">
                              Lot: <span className="font-mono">{selected.lot_id}</span> | 
                              Quantity: <span className="font-semibold">{selected.quantity_consumed}</span> {selected.unit}
                            </p>
                            {material && (
                              <p className="text-xs text-gray-500 mt-1">
                                Remaining: {material.quantity_available} {material.unit}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isLocked ? (
                              <div title="Batch locked - cannot modify">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => editRawMaterialInBatch(selected)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit quantity"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Remove ${selected.raw_material_name} from batch?`)) {
                                      void removeRawMaterialFromBatch(selected.id, selected.raw_material_id, selected.quantity_consumed);
                                    }
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Remove from batch"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Raw Materials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Available Raw Materials</h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={lotIdSearch}
                    onChange={(e) => setLotIdSearch(e.target.value)}
                    placeholder="Search by Lot ID or Name..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  {lotIdSearch && (
                    <button
                      onClick={() => setLotIdSearch('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {availableMaterials.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {lotIdSearch 
                    ? `No materials found matching "${lotIdSearch}"`
                    : 'No available materials to add'}
                </div>
              ) : (
                <div className="space-y-4">
                  {availableMaterials.map(material => (
                    <div key={material.id} className={`border rounded-lg p-4 ${
                      material.quantity_available === 0 
                        ? 'border-gray-300 bg-gray-50 opacity-75' 
                        : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{material.name}</h4>
                          <p className={`text-sm ${
                            material.quantity_available === 0 
                              ? 'text-gray-500' 
                              : 'text-gray-600'
                          }`}>
                            Lot: <span className="font-mono">{material.lot_id}</span> | 
                            Available: {material.quantity_available} {material.unit}
                            {material.quantity_available === 0 && (
                              <span className="ml-2 text-xs text-red-600">(Lot exhausted - used in production)</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (currentBatch && material.quantity_available > 0) {
                              setModalConfig({
                                type: 'raw-material',
                                itemId: material.id,
                                itemName: material.name,
                                lotId: material.lot_id,
                                maxQuantity: material.quantity_available,
                                unit: material.unit,
                              });
                              setShowQuantityModal(true);
                            }
                          }}
                          disabled={!currentBatch || material.quantity_available === 0}
                          className={`px-3 py-1 text-sm rounded ${
                            currentBatch && material.quantity_available > 0
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          }`}
                        >
                          {material.quantity_available === 0 ? 'Lot Exhausted' : 'Add to Batch'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <button
                onClick={() => setCurrentStep('start')}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setCurrentStep('recurring-products')}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                Next: Packaging
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'recurring-products':
        // Get selected product IDs
        const selectedProductIds = new Set(selectedRecurringProducts.map(s => s.recurring_product_id));
        
        // Filter available products (exclude already selected and apply search filter)
        const availableProducts = recurringProducts.filter(product => {
          const matchesSearch = !recurringProductSearch || 
            (product.lot_id && product.lot_id.toLowerCase().includes(recurringProductSearch.toLowerCase())) ||
            product.name.toLowerCase().includes(recurringProductSearch.toLowerCase());
          return !selectedProductIds.has(product.id) && matchesSearch;
        });

        return (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                Select packaging and consumable materials for this production batch. You can add multiple products from different lots.
              </p>
            </div>

            {/* Selected Recurring Products */}
            {selectedRecurringProducts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Selected Packaging Materials</h3>
                <div className="space-y-2">
                  {selectedRecurringProducts.map((selected) => {
                    const product = recurringProducts.find(p => p.id === selected.recurring_product_id);
                    const isLocked = currentBatch?.is_locked || false;
                    return (
                      <div key={selected.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{selected.recurring_product_name}</h4>
                            <p className="text-sm text-gray-600">
                              Lot: <span className="font-mono">{product?.lot_id || 'N/A'}</span> | 
                              Quantity: <span className="font-semibold">{selected.quantity_consumed}</span> {selected.unit}
                            </p>
                            {product && (
                              <p className="text-xs text-gray-500 mt-1">
                                Remaining: {product.quantity_available} {product.unit}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isLocked ? (
                              <div title="Batch locked - cannot modify">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => editRecurringProductInBatch(selected)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit quantity"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Remove ${selected.recurring_product_name} from batch?`)) {
                                      void removeRecurringProductFromBatch(selected.id, selected.recurring_product_id, selected.quantity_consumed);
                                    }
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Remove from batch"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Recurring Products */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Available Packaging Materials</h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={recurringProductSearch}
                    onChange={(e) => setRecurringProductSearch(e.target.value)}
                    placeholder="Search by Lot ID or Name..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  />
                  {recurringProductSearch && (
                    <button
                      onClick={() => setRecurringProductSearch('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {availableProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {recurringProductSearch 
                    ? `No products found matching "${recurringProductSearch}"`
                    : 'No available products to add'}
                </div>
              ) : (
                <div className="space-y-4">
                  {availableProducts.map(product => (
                    <div key={product.id} className={`border rounded-lg p-4 ${
                      product.quantity_available === 0 
                        ? 'border-gray-300 bg-gray-50 opacity-75' 
                        : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{product.name}</h4>
                          <p className={`text-sm ${
                            product.quantity_available === 0 
                              ? 'text-gray-500' 
                              : 'text-gray-600'
                          }`}>
                            Lot: <span className="font-mono">{product.lot_id}</span> | 
                            Available: {product.quantity_available} {product.unit}
                            {product.quantity_available === 0 && (
                              <span className="ml-2 text-xs text-red-600">(Lot exhausted - used in production)</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (currentBatch && product.quantity_available > 0) {
                              setModalConfig({
                                type: 'recurring-product',
                                itemId: product.id,
                                itemName: product.name,
                                lotId: product.lot_id || '',
                                maxQuantity: product.quantity_available,
                                unit: product.unit,
                              });
                              setShowQuantityModal(true);
                            }
                          }}
                          disabled={!currentBatch || product.quantity_available === 0}
                          className={`px-3 py-1 text-sm rounded ${
                            currentBatch && product.quantity_available > 0
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          }`}
                        >
                          {product.quantity_available === 0 ? 'Lot Exhausted' : 'Add to Batch'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <button
                onClick={() => setCurrentStep('raw-materials')}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setCurrentStep('output')}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                Next: Define Output
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'output':
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                Define the finished product output from this production batch.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Type *
                </label>
                <input
                  type="text"
                  value={outputFormData.product_type}
                  onChange={(e) => setOutputFormData(prev => ({ ...prev, product_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Banana Khar, Fruit Jam"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity Produced *
                </label>
                <input
                  type="number"
                  value={outputFormData.quantity}
                  onChange={(e) => setOutputFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit *
                </label>
                <select
                  value={outputFormData.unit}
                  onChange={(e) => setOutputFormData(prev => ({ 
                    ...prev, 
                    unit: e.target.value,
                    custom_unit: e.target.value === 'Other' ? prev.custom_unit : ''
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Kg.">Kg.</option>
                  <option value="Gm.">Gm.</option>
                  <option value="Ltr">Ltr</option>
                  <option value="Pieces">Pieces</option>
                  <option value="Boxes">Boxes</option>
                  <option value="Bottle">Bottle</option>
                  <option value="Other">Other - Please Specify</option>
                </select>
                {outputFormData.unit === 'Other' && (
                  <input
                    type="text"
                    value={outputFormData.custom_unit}
                    onChange={(e) => setOutputFormData(prev => ({ ...prev, custom_unit: e.target.value }))}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Specify unit"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QA Status *
                </label>
                <select
                  value={outputFormData.qa_status}
                  onChange={(e) => setOutputFormData(prev => ({ ...prev, qa_status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="approved">Approved - Ready for Sale</option>
                  <option value="hold">Hold - Further Processing Needed</option>
                  <option value="rejected">Rejected - Not Good for Sale</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <button
                onClick={() => setCurrentStep('recurring-products')}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setCurrentStep('complete')}
                disabled={!outputFormData.product_type || outputFormData.quantity <= 0 || (outputFormData.unit === 'Other' && !outputFormData.custom_unit.trim())}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                Next: Complete Batch
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Ready to Complete Batch
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    This will lock the batch and {outputFormData.qa_status === 'approved' ? 'create processed goods inventory' : 'mark the batch as complete'}.
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Batch Summary</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Batch ID:</span>
                  <span className="font-mono">{currentBatch?.batch_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Responsible:</span>
                  <span>{currentBatch?.responsible_user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Product:</span>
                  <span>{outputFormData.product_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity:</span>
                  <span>{outputFormData.quantity} {outputFormData.unit === 'Other' ? outputFormData.custom_unit : outputFormData.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">QA Status:</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    outputFormData.qa_status === 'approved' ? 'bg-green-100 text-green-800' :
                    outputFormData.qa_status === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {outputFormData.qa_status}
                  </span>
                </div>
              </dl>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <button
                onClick={() => setCurrentStep('output')}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={finalizeBatch}
                className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
              >
                Complete Batch & Lock
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (accessLevel === 'no-access') {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">You don't have access to the Production module.</p>
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
              resetWizard();
              setShowWizard(true);
            }}
            className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Start New Batch</span>
            <span className="sm:hidden">New Batch</span>
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters for Batches */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={batchSearchTerm}
              onChange={(e) => setBatchSearchTerm(e.target.value)}
              placeholder="Search by batch ID, product type, responsible user..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {batchSearchTerm && (
              <button
                onClick={() => setBatchSearchTerm('')}
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
              setShowBatchFilters(!showBatchFilters);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 border-2 rounded-lg transition-all font-medium ${
              showBatchFilters || filterResponsible !== 'all' || filterQAStatus !== 'all' || filterLockStatus !== 'all' || filterDateFrom || filterDateTo
                ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
            {(filterResponsible !== 'all' || filterQAStatus !== 'all' || filterLockStatus !== 'all' || filterDateFrom || filterDateTo) && (
              <span className="bg-blue-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {[filterResponsible !== 'all', filterQAStatus !== 'all', filterLockStatus !== 'all', filterDateFrom, filterDateTo].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showBatchFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Responsible User
              </label>
              <select
                value={filterResponsible}
                onChange={(e) => setFilterResponsible(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                QA Status
              </label>
              <select
                value={filterQAStatus}
                onChange={(e) => setFilterQAStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="hold">Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Lock Status
              </label>
              <select
                value={filterLockStatus}
                onChange={(e) => setFilterLockStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="locked">Locked</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Batch Date From
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Batch Date To
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex items-end">
              <button
                onClick={() => {
                  setFilterResponsible('all');
                  setFilterQAStatus('all');
                  setFilterLockStatus('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                  setBatchSearchTerm('');
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Production Batch Wizard */}
      {showWizard && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">Create Production Batch</h2>
              <button
                onClick={() => {
                  setShowWizard(false);
                  resetWizard();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-4 md:px-6 py-4 md:py-6">
            {renderStepIndicator()}
            <div className="mt-6">
              {renderStepContent()}
            </div>
          </div>
        </div>
      )}

      {/* Quantity Input Modal */}
      {modalConfig && (
        <QuantityInputModal
          isOpen={showQuantityModal}
          onClose={() => {
            setShowQuantityModal(false);
            setModalConfig(null);
            setEditingBatchItem(null);
          }}
          onSubmit={(quantity) => {
            if (modalConfig.type === 'raw-material') {
              addRawMaterialToBatch(modalConfig.itemId, quantity);
            } else {
              addRecurringProductToBatch(modalConfig.itemId, quantity);
            }
          }}
          title={`Add ${modalConfig.type === 'raw-material' ? 'Raw Material' : 'Packaging'} to Batch`}
          itemName={modalConfig.itemName}
          lotId={modalConfig.lotId}
          maxQuantity={modalConfig.maxQuantity}
          unit={modalConfig.unit}
        />
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsible</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Output</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QA Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading batches...</span>
                  </div>
                </td>
              </tr>
            ) : filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="w-8 h-8 text-gray-400" />
                    <span>{batches.length === 0 ? 'No production batches found' : 'No batches match your filters'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 font-mono text-sm">{batch.batch_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{batch.batch_date}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{batch.responsible_user_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{batch.output_product_type || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {batch.output_quantity ? `${batch.output_quantity} ${batch.output_unit}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      batch.qa_status === 'approved' ? 'bg-green-100 text-green-800' :
                      batch.qa_status === 'rejected' ? 'bg-red-100 text-red-800' :
                      batch.qa_status === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {batch.qa_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      batch.is_locked ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {batch.is_locked ? 'Locked' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void handleViewBatchDetails(batch)}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden xl:inline">View</span>
                    </button>
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
              <span className="text-gray-500">Loading batches...</span>
            </div>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Package className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">{batches.length === 0 ? 'No production batches found' : 'No batches match your filters'}</span>
            </div>
          </div>
        ) : (
          filteredBatches.map((batch) => (
            <div key={batch.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-mono font-semibold text-gray-900 text-base">{batch.batch_id}</h3>
                  <p className="text-xs text-gray-500 mt-1">{batch.batch_date}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className={`px-2 py-1 rounded text-xs ${
                    batch.is_locked ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {batch.is_locked ? 'Locked' : 'Draft'}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    batch.qa_status === 'approved' ? 'bg-green-100 text-green-800' :
                    batch.qa_status === 'rejected' ? 'bg-red-100 text-red-800' :
                    batch.qa_status === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {batch.qa_status || 'pending'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Responsible:</span>
                  <span className="ml-1 text-gray-900">{batch.responsible_user_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Product:</span>
                  <span className="ml-1 text-gray-900">{batch.output_product_type || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Output:</span>
                  <span className="ml-1 text-gray-900">
                    {batch.output_quantity ? `${batch.output_quantity} ${batch.output_unit}` : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => void handleViewBatchDetails(batch)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Batch Details Modal */}
      {selectedBatch && (
        <BatchDetailsModal
          isOpen={showBatchDetailsModal}
          onClose={() => {
            setShowBatchDetailsModal(false);
            setSelectedBatch(null);
            setSelectedBatchRawMaterials([]);
            setSelectedBatchRecurringProducts([]);
          }}
          onEdit={handleEditBatchFromModal}
          batch={selectedBatch}
          rawMaterials={selectedBatchRawMaterials}
          recurringProducts={selectedBatchRecurringProducts}
          canEdit={canWrite}
        />
      )}
    </div>
  );
}