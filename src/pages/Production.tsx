import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Package, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Search, X, Trash2, Edit, Eye, Filter, Download } from 'lucide-react';
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
  updateBatchQAStatus,
  moveBatchToProcessedGoods,
  checkProcessedGoodsExists,
  updateProductionBatchOutput,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { QuantityInputModal } from '../components/QuantityInputModal';
import { BatchDetailsModal } from '../components/BatchDetailsModal';
import { exportProductionBatches } from '../utils/excelExport';

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

interface KeyValuePair {
  key: string;
  value: string;
}

interface OutputFormData {
  product_type: string;
  quantity: number;
  unit: string;
  custom_unit: string;
  qa_status: 'approved' | 'rejected' | 'hold' | 'pending';
  qa_reason?: string;
  production_start_date?: string;
  production_end_date?: string;
  additional_information?: string;
  custom_fields?: KeyValuePair[];
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
    additional_information: '',
    custom_fields: [],
  });

  // Processed goods tracking
  const [processedGoodsMap, setProcessedGoodsMap] = useState<Record<string, boolean>>({});
  const [processedGoodsMapLoaded, setProcessedGoodsMapLoaded] = useState(false);
  const [updatingQAStatus, setUpdatingQAStatus] = useState<string | null>(null);
  const [movingToProcessed, setMovingToProcessed] = useState<string | null>(null);
  const [showLockConfirmation, setShowLockConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lockSuccess, setLockSuccess] = useState(false);

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

  // Check processed goods existence for all batches
  useEffect(() => {
    const checkProcessedGoods = async () => {
      setProcessedGoodsMapLoaded(false);
      const map: Record<string, boolean> = {};
      for (const batch of batches) {
        if (batch.is_locked) {
          try {
            const exists = await checkProcessedGoodsExists(batch.id);
            map[batch.id] = exists;
          } catch (err) {
            console.error(`Failed to check processed goods for batch ${batch.id}:`, err);
            map[batch.id] = false;
          }
        }
      }
      setProcessedGoodsMap(map);
      setProcessedGoodsMapLoaded(true);
    };

    if (batches.length > 0) {
      void checkProcessedGoods();
    } else {
      setProcessedGoodsMapLoaded(true);
    }
  }, [batches]);

  const resetWizard = () => {
    setCurrentStep('start');
    setCurrentBatch(null);
    setBatchFormData({ responsible_user_id: '', notes: '' });
    setOutputFormData({ product_type: '', quantity: 0, unit: 'Kg.', custom_unit: '', qa_status: 'approved', qa_reason: '', production_start_date: '', production_end_date: '', additional_information: '', custom_fields: [] });
    setSelectedRawMaterials([]);
    setSelectedRecurringProducts([]);
    setEditingBatchItem(null);
    setLotIdSearch('');
    setRecurringProductSearch('');
    setError(null);
    setShowLockConfirmation(false);
    setSaveSuccess(false);
    setLockSuccess(false);
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
    const standardUnits = ['Kg.', 'Gm.', 'Ltr', 'Pieces', 'Boxes', 'Bottle'];
    const batchUnit = batch.output_unit || 'Kg.';
    const isStandardUnit = standardUnits.includes(batchUnit);
    
    // Parse custom_fields from JSON if it exists
    let customFields: KeyValuePair[] = [];
    if (batch.custom_fields) {
      try {
        if (typeof batch.custom_fields === 'string') {
          customFields = JSON.parse(batch.custom_fields);
        } else if (Array.isArray(batch.custom_fields)) {
          customFields = batch.custom_fields;
        }
      } catch (e) {
        console.error('Failed to parse custom_fields:', e);
        customFields = [];
      }
    }
    
    setOutputFormData({
      product_type: batch.output_product_type || '',
      quantity: batch.output_quantity || 0,
      unit: isStandardUnit ? batchUnit : 'Other',
      custom_unit: isStandardUnit ? '' : batchUnit,
      qa_status: (batch.qa_status as 'approved' | 'rejected' | 'hold') || 'approved',
      qa_reason: batch.qa_reason || '',
      production_start_date: batch.production_start_date || '',
      production_end_date: batch.production_end_date || '',
      additional_information: batch.additional_information || '',
      custom_fields: customFields,
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
      
      // If editing, remove the old entry first (even if materialId changed)
      if (editingBatchItem && editingBatchItem.type === 'raw-material') {
        await deleteBatchRawMaterial(editingBatchItem.id, editingBatchItem.materialId, editingBatchItem.quantity);
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
      
      // If editing, remove the old entry first (even if productId changed)
      if (editingBatchItem && editingBatchItem.type === 'recurring-product') {
        await deleteBatchRecurringProduct(editingBatchItem.id, editingBatchItem.materialId, editingBatchItem.quantity);
        setEditingBatchItem(null);
      }

      await addBatchRecurringProduct(currentBatch.id, productId, quantity);

      // Refresh data to show updated quantities and selected products
      await Promise.all([loadData(), loadSelectedRecurringProducts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recurring product');
    }
  };

  const saveBatch = async () => {
    if (!currentBatch || !outputFormData.product_type || outputFormData.quantity <= 0) {
      setError('Please fill in all output details');
      return;
    }

    // Validate custom unit if "Other" is selected
    if (outputFormData.unit === 'Other' && !outputFormData.custom_unit.trim()) {
      setError('Please specify the custom unit');
      return;
    }

    // Validate production dates
    if (!outputFormData.production_start_date || !outputFormData.production_end_date) {
      setError('Please fill in production start and end dates');
      return;
    }

    // Validate QA reason if hold or rejected
    if ((outputFormData.qa_status === 'hold' || outputFormData.qa_status === 'rejected') && !outputFormData.qa_reason?.trim()) {
      setError('Please provide a reason for ' + (outputFormData.qa_status === 'hold' ? 'holding' : 'rejecting') + ' this batch');
      return;
    }

    try {
      setError(null);
      // Use custom_unit if "Other" is selected, otherwise use the selected unit
      const unitValue = outputFormData.unit === 'Other' ? outputFormData.custom_unit.trim() : outputFormData.unit;
      
      // Filter out empty custom fields before saving
      const validCustomFields = (outputFormData.custom_fields || []).filter(f => f.key.trim() !== '');

      await updateProductionBatchOutput(currentBatch.id, {
        product_type: outputFormData.product_type,
        quantity: outputFormData.quantity,
        unit: unitValue,
        qa_status: outputFormData.qa_status,
        qa_reason: outputFormData.qa_reason,
        production_start_date: outputFormData.production_start_date,
        production_end_date: outputFormData.production_end_date,
        additional_information: outputFormData.additional_information || '',
        custom_fields: validCustomFields.length > 0 ? validCustomFields : undefined,
      });

      // Refresh data but keep wizard open
      await loadData();
      // Reload current batch to get updated data
      const updatedBatches = await fetchProductionBatches();
      const updatedBatch = updatedBatches.find(b => b.id === currentBatch.id);
      if (updatedBatch) {
        setCurrentBatch(updatedBatch);
      }
      
      // Show success message
      setError(null);
      setSaveSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save batch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save batch';
      setError(errorMessage);
    }
  };

  const handleLockBatch = () => {
    // Validate QA status - cannot lock if not set, pending, or hold
    if (!outputFormData.qa_status || outputFormData.qa_status === 'pending') {
      setError('QA status is pending. Please set it to approved or rejected before locking.');
      return;
    }
    
    if (outputFormData.qa_status === 'hold') {
      setError('QA status is hold. Hold state batches cannot be locked. Please approve or reject the batch first.');
      return;
    }
    
    setShowLockConfirmation(true);
  };

  const lockBatch = async () => {
    if (!currentBatch || !outputFormData.product_type || outputFormData.quantity <= 0) {
      setError('Please fill in all output details');
      setShowLockConfirmation(false);
      return;
    }

    // Validate custom unit if "Other" is selected
    if (outputFormData.unit === 'Other' && !outputFormData.custom_unit.trim()) {
      setError('Please specify the custom unit');
      setShowLockConfirmation(false);
      return;
    }

    // Validate production dates
    if (!outputFormData.production_start_date || !outputFormData.production_end_date) {
      setError('Please fill in production start and end dates');
      setShowLockConfirmation(false);
      return;
    }

    // Validate QA reason if hold or rejected
    if ((outputFormData.qa_status === 'hold' || outputFormData.qa_status === 'rejected') && !outputFormData.qa_reason?.trim()) {
      setError('Please provide a reason for ' + (outputFormData.qa_status === 'hold' ? 'holding' : 'rejecting') + ' this batch');
      setShowLockConfirmation(false);
      return;
    }

    // Prevent locking if status is hold
    if (outputFormData.qa_status === 'hold') {
      setError('Hold status batches cannot be locked. Please approve or reject the batch first.');
      setShowLockConfirmation(false);
      return;
    }

    try {
      setError(null);
      setShowLockConfirmation(false);
      // Use custom_unit if "Other" is selected, otherwise use the selected unit
      const unitValue = outputFormData.unit === 'Other' ? outputFormData.custom_unit.trim() : outputFormData.unit;
      
      await completeProductionBatch(currentBatch.id, {
        product_type: outputFormData.product_type,
        quantity: outputFormData.quantity,
        unit: unitValue,
        qa_status: outputFormData.qa_status,
        qa_reason: outputFormData.qa_reason,
        production_start_date: outputFormData.production_start_date,
        production_end_date: outputFormData.production_end_date,
        additional_information: outputFormData.additional_information,
        custom_fields: outputFormData.custom_fields?.filter(f => f.key.trim() !== '') || [],
      });

      // Refresh data and close wizard
      await loadData();
      setShowWizard(false);
      resetWizard();
      
      // Show success message
      setLockSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setLockSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock batch');
    }
  };

  const handleUpdateQAStatus = async (batchId: string, newStatus: 'approved' | 'rejected' | 'hold') => {
    if (!canWrite) {
      setError('You do not have permission to update QA status');
      return;
    }

    try {
      setUpdatingQAStatus(batchId);
      setError(null);
      await updateBatchQAStatus(batchId, newStatus);
      await loadData();
      // Refresh processed goods map
      const exists = await checkProcessedGoodsExists(batchId);
      setProcessedGoodsMap(prev => ({ ...prev, [batchId]: exists }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update QA status');
    } finally {
      setUpdatingQAStatus(null);
    }
  };

  const handleMoveToProcessedGoods = async (batchId: string) => {
    if (!canWrite) {
      setError('You do not have permission to move batch to processed goods');
      return;
    }

    const batch = batches.find(b => b.id === batchId);
    if (!batch) {
      setError('Batch not found');
      return;
    }

    // Validate batch has output data
    if (!batch.output_product_type || !batch.output_quantity || !batch.output_unit) {
      setError('Batch does not have complete output data. Cannot create processed goods.');
      return;
    }

    try {
      setMovingToProcessed(batchId);
      setError(null);
      await moveBatchToProcessedGoods(batchId);
      await loadData();
      // Update processed goods map
      setProcessedGoodsMap(prev => ({ ...prev, [batchId]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move batch to processed goods');
    } finally {
      setMovingToProcessed(null);
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
                  Production Start Date *
                </label>
                <input
                  type="date"
                  value={outputFormData.production_start_date}
                  onChange={(e) => setOutputFormData(prev => ({ ...prev, production_start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Production End Date *
                </label>
                <input
                  type="date"
                  value={outputFormData.production_end_date}
                  onChange={(e) => setOutputFormData(prev => ({ ...prev, production_end_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Dynamic Key-Value Fields */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Fields
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOutputFormData(prev => ({
                      ...prev,
                      custom_fields: [...(prev.custom_fields || []), { key: '', value: '' }]
                    }));
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Field
                </button>
              </div>

              {(!outputFormData.custom_fields || outputFormData.custom_fields.length === 0) ? (
                <p className="text-sm text-gray-500 italic">No custom fields added. Click "Add Field" to add key-value pairs.</p>
              ) : (
                <div className="space-y-3">
                  {outputFormData.custom_fields.map((field, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={field.key}
                          onChange={(e) => {
                            const newFields = [...(outputFormData.custom_fields || [])];
                            newFields[index].key = e.target.value;
                            setOutputFormData(prev => ({ ...prev, custom_fields: newFields }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                          placeholder="temperature / pH value / TDS"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => {
                            const newFields = [...(outputFormData.custom_fields || [])];
                            newFields[index].value = e.target.value;
                            setOutputFormData(prev => ({ ...prev, custom_fields: newFields }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                          placeholder="20°C / 7.4"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newFields = (outputFormData.custom_fields || []).filter((_, i) => i !== index);
                          setOutputFormData(prev => ({ ...prev, custom_fields: newFields }));
                        }}
                        className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove field"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                disabled={
                  !outputFormData.product_type || 
                  outputFormData.quantity <= 0 || 
                  (outputFormData.unit === 'Other' && !outputFormData.custom_unit.trim()) ||
                  !outputFormData.production_start_date ||
                  !outputFormData.production_end_date ||
                  ((outputFormData.qa_status === 'hold' || outputFormData.qa_status === 'rejected') && !outputFormData.qa_reason?.trim())
                }
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
            {/* QA Status Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">QA Status</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    QA Status *
                  </label>
                  <select
                    value={outputFormData.qa_status}
                    onChange={(e) => setOutputFormData(prev => ({ 
                      ...prev, 
                      qa_status: e.target.value as 'approved' | 'rejected' | 'hold' | 'pending',
                      qa_reason: (e.target.value === 'approved') ? '' : prev.qa_reason
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="approved">Approved - Ready for Sale</option>
                    <option value="hold">Hold - Further Processing Needed</option>
                    <option value="rejected">Rejected - Not Good for Sale</option>
                  </select>
                </div>

                {(outputFormData.qa_status === 'hold' || outputFormData.qa_status === 'rejected') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for {outputFormData.qa_status === 'hold' ? 'Hold' : 'Rejection'} *
                    </label>
                    <textarea
                      value={outputFormData.qa_reason}
                      onChange={(e) => setOutputFormData(prev => ({ ...prev, qa_reason: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder={`Please provide a reason for ${outputFormData.qa_status === 'hold' ? 'holding' : 'rejecting'} this batch...`}
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {(!outputFormData.qa_status || outputFormData.qa_status === 'hold' || outputFormData.qa_status === 'pending') && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {outputFormData.qa_status === 'hold' ? 'Hold Status - Cannot Lock' : 'QA Status Invalid - Cannot Lock'}
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      {outputFormData.qa_status === 'hold' 
                        ? 'QA status is hold. Hold state batches cannot be locked. Please approve or reject the batch first.'
                        : outputFormData.qa_status === 'pending'
                        ? 'QA status is pending. Please set it to approved or rejected before locking.'
                        : 'Please set QA status to approved or rejected before locking.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {outputFormData.qa_status !== 'hold' && outputFormData.qa_status && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Ready to Lock Batch
                    </h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Once locked, the batch cannot be edited. {outputFormData.qa_status === 'approved' ? 'Approved batches will be moved to Processed Goods.' : 'Rejected batches will not be moved to Processed Goods.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                  <span className="text-gray-600">Production Start Date:</span>
                  <span>{outputFormData.production_start_date || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Production End Date:</span>
                  <span>{outputFormData.production_end_date || '—'}</span>
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
                {(outputFormData.qa_status === 'hold' || outputFormData.qa_status === 'rejected') && outputFormData.qa_reason && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reason:</span>
                    <span className="text-gray-900 text-right max-w-xs">{outputFormData.qa_reason}</span>
                  </div>
                )}
                {outputFormData.additional_information && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Additional Information:</span>
                    <span className="text-gray-900 text-right max-w-xs">{outputFormData.additional_information}</span>
                  </div>
                )}
                {outputFormData.custom_fields && outputFormData.custom_fields.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-gray-600 block mb-2">Custom Fields:</span>
                    <div className="space-y-1">
                      {outputFormData.custom_fields.map((field, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-600 font-medium">{field.key}:</span>
                          <span className="text-gray-900">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </dl>
            </div>

            {/* Additional Information Field */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Information
              </label>
              <textarea
                value={outputFormData.additional_information || ''}
                onChange={(e) => setOutputFormData(prev => ({ ...prev, additional_information: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Enter any additional information about this production batch..."
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <button
                onClick={() => setCurrentStep('output')}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={saveBatch}
                  className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleLockBatch}
                  disabled={outputFormData.qa_status === 'hold' || outputFormData.qa_status === 'pending' || !outputFormData.qa_status}
                  className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  Lock Batch
                </button>
              </div>
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
        <div className="flex justify-end gap-2">
          <button
            onClick={() => exportProductionBatches(filteredBatches)}
            className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            title="Export to Excel"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Export</span>
          </button>
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

      {/* Search and Filters for Batches - Only show when wizard is not open */}
      {!showWizard && (
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
      )}

      {/* Production Batch Wizard */}
      {showWizard && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                {currentBatch ? `Edit Production Batch: ${currentBatch.batch_id}` : 'Create Production Batch'}
              </h2>
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
          onSubmit={async (quantity) => {
            try {
              if (modalConfig.type === 'raw-material') {
                await addRawMaterialToBatch(modalConfig.itemId, quantity);
              } else {
                await addRecurringProductToBatch(modalConfig.itemId, quantity);
              }
              // Close modal after successful submission
              setShowQuantityModal(false);
              setModalConfig(null);
              setEditingBatchItem(null);
            } catch (err) {
              // Error is already handled in the add functions
              // Modal stays open so user can retry
            }
          }}
          title={`Add ${modalConfig.type === 'raw-material' ? 'Raw Material' : 'Packaging'} to Batch`}
          itemName={modalConfig.itemName}
          lotId={modalConfig.lotId}
          maxQuantity={modalConfig.maxQuantity}
          unit={modalConfig.unit}
        />
      )}

      {/* Desktop Table View - Only show when wizard is not open */}
      {!showWizard && (
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleViewBatchDetails(batch)}
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden xl:inline">View</span>
                      </button>
                      {batch.is_locked && canWrite && processedGoodsMapLoaded && !processedGoodsMap[batch.id] && batch.output_product_type && batch.output_quantity && batch.output_unit && (
                        <button
                          onClick={() => void handleMoveToProcessedGoods(batch.id)}
                          disabled={movingToProcessed === batch.id}
                          className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                          title="Move to Processed Goods"
                        >
                          {movingToProcessed === batch.id ? 'Moving...' : 'Move to Processed'}
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
      )}

      {/* Mobile Card View - Only show when wizard is not open */}
      {!showWizard && (
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

              <div className="pt-2 border-t border-gray-100 space-y-2">
                {batch.is_locked && canWrite && processedGoodsMapLoaded && !processedGoodsMap[batch.id] && batch.output_product_type && batch.output_quantity && batch.output_unit && (
                  <button
                    onClick={() => void handleMoveToProcessedGoods(batch.id)}
                    disabled={movingToProcessed === batch.id}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {movingToProcessed === batch.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Moving...
                      </>
                    ) : (
                      'Move to Processed Goods'
                    )}
                  </button>
                )}
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
      )}

      {/* Success Dialogs */}
      {saveSuccess && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setSaveSuccess(false)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-center">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Saved Successfully
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        The batch has been saved successfully. You can continue editing or lock it when ready.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setSaveSuccess(false)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {lockSuccess && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setLockSuccess(false)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-center">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Locked Successfully
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        The batch has been locked successfully. {outputFormData.qa_status === 'approved' ? 'It has been moved to Processed Goods.' : 'It will not be moved to Processed Goods.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setLockSuccess(false)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lock Confirmation Modal */}
      {showLockConfirmation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowLockConfirmation(false)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Lock Production Batch
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Once locked, the batch cannot be edited.
                      </p>
                      <p className="text-sm text-gray-500">
                        This action cannot be undone.
                      </p>
                      {outputFormData.qa_status === 'approved' && (
                        <p className="text-sm text-green-600 mt-2">
                          Approved batches will be moved to Processed Goods.
                        </p>
                      )}
                      {outputFormData.qa_status === 'rejected' && (
                        <p className="text-sm text-red-600 mt-2">
                          Rejected batches will not be moved to Processed Goods.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={lockBatch}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Confirm Lock
                </button>
                <button
                  type="button"
                  onClick={() => setShowLockConfirmation(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          onMoveToProcessedGoods={canWrite ? handleMoveToProcessedGoods : undefined}
          processedGoodsExists={selectedBatch ? processedGoodsMap[selectedBatch.id] : false}
          movingToProcessed={selectedBatch ? movingToProcessed === selectedBatch.id : false}
        />
      )}
    </div>
  );
}