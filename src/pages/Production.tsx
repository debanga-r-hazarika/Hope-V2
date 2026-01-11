import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Package, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Search, X, Trash2, Edit, Eye, Filter, ArrowUpDown, Download, Save, Lock } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  ProductionBatch,
  RawMaterial,
  RecurringProduct,
  BatchRawMaterial,
  BatchRecurringProduct,
  BatchOutput,
} from '../types/operations';
import type { ProducedGoodsTag } from '../types/tags';
import {
  createProductionBatch,
  fetchProductionBatches,
  addBatchRawMaterial,
  addBatchRecurringProduct,
  completeProductionBatch,
  saveProductionBatch,
  fetchRawMaterials,
  fetchRecurringProducts,
  fetchUsers,
  fetchBatchRawMaterials,
  fetchBatchRecurringProducts,
  deleteBatchRawMaterial,
  deleteBatchRecurringProduct,
  fetchBatchOutputs,
  createBatchOutput,
  updateBatchOutput,
  deleteBatchOutput,
  deleteProductionBatch,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { QuantityInputModal } from '../components/QuantityInputModal';
import { BatchDetailsModal } from '../components/BatchDetailsModal';
import { fetchProducedGoodsTags } from '../lib/tags';
import { exportProductionBatches } from '../utils/excelExport';
import { SearchableTagDropdown } from '../components/SearchableTagDropdown';

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
  output_name: string;
  output_size?: number;
  output_size_unit?: string;
  produced_quantity: number;
  produced_unit: string;
  custom_produced_unit: string;
  produced_goods_tag_id: string;
}

interface BatchCompletionData {
  qa_status: 'approved' | 'rejected' | 'hold';
  production_start_date: string;
  production_end_date: string;
  qa_reason?: string;
  custom_fields: Array<{key: string, value: string}>;
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
  const [selectedBatchOutputs, setSelectedBatchOutputs] = useState<BatchOutput[]>([]);
  const [producedGoodsTags, setProducedGoodsTags] = useState<ProducedGoodsTag[]>([]);
  const [batchOutputsMap, setBatchOutputsMap] = useState<Map<string, BatchOutput[]>>(new Map());

  // Search, Filter, and Sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [qaStatusFilter, setQaStatusFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'batch_id' | 'qa_status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
    output_name: '',
    output_size: undefined,
    output_size_unit: '',
    produced_quantity: 0,
    produced_unit: 'Kg.',
    custom_produced_unit: '',
    produced_goods_tag_id: '',
  });

  const [batchCompletionData, setBatchCompletionData] = useState<BatchCompletionData>({
    qa_status: 'approved',
    production_start_date: '',
    production_end_date: '',
    qa_reason: '',
    custom_fields: [],
  });

  // State for managing multiple outputs in Step 4
  const [batchOutputs, setBatchOutputs] = useState<BatchOutput[]>([]);
  const [editingOutputIndex, setEditingOutputIndex] = useState<number | null>(null);

  const steps = [
    { id: 'start' as Step, name: 'Start Batch', description: 'Create new production batch' },
    { id: 'raw-materials' as Step, name: 'Raw Materials', description: 'Select raw materials to consume' },
    { id: 'recurring-products' as Step, name: 'Packaging', description: 'Select packaging materials' },
    { id: 'output' as Step, name: 'Output', description: 'Define finished product' },
    { id: 'complete' as Step, name: 'Complete', description: 'Finalize production batch' },
  ];

  // Filtered and sorted batches
  const filteredAndSortedBatches = useMemo(() => {
    let filtered = batches.filter((batch) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        batch.batch_id.toLowerCase().includes(searchLower) ||
        batch.responsible_user_name?.toLowerCase().includes(searchLower) ||
        (() => {
          const outputs = batchOutputsMap.get(batch.id) || [];
          return outputs.some(o => o.output_name.toLowerCase().includes(searchLower));
        })();

      // QA Status filter
      const matchesQaStatus = qaStatusFilter === 'all' || batch.qa_status === qaStatusFilter;

      // Status filter (locked/draft)
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'locked' && batch.is_locked) ||
        (statusFilter === 'draft' && !batch.is_locked);

      return matchesSearch && matchesQaStatus && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        comparison = new Date(a.batch_date).getTime() - new Date(b.batch_date).getTime();
      } else if (sortBy === 'batch_id') {
        comparison = a.batch_id.localeCompare(b.batch_id);
      } else if (sortBy === 'qa_status') {
        comparison = a.qa_status.localeCompare(b.qa_status);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [batches, searchQuery, qaStatusFilter, statusFilter, sortBy, sortOrder, batchOutputsMap]);

  // Helper function to format batch outputs for display
  const getBatchOutputDisplay = (batchId: string) => {
    const outputs = batchOutputsMap.get(batchId) || [];
    
    if (outputs.length === 0) {
      // Fallback to legacy fields for backward compatibility
      const batch = batches.find(b => b.id === batchId);
      if (batch?.output_product_type) {
        return {
          product: batch.output_product_type,
          output: batch.output_quantity ? `${batch.output_quantity} ${batch.output_unit}` : '—',
          outputs: []
        };
      }
      return { product: '—', output: '—', outputs: [] };
    }

    // Show first output name, or count if multiple
    const productDisplay = outputs.length === 1 
      ? outputs[0].output_name
      : `${outputs.length} outputs`;

    // Show total quantity or first output quantity
    const totalQuantity = outputs.reduce((sum, o) => sum + o.produced_quantity, 0);
    const outputDisplay = outputs.length === 1
      ? `${outputs[0].produced_quantity} ${outputs[0].produced_unit}`
      : `${totalQuantity} total`;

    return { product: productDisplay, output: outputDisplay, outputs };
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [batchesData, rawMaterialsData, recurringProductsData, usersData, tagsData] = await Promise.all([
        fetchProductionBatches(),
        fetchRawMaterials(),
        fetchRecurringProducts(),
        fetchUsers(),
        fetchProducedGoodsTags(),
      ]);

      setBatches(batchesData);
      setRawMaterials(rawMaterialsData);
      setRecurringProducts(recurringProductsData);
      setUsers(usersData);
      setProducedGoodsTags(tagsData);

      // Fetch batch outputs for all batches
      if (batchesData.length > 0) {
        const outputsPromises = batchesData.map(batch => fetchBatchOutputs(batch.id));
        const allOutputs = await Promise.all(outputsPromises);
        
        // Create a map of batch_id -> outputs[]
        const outputsMap = new Map<string, BatchOutput[]>();
        batchesData.forEach((batch, index) => {
          outputsMap.set(batch.id, allOutputs[index] || []);
        });
        
        setBatchOutputsMap(outputsMap);
      }
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
    setOutputFormData({
      output_name: '',
      output_size: undefined,
      output_size_unit: '',
      produced_quantity: 0,
      produced_unit: 'Kg.',
      custom_produced_unit: '',
      produced_goods_tag_id: '',
    });
    setBatchCompletionData({
      qa_status: 'approved',
      production_start_date: '',
      production_end_date: '',
      qa_reason: '',
      custom_fields: [],
    });
    setBatchOutputs([]);
    setEditingOutputIndex(null);
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

    // Load batch raw materials, recurring products, and outputs
    try {
      const [rawMaterialsData, recurringProductsData, outputsData] = await Promise.all([
        fetchBatchRawMaterials(batch.id),
        fetchBatchRecurringProducts(batch.id),
        fetchBatchOutputs(batch.id),
      ]);
      setSelectedBatchRawMaterials(rawMaterialsData);
      setSelectedBatchRecurringProducts(recurringProductsData);
      setSelectedBatchOutputs(outputsData);
    } catch (err) {
      console.error('Failed to load batch details:', err);
      setSelectedBatchRawMaterials([]);
      setSelectedBatchRecurringProducts([]);
      setSelectedBatchOutputs([]);
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

  const handleEditBatch = async (batch: ProductionBatch) => {
    if (batch.is_locked) {
      setError('Cannot edit locked batch. This batch has been completed.');
      return;
    }

    setCurrentBatch(batch);
    setBatchFormData({
      responsible_user_id: batch.responsible_user_id || '',
      notes: batch.notes || '',
    });

    // Load batch outputs
    try {
      const outputs = await fetchBatchOutputs(batch.id);
      setBatchOutputs(outputs);

      // Load batch completion data from the batch itself
      setBatchCompletionData({
        qa_status: (batch.qa_status as 'approved' | 'rejected' | 'hold') || 'approved',
        production_start_date: batch.production_start_date || '',
        production_end_date: batch.production_end_date || '',
        qa_reason: (batch as any).qa_reason || '',
        custom_fields: batch.custom_fields ? JSON.parse(batch.custom_fields) : [],
      });
    } catch (err) {
      console.error('Failed to load batch outputs:', err);
      setBatchOutputs([]);
    }

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

  // Batch Output Management Functions
  const addBatchOutput = async (outputData: OutputFormData) => {
    if (!currentBatch) {
      setError('No batch selected');
      return;
    }

    if (!outputData.output_name || outputData.produced_quantity <= 0 || !outputData.produced_goods_tag_id) {
      setError('Please fill in all required output fields');
      return;
    }

    // Validate custom unit if "Other" is selected
    if (outputData.produced_unit === 'Other' && !outputData.custom_produced_unit.trim()) {
      setError('Please specify the custom unit');
      return;
    }

    try {
      setError(null);
      const producedUnit = outputData.produced_unit === 'Other' ? outputData.custom_produced_unit.trim() : outputData.produced_unit;

      const newOutput = await createBatchOutput({
        batch_id: currentBatch.id,
        output_name: outputData.output_name,
        output_size: outputData.output_size,
        output_size_unit: outputData.output_size_unit,
        produced_quantity: outputData.produced_quantity,
        produced_unit: producedUnit,
        produced_goods_tag_id: outputData.produced_goods_tag_id,
      });

      setBatchOutputs(prev => [...prev, newOutput]);
      
      // Update batchOutputsMap
      if (currentBatch) {
        setBatchOutputsMap(prev => {
          const newMap = new Map(prev);
          const existingOutputs = newMap.get(currentBatch.id) || [];
          newMap.set(currentBatch.id, [...existingOutputs, newOutput]);
          return newMap;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add output');
    }
  };

  const updateBatchOutputLocal = async (outputId: string, outputData: OutputFormData) => {
    if (!outputData.output_name || outputData.produced_quantity <= 0 || !outputData.produced_goods_tag_id) {
      setError('Please fill in all required output fields');
      return;
    }

    // Validate custom unit if "Other" is selected
    if (outputData.produced_unit === 'Other' && !outputData.custom_produced_unit.trim()) {
      setError('Please specify the custom unit');
      return;
    }

    try {
      setError(null);
      const producedUnit = outputData.produced_unit === 'Other' ? outputData.custom_produced_unit.trim() : outputData.produced_unit;

      const updatedOutput = await updateBatchOutput(outputId, {
        output_name: outputData.output_name,
        output_size: outputData.output_size,
        output_size_unit: outputData.output_size_unit,
        produced_quantity: outputData.produced_quantity,
        produced_unit: producedUnit,
        produced_goods_tag_id: outputData.produced_goods_tag_id,
      });

      setBatchOutputs(prev => prev.map(output => {
        if (output.id === outputId) {
          return updatedOutput;
        }
        return output;
      }));
      
      // Update batchOutputsMap
      if (currentBatch) {
        setBatchOutputsMap(prev => {
          const newMap = new Map(prev);
          const existingOutputs = newMap.get(currentBatch.id) || [];
          newMap.set(currentBatch.id, existingOutputs.map(output => 
            output.id === outputId ? updatedOutput : output
          ));
          return newMap;
        });
      }
      
      setEditingOutputIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update output');
    }
  };

  const removeBatchOutput = async (outputId: string) => {
    try {
      setError(null);
      await deleteBatchOutput(outputId);
      setBatchOutputs(prev => prev.filter(output => output.id !== outputId));
      
      // Update batchOutputsMap
      if (currentBatch) {
        setBatchOutputsMap(prev => {
          const newMap = new Map(prev);
          const existingOutputs = newMap.get(currentBatch.id) || [];
          newMap.set(currentBatch.id, existingOutputs.filter(output => output.id !== outputId));
          return newMap;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove output');
    }
  };

  const startEditingOutput = (index: number) => {
    const output = batchOutputs[index];
    setOutputFormData({
      output_name: output.output_name,
      output_size: output.output_size,
      output_size_unit: output.output_size_unit || '',
      produced_quantity: output.produced_quantity,
      produced_unit: ['Kg.', 'Gm.', 'Ltr', 'Pieces', 'Boxes', 'Bottle'].includes(output.produced_unit) ? output.produced_unit : 'Other',
      custom_produced_unit: ['Kg.', 'Gm.', 'Ltr', 'Pieces', 'Boxes', 'Bottle'].includes(output.produced_unit) ? '' : output.produced_unit,
      produced_goods_tag_id: output.produced_goods_tag_id,
    });
    setEditingOutputIndex(index);
  };

  const cancelEditingOutput = () => {
    setOutputFormData({
      output_name: '',
      output_size: undefined,
      output_size_unit: '',
      produced_quantity: 0,
      produced_unit: 'Kg.',
      custom_produced_unit: '',
      produced_goods_tag_id: '',
    });
    setEditingOutputIndex(null);
  };

  const saveBatch = async () => {
    if (!currentBatch) {
      setError('No batch selected');
      return;
    }

    // Validate QA reason if status is hold or rejected
    if ((batchCompletionData.qa_status === 'hold' || batchCompletionData.qa_status === 'rejected') && !batchCompletionData.qa_reason?.trim()) {
      setError('QA Reason is required when QA Status is Hold or Rejected');
      return;
    }

    try {
      setError(null);
      await saveProductionBatch(currentBatch.id, batchCompletionData);
      
      // Refresh data
      await loadData();
      
      // Show success message
      alert('Batch saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save batch');
    }
  };

  const finalizeBatch = async () => {
    if (!currentBatch) {
      setError('No batch selected');
      return;
    }

    if (batchOutputs.length === 0) {
      setError('Please add at least one output before completing the batch');
      return;
    }

    // Prevent locking if QA status is hold
    if (batchCompletionData.qa_status === 'hold') {
      setError('Cannot lock batch with Hold status. Please change QA Status to Approved or Rejected, or save the batch instead.');
      return;
    }

    // Validate QA reason if status is rejected
    if (batchCompletionData.qa_status === 'rejected' && !batchCompletionData.qa_reason?.trim()) {
      setError('QA Reason is required when QA Status is Rejected');
      return;
    }

    // Confirmation dialog
    const confirmMessage = batchCompletionData.qa_status === 'approved'
      ? 'Are you sure you want to lock this batch? This will create processed goods inventory and cannot be undone.'
      : 'Are you sure you want to lock this batch? This action cannot be undone.';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setError(null);

      await completeProductionBatch(currentBatch.id, batchCompletionData);

      // Refresh data and close wizard
      await loadData();
      setShowWizard(false);
      resetWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete batch');
    }
  };

  // Batch deletion function
  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to delete this draft batch? This will restore all consumed raw materials and packaging. This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      await deleteProductionBatch(batchId);
      await loadData();
      setShowBatchDetailsModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete batch');
    }
  };

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
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {currentBatch && (
                  <button
                    onClick={async () => {
                      if (confirm('Save batch progress? You can continue editing later.')) {
                        await saveBatch();
                      }
                    }}
                    disabled={!canWrite}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                )}
                <button
                  onClick={() => setCurrentStep('recurring-products')}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  Next: Packaging
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
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
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {currentBatch && (
                  <button
                    onClick={async () => {
                      if (confirm('Save batch progress? You can continue editing later.')) {
                        await saveBatch();
                      }
                    }}
                    disabled={!canWrite}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                )}
                <button
                  onClick={() => setCurrentStep('output')}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  Next: Define Output
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );

      case 'output':
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                Define the finished product outputs from this production batch. Each output represents a different sellable product with its own quantity and tag.
              </p>
            </div>

            {/* Existing Outputs */}
            {batchOutputs.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Defined Outputs ({batchOutputs.length})</h3>
                <div className="space-y-3">
                  {batchOutputs.map((output, index) => (
                    <div key={output.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Output {index + 1}: {output.output_name}</h4>
                        <div className="flex items-center gap-2">
                          {output.produced_goods_tag_name && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                              {output.produced_goods_tag_name}
                            </span>
                          )}
                          <button
                            onClick={() => startEditingOutput(index)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit output"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove output "${output.output_name}"?`)) {
                                void removeBatchOutput(output.id);
                              }
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove output"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {output.output_size && output.output_size_unit && (
                          <div>
                            <span className="text-gray-500">Size:</span>
                            <span className="ml-2 text-gray-900 font-medium">
                              {output.output_size} {output.output_size_unit}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Produced Quantity:</span>
                          <span className="ml-2 text-gray-900 font-medium">
                            {output.produced_quantity} {output.produced_unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add/Edit Output Form */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingOutputIndex !== null ? 'Edit Output' : 'Add New Output'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Output Name *
                  </label>
                  <input
                    type="text"
                    value={outputFormData.output_name}
                    onChange={(e) => setOutputFormData(prev => ({ ...prev, output_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Banana Alkyl Liquid"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Output Size (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={outputFormData.output_size || ''}
                      onChange={(e) => setOutputFormData(prev => ({ ...prev, output_size: parseFloat(e.target.value) || undefined }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="0.01"
                      placeholder="250"
                    />
                    <input
                      type="text"
                      value={outputFormData.output_size_unit}
                      onChange={(e) => setOutputFormData(prev => ({ ...prev, output_size_unit: e.target.value }))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ml"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Produced Quantity *
                  </label>
                  <input
                    type="number"
                    value={outputFormData.produced_quantity}
                    onChange={(e) => setOutputFormData(prev => ({ ...prev, produced_quantity: parseFloat(e.target.value) || 0 }))}
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
                    value={outputFormData.produced_unit}
                    onChange={(e) => setOutputFormData(prev => ({
                      ...prev,
                      produced_unit: e.target.value,
                      custom_produced_unit: e.target.value === 'Other' ? prev.custom_produced_unit : ''
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
                  {outputFormData.produced_unit === 'Other' && (
                    <input
                      type="text"
                      value={outputFormData.custom_produced_unit}
                      onChange={(e) => setOutputFormData(prev => ({ ...prev, custom_produced_unit: e.target.value }))}
                      className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Specify unit"
                      required
                    />
                  )}
                </div>

                <div className="md:col-span-2">
                  <SearchableTagDropdown
                    tags={producedGoodsTags}
                    selectedIds={outputFormData.produced_goods_tag_id ? [outputFormData.produced_goods_tag_id] : []}
                    onChange={(selectedIds) => setOutputFormData(prev => ({ ...prev, produced_goods_tag_id: selectedIds[0] || '' }))}
                    label="Produced Goods Tag"
                    placeholder="Select a tag..."
                    required
                    multiple={false}
                    emptyMessage="No tags available. Create tags in the Admin page first."
                    colorScheme="blue"
                    disabled={!canWrite}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                {editingOutputIndex !== null && (
                  <button
                    onClick={cancelEditingOutput}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => {
                    if (editingOutputIndex !== null) {
                      const outputToUpdate: OutputFormData = {
        ...outputFormData,
        produced_unit: outputFormData.produced_unit === 'Other' ? outputFormData.custom_produced_unit : outputFormData.produced_unit,
        custom_produced_unit: outputFormData.custom_produced_unit,
      };
      void updateBatchOutputLocal(batchOutputs[editingOutputIndex].id, outputToUpdate);
                    } else {
                      void addBatchOutput(outputFormData);
                      // Reset form after adding
                      setOutputFormData({
                        output_name: '',
                        output_size: undefined,
                        output_size_unit: '',
                        produced_quantity: 0,
                        produced_unit: 'Kg.',
                        custom_produced_unit: '',
                        produced_goods_tag_id: '',
                      });
                    }
                  }}
                  disabled={!outputFormData.output_name || outputFormData.produced_quantity <= 0 || !outputFormData.produced_goods_tag_id || (outputFormData.produced_unit === 'Other' && !outputFormData.custom_produced_unit.trim())}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingOutputIndex !== null ? 'Update Output' : 'Add Output'}
                </button>
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
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {currentBatch && (
                  <button
                    onClick={async () => {
                      if (confirm('Save batch progress? You can continue editing later.')) {
                        await saveBatch();
                      }
                    }}
                    disabled={!canWrite}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                )}
                <button
                  onClick={() => setCurrentStep('complete')}
                  disabled={batchOutputs.length === 0}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  Next: Complete Batch
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
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
                    <strong>Save:</strong> Save your progress without locking. You can continue editing later.<br />
                    <strong>Lock:</strong> Permanently lock the batch and create processed goods inventory (if approved). This action cannot be undone.
                    {batchCompletionData.qa_status === 'hold' && (
                      <span className="block mt-2 font-semibold text-red-600">
                        ⚠️ Cannot lock batch with Hold status. Use Save instead.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Batch-level Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">Batch Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Production Start Date
                  </label>
                  <input
                    type="date"
                    value={batchCompletionData.production_start_date}
                    onChange={(e) => setBatchCompletionData(prev => ({ ...prev, production_start_date: e.target.value }))}
                    className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Production End Date
                  </label>
                  <input
                    type="date"
                    value={batchCompletionData.production_end_date}
                    onChange={(e) => setBatchCompletionData(prev => ({ ...prev, production_end_date: e.target.value }))}
                    className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    QA Status *
                  </label>
                  <select
                    value={batchCompletionData.qa_status}
                    onChange={(e) => setBatchCompletionData(prev => ({ ...prev, qa_status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="approved">Approved - Create Processed Goods</option>
                    <option value="hold">Hold - Further Processing Needed</option>
                    <option value="rejected">Rejected - Not Good for Sale</option>
                  </select>
                </div>

                {/* QA Reason - Required for Hold/Rejected */}
                {(batchCompletionData.qa_status === 'hold' || batchCompletionData.qa_status === 'rejected') && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      QA Reason <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-600 font-normal ml-2">
                        (Required for {batchCompletionData.qa_status === 'hold' ? 'Hold' : 'Rejected'} status)
                      </span>
                    </label>
                    <textarea
                      value={batchCompletionData.qa_reason || ''}
                      onChange={(e) => setBatchCompletionData(prev => ({ ...prev, qa_reason: e.target.value }))}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder={`Enter reason for ${batchCompletionData.qa_status === 'hold' ? 'holding' : 'rejecting'} this batch...`}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Custom Fields */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-blue-800 mb-2">
                  Custom Fields (Optional)
                </label>
                {batchCompletionData.custom_fields.map((field, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Field name (e.g., pH value)"
                      value={field.key}
                      onChange={(e) => {
                        const newFields = [...batchCompletionData.custom_fields];
                        newFields[index].key = e.target.value;
                        setBatchCompletionData(prev => ({ ...prev, custom_fields: newFields }));
                      }}
                      className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => {
                        const newFields = [...batchCompletionData.custom_fields];
                        newFields[index].value = e.target.value;
                        setBatchCompletionData(prev => ({ ...prev, custom_fields: newFields }));
                      }}
                      className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => {
                        const newFields = batchCompletionData.custom_fields.filter((_, i) => i !== index);
                        setBatchCompletionData(prev => ({ ...prev, custom_fields: newFields }));
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setBatchCompletionData(prev => ({
                      ...prev,
                      custom_fields: [...prev.custom_fields, { key: '', value: '' }]
                    }));
                  }}
                  className="mt-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  + Add Custom Field
                </button>
              </div>
            </div>

            {/* Outputs Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Outputs Summary ({batchOutputs.length} outputs)</h4>
              <div className="space-y-2">
                {batchOutputs.map((output, index) => (
                  <div key={output.id} className="bg-white rounded p-3 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-gray-900">{output.output_name}</span>
                        {output.output_size && output.output_size_unit && (
                          <span className="text-sm text-gray-600 ml-2">
                            ({output.output_size} {output.output_size_unit})
                          </span>
                        )}
                        {output.produced_goods_tag_name && (
                          <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                            {output.produced_goods_tag_name}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {output.produced_quantity} {output.produced_unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <button
                onClick={() => setCurrentStep('output')}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={async () => {
                    if (confirm('Save batch progress? You can continue editing later.')) {
                      await saveBatch();
                    }
                  }}
                  disabled={batchOutputs.length === 0 || !canWrite}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={finalizeBatch}
                  disabled={
                    batchOutputs.length === 0 || 
                    !canWrite ||
                    batchCompletionData.qa_status === 'hold' ||
                    (batchCompletionData.qa_status === 'rejected' && !batchCompletionData.qa_reason?.trim())
                  }
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                  title={batchCompletionData.qa_status === 'hold' ? 'Cannot lock batch with Hold status' : 'Lock batch permanently (cannot be undone)'}
                >
                  <Lock className="w-4 h-4" />
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
      <div className="flex justify-between items-center">
        <button
          onClick={() => exportProductionBatches(filteredAndSortedBatches, batchOutputsMap)}
          className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
          title="Export filtered batches to Excel"
        >
          <Download className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Export to Excel</span>
          <span className="sm:hidden">Export</span>
        </button>
        {canWrite && (
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
        )}
      </div>

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

      {/* Search, Filter, and Sort Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by Batch ID, Responsible User, or Product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-3">
          {/* QA Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={qaStatusFilter}
              onChange={(e) => setQaStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All QA Status</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="hold">Hold</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="locked">Locked</option>
            <option value="draft">Draft</option>
          </select>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by as 'date' | 'batch_id' | 'qa_status');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="batch_id-asc">Batch ID: A-Z</option>
              <option value="batch_id-desc">Batch ID: Z-A</option>
              <option value="qa_status-asc">QA Status: A-Z</option>
              <option value="qa_status-desc">QA Status: Z-A</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-600">
          Showing {filteredAndSortedBatches.length} of {batches.length} batches
        </div>
      </div>

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
            ) : filteredAndSortedBatches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="w-8 h-8 text-gray-400" />
                    <span>No production batches found</span>
                    {(searchQuery || qaStatusFilter !== 'all' || statusFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setQaStatusFilter('all');
                          setStatusFilter('all');
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 mt-2"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedBatches.map((batch) => {
                const outputDisplay = getBatchOutputDisplay(batch.id);
                const outputsTooltip = outputDisplay.outputs.length > 1
                  ? outputDisplay.outputs.map(o => 
                      `${o.output_name}: ${o.produced_quantity} ${o.produced_unit}${o.output_size ? ` (${o.output_size}${o.output_size_unit || ''})` : ''}`
                    ).join('\n')
                  : '';
                return (
                <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 font-mono text-sm">{batch.batch_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{batch.batch_date}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{batch.responsible_user_name}</td>
                  <td 
                    className="px-4 py-3 text-sm text-gray-700"
                    title={outputsTooltip || undefined}
                  >
                    {outputDisplay.product}
                  </td>
                  <td 
                    className="px-4 py-3 text-sm text-gray-700"
                    title={outputsTooltip || undefined}
                  >
                    {outputDisplay.output}
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
                );
              })
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
        ) : filteredAndSortedBatches.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Package className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">No production batches found</span>
              {(searchQuery || qaStatusFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setQaStatusFilter('all');
                    setStatusFilter('all');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredAndSortedBatches.map((batch) => {
            const outputDisplay = getBatchOutputDisplay(batch.id);
            return (
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
                  <span className="ml-1 text-gray-900">{outputDisplay.product}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Output:</span>
                  <span className="ml-1 text-gray-900">{outputDisplay.output}</span>
                  {outputDisplay.outputs.length > 1 && (
                    <div className="mt-1 space-y-1 text-xs text-gray-600">
                      {outputDisplay.outputs.map((output, idx) => (
                        <div key={idx}>
                          • {output.output_name}: {output.produced_quantity} {output.produced_unit}
                          {output.output_size && output.output_size_unit && 
                            ` (${output.output_size}${output.output_size_unit})`
                          }
                        </div>
                      ))}
                    </div>
                  )}
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
            );
          })
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
            setSelectedBatchOutputs([]);
          }}
          onEdit={handleEditBatchFromModal}
          onDelete={selectedBatch.is_locked ? undefined : handleDeleteBatch}
          batch={selectedBatch}
          rawMaterials={selectedBatchRawMaterials}
          recurringProducts={selectedBatchRecurringProducts}
          batchOutputs={selectedBatchOutputs}
          canEdit={canWrite}
        />
      )}
    </div>
  );
}