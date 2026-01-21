import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { fetchProducedGoodsUnits } from '../lib/units';
import type { ProducedGoodsUnit } from '../types/units';
import { supabase } from '../lib/supabase';

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
  qa_status: 'pending' | 'approved' | 'rejected' | 'hold' | '';
  production_start_date: string;
  production_end_date: string;
  qa_reason?: string;
  custom_fields: Array<{key: string, value: string}>;
}

export function Production({ accessLevel }: ProductionProps) {
  const { userId } = useModuleAccess();
  const canWrite = accessLevel === 'read-write';
  const [searchParams] = useSearchParams();

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
  const [producedGoodsUnits, setProducedGoodsUnits] = useState<ProducedGoodsUnit[]>([]);
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
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [lockModalErrors, setLockModalErrors] = useState<string[]>([]);
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
    produced_unit: '',
    custom_produced_unit: '',
    produced_goods_tag_id: '',
  });

  const [batchCompletionData, setBatchCompletionData] = useState<BatchCompletionData>({
    qa_status: 'pending',
    production_start_date: '',
    production_end_date: '',
    qa_reason: '',
    custom_fields: [],
  });

  // State for managing multiple outputs in Step 4
  const [batchOutputs, setBatchOutputs] = useState<BatchOutput[]>([]);
  const [editingOutputIndex, setEditingOutputIndex] = useState<number | null>(null);

  // Loading states for buttons
  const [isStartingBatch, setIsStartingBatch] = useState(false);
  const [isAddingRawMaterial, setIsAddingRawMaterial] = useState<string | null>(null); // materialId when adding
  const [isAddingRecurringProduct, setIsAddingRecurringProduct] = useState<string | null>(null); // productId when adding
  const [isAddingOutput, setIsAddingOutput] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isLockingBatch, setIsLockingBatch] = useState(false);

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
        // First compare by batch_date
        const dateComparison = new Date(a.batch_date).getTime() - new Date(b.batch_date).getTime();
        // If dates are the same, use created_at as tiebreaker for proper sorting
        if (dateComparison === 0) {
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else {
          comparison = dateComparison;
        }
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
      const [batchesData, rawMaterialsData, recurringProductsData, usersData, tagsData, unitsData] = await Promise.all([
        fetchProductionBatches(),
        fetchRawMaterials(),
        fetchRecurringProducts(),
        fetchUsers(),
        fetchProducedGoodsTags(),
        fetchProducedGoodsUnits(),
      ]);

      setBatches(batchesData);
      setRawMaterials(rawMaterialsData);
      setRecurringProducts(recurringProductsData);
      setUsers(usersData);
      setProducedGoodsTags(tagsData);
      setProducedGoodsUnits(unitsData);

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
      produced_unit: '',
      custom_produced_unit: '',
      produced_goods_tag_id: '',
    });
    setBatchCompletionData({
      qa_status: 'pending',
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
      setIsStartingBatch(true);
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
    } finally {
      setIsStartingBatch(false);
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

    // Validate that batch.id is a valid UUID, if not, fetch the correct UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let batchToUse = batch;
    
    if (!uuidRegex.test(batch.id)) {
      // batch.id is not a UUID, fetch the correct UUID using batch_id
      console.warn(`Batch id is not a UUID: "${batch.id}". Fetching correct UUID...`);
      const { data: batchData, error: batchError } = await supabase
        .from('production_batches')
        .select('*')
        .eq('batch_id', batch.id)
        .single();

      if (batchError || !batchData) {
        setError(`Failed to load batch: Unable to find batch with identifier "${batch.id}"`);
        return;
      }

      if (!uuidRegex.test(batchData.id)) {
        setError(`Invalid batch data: Batch UUID is not in correct format`);
        return;
      }

      batchToUse = batchData as ProductionBatch;
    }

    setCurrentBatch(batchToUse);
    setBatchFormData({
      responsible_user_id: batchToUse.responsible_user_id || '',
      notes: batchToUse.notes || '',
    });

    // Load batch outputs using the validated UUID
    try {
      const outputs = await fetchBatchOutputs(batchToUse.id);
      setBatchOutputs(outputs);

      // Load batch completion data from the batch itself
      setBatchCompletionData({
        qa_status: (batchToUse.qa_status as 'pending' | 'approved' | 'rejected' | 'hold') || 'pending',
        production_start_date: batchToUse.production_start_date || '',
        production_end_date: batchToUse.production_end_date || '',
        qa_reason: (batchToUse as any).qa_reason || '',
        custom_fields: batchToUse.custom_fields ? JSON.parse(batchToUse.custom_fields) : [],
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

  // Handle batchId URL parameter - automatically load specific batch
  useEffect(() => {
    const batchIdParam = searchParams.get('batchId');
    if (batchIdParam && !loading && batches.length > 0 && !currentBatch) {
      // Find the batch by batch_id (the display ID like BATCH-0001) or UUID
      const targetBatch = batches.find(batch =>
        batch.batch_id === batchIdParam || batch.id === batchIdParam
      );

      if (targetBatch) {
        // Load the batch details
        void handleViewBatchDetails(targetBatch);
      }
    }
  }, [searchParams, loading, batches, currentBatch]);

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
      setIsAddingRawMaterial(materialId);
      
      // If editing, remove the old entry first
      if (editingBatchItem && editingBatchItem.type === 'raw-material' && editingBatchItem.materialId === materialId) {
        await deleteBatchRawMaterial(editingBatchItem.id, materialId, editingBatchItem.quantity);
        setEditingBatchItem(null);
      }

      await addBatchRawMaterial(currentBatch.id, materialId, quantity);

      // Refresh data to show updated quantities and selected materials
      await Promise.all([loadData(), loadSelectedRawMaterials()]);
      
      // Close modal after successful addition
      if (modalConfig && modalConfig.type === 'raw-material' && modalConfig.itemId === materialId) {
        setShowQuantityModal(false);
        setModalConfig(null);
        setEditingBatchItem(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add raw material');
    } finally {
      setIsAddingRawMaterial(null);
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
      setIsAddingRecurringProduct(productId);
      
      // If editing, remove the old entry first
      if (editingBatchItem && editingBatchItem.type === 'recurring-product' && editingBatchItem.materialId === productId) {
        await deleteBatchRecurringProduct(editingBatchItem.id, productId, editingBatchItem.quantity);
        setEditingBatchItem(null);
      }

      await addBatchRecurringProduct(currentBatch.id, productId, quantity);

      // Refresh data to show updated quantities and selected products
      await Promise.all([loadData(), loadSelectedRecurringProducts()]);
      
      // Close modal after successful addition
      if (modalConfig && modalConfig.type === 'recurring-product' && modalConfig.itemId === productId) {
        setShowQuantityModal(false);
        setModalConfig(null);
        setEditingBatchItem(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recurring product');
    } finally {
      setIsAddingRecurringProduct(null);
    }
  };

  // Helper function to validate and sanitize UUID
  const validateAndSanitizeUUID = (uuid: string): string => {
    if (!uuid || typeof uuid !== 'string') {
      throw new Error(`Invalid UUID: expected string, got ${typeof uuid}`);
    }
    
    // Remove all whitespace and control characters
    let sanitized = uuid.replace(/[\s\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Remove any non-hex characters except hyphens
    sanitized = sanitized.replace(/[^0-9a-f-]/gi, '');
    
    // Validate UUID format: 8-4-4-4-12 hex digits
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(sanitized)) {
      console.error('UUID validation failed:', {
        original: uuid,
        originalLength: uuid.length,
        sanitized: sanitized,
        sanitizedLength: sanitized.length,
        hexSegments: sanitized.split('-').map(s => ({ segment: s, length: s.length })),
      });
      throw new Error(`Invalid UUID format: "${uuid}". Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
    }
    
    return sanitized.toLowerCase();
  };

  // Helper function to resolve batch UUID
  const resolveBatchUUID = async (batchIdOrBatchIdString: string): Promise<string> => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const trimmedId = batchIdOrBatchIdString?.trim();
    
    if (!trimmedId) {
      throw new Error('Batch ID is empty or undefined');
    }
    
    // Try to validate as UUID first (after sanitization)
    try {
      const sanitized = validateAndSanitizeUUID(trimmedId);
      return sanitized;
    } catch (e) {
      // If validation fails, it might be a batch_id string (e.g., "BATCH-0007"), look it up
      console.warn(`Batch ID "${trimmedId}" is not a UUID. Looking up batch...`);
      const { data: batch, error: batchError } = await supabase
        .from('production_batches')
        .select('id')
        .eq('batch_id', trimmedId)
        .single();

      if (batchError) {
        console.error('Error fetching batch:', batchError);
        throw new Error(`Failed to find batch with identifier "${trimmedId}": ${batchError.message}`);
      }

      if (!batch || !batch.id) {
        throw new Error(`Batch not found with identifier: ${trimmedId}`);
      }

      // Validate and sanitize the fetched UUID
      const resolvedId = validateAndSanitizeUUID(batch.id);
      console.log(`Resolved batch_id "${trimmedId}" to UUID: ${resolvedId}`);
      return resolvedId;
    }
  };

  // Batch Output Management Functions
  const addBatchOutput = async (outputData: OutputFormData): Promise<boolean> => {
    if (!currentBatch) {
      setError('No batch selected');
      return false;
    }

    // Check if batch is locked before attempting to add output
    if (currentBatch.is_locked) {
      setError('Cannot add output: Batch is locked and cannot be modified');
      return false;
    }

    if (!outputData.output_name || outputData.produced_quantity <= 0 || !outputData.produced_goods_tag_id) {
      setError('Please fill in all required output fields');
      return false;
    }

    // Validate unit is selected
    if (!outputData.produced_unit) {
      setError('Please select a unit');
      return false;
    }

    try {
      setError(null);
      setIsAddingOutput(true);
      const producedUnit = outputData.produced_unit;

      // Resolve the batch UUID using the helper function
      const batchIdToUse = await resolveBatchUUID(currentBatch.id);
      
      // Update currentBatch with the correct UUID if it was different
      if (currentBatch.id !== batchIdToUse) {
        setCurrentBatch({ ...currentBatch, id: batchIdToUse });
        console.log(`Updated currentBatch.id from "${currentBatch.id}" to "${batchIdToUse}"`);
      }

      const newOutput = await createBatchOutput({
        batch_id: batchIdToUse,
        output_name: outputData.output_name,
        output_size: outputData.output_size,
        output_size_unit: outputData.output_size_unit,
        produced_quantity: outputData.produced_quantity,
        produced_unit: producedUnit,
        produced_goods_tag_id: outputData.produced_goods_tag_id,
      });

      setBatchOutputs(prev => [...prev, newOutput]);
      
      // Update batchOutputsMap using the correct UUID
      if (currentBatch) {
        setBatchOutputsMap(prev => {
          const newMap = new Map(prev);
          const existingOutputs = newMap.get(batchIdToUse) || [];
          newMap.set(batchIdToUse, [...existingOutputs, newOutput]);
          return newMap;
        });
      }
      
      // Return true to indicate success
      return true;
    } catch (err) {
      // Provide more specific error messages based on error type
      let errorMessage = 'Failed to add output';
      
      if (err instanceof Error) {
        const error = err as any;
        
        // Check for network/connection errors (common on mobile)
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
          errorMessage = 'Network error: Please check your internet connection and try again';
        }
        // Check for RLS policy violations (batch locked)
        else if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('policy')) {
          errorMessage = 'Permission denied: Batch may be locked or you may not have write access';
        }
        // Check for foreign key constraint violations
        else if (error.code === '23503') {
          if (error.message?.includes('produced_goods_tag_id')) {
            errorMessage = 'Invalid goods tag selected. Please select a valid tag';
          } else if (error.message?.includes('batch_id')) {
            errorMessage = 'Batch not found. Please refresh and try again';
          } else {
            errorMessage = 'Invalid data: One or more selected values are no longer valid';
          }
        }
        // Check for check constraint violations
        else if (error.code === '23514') {
          if (error.message?.includes('produced_quantity')) {
            errorMessage = 'Invalid quantity: Quantity must be greater than 0';
          } else {
            errorMessage = 'Invalid data: ' + error.message;
          }
        }
        // Check for timeout errors
        else if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
          errorMessage = 'Request timeout: Please check your connection and try again';
        }
        // Use the error message if it's informative
        else if (error.message && error.message !== 'Failed to add output') {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      // Return false to indicate failure
      return false;
    } finally {
      setIsAddingOutput(false);
    }
  };

  const updateBatchOutputLocal = async (outputId: string, outputData: OutputFormData) => {
    if (!outputData.output_name || outputData.produced_quantity <= 0 || !outputData.produced_goods_tag_id) {
      setError('Please fill in all required output fields');
      return;
    }

    // Validate unit is selected
    if (!outputData.produced_unit) {
      setError('Please select a unit');
      return;
    }

    try {
      setError(null);
      const producedUnit = outputData.produced_unit;

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
      produced_unit: output.produced_unit || '',
      custom_produced_unit: '',
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
      produced_unit: '',
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
      setIsSavingBatch(true);
      await saveProductionBatch(currentBatch.id, batchCompletionData);
      
      // Refresh data
      await loadData();
      
      // Show success message
      alert('Save successful! You can continue editing the batch later.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save batch');
    } finally {
      setIsSavingBatch(false);
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

    // Validate production dates are required
    if (!batchCompletionData.production_start_date || !batchCompletionData.production_start_date.trim()) {
      setError('Production Start Date is required');
      return;
    }

    if (!batchCompletionData.production_end_date || !batchCompletionData.production_end_date.trim()) {
      setError('Production End Date is required');
      return;
    }

    // Validate end date is not before start date
    if (new Date(batchCompletionData.production_end_date) < new Date(batchCompletionData.production_start_date)) {
      setError('Production End Date cannot be before Production Start Date');
      return;
    }

    // Prevent locking if QA status is pending/blank
    if (!batchCompletionData.qa_status || batchCompletionData.qa_status === 'pending') {
      setError('Please select a QA Status before locking the batch. Status cannot be Pending or blank.');
      return;
    }

    // Prevent locking if QA status is hold
    if (batchCompletionData.qa_status === 'hold') {
      setError('Batch is on hold state and cannot be locked. Please change QA Status to Approved or Rejected, or save the batch instead.');
      return;
    }

    // Validate QA reason if status is rejected
    if (batchCompletionData.qa_status === 'rejected' && !batchCompletionData.qa_reason?.trim()) {
      setError('QA Reason is required when QA Status is Rejected');
      return;
    }

    // Show confirmation modal instead of browser confirm
    setShowLockConfirmModal(true);
  };

  const handleConfirmLock = async () => {
    if (!currentBatch) {
      setError('No batch selected');
      return;
    }

    try {
      setError(null);
      setIsLockingBatch(true);
      setShowLockConfirmModal(false);

      // At this point, we've already validated:
      // - QA status is not pending/blank/hold
      // - Production dates are filled
      // - QA reason is provided if rejected
      // So qaStatus must be 'approved' | 'rejected'
      const qaStatus = batchCompletionData.qa_status as 'approved' | 'rejected';

      await completeProductionBatch(currentBatch.id, {
        ...batchCompletionData,
        qa_status: qaStatus,
      });

      // Refresh data and close wizard
      await loadData();
      setShowWizard(false);
      resetWizard();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete batch';
      setError(errorMessage);
      setLockModalErrors([errorMessage]);
      setShowLockConfirmModal(true); // Reopen modal on error
    } finally {
      setIsLockingBatch(false);
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
                disabled={!batchFormData.responsible_user_id || isStartingBatch}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isStartingBatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Start Batch'
                )}
              </button>
            </div>
          </div>
        );

      case 'raw-materials':
        // Get selected material IDs
        const selectedMaterialIds = new Set(selectedRawMaterials.map(s => s.raw_material_id));
        
        // Filter available materials (exclude already selected, apply search filter, and only include usable materials)
        const availableMaterials = rawMaterials.filter(material => {
          const matchesSearch = !lotIdSearch ||
            material.lot_id.toLowerCase().includes(lotIdSearch.toLowerCase()) ||
            material.name.toLowerCase().includes(lotIdSearch.toLowerCase());
          const isUsable = material.usable ?? true; // Default to true for backward compatibility
          return !selectedMaterialIds.has(material.id) && matchesSearch && isUsable;
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
                <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <div className="max-h-[380px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {availableMaterials.map(material => (
                    <div key={material.id} className={`border rounded-lg p-4 ${
                      material.quantity_available === 0 
                        ? 'border-gray-300 bg-gray-50 opacity-75' 
                        : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{material.name}</h4>
                          <div className={`text-sm ${
                            material.quantity_available === 0
                              ? 'text-gray-500'
                              : 'text-gray-600'
                          }`}>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span>Lot: <span className="font-mono">{material.lot_id}</span></span>
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                                {material.supplier_name || 'Unknown'}
                              </span>
                              <span>Available: {material.quantity_available} {material.unit}</span>
                            </div>
                            {material.quantity_available === 0 && (
                              <span className="text-xs text-red-600">(Lot exhausted - used in production)</span>
                            )}
                          </div>
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
                          disabled={!currentBatch || material.quantity_available === 0 || isAddingRawMaterial !== null}
                          className={`px-3 py-1 text-sm rounded flex items-center justify-center gap-1 ${
                            currentBatch && material.quantity_available > 0 && isAddingRawMaterial === null
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          }`}
                        >
                          {isAddingRawMaterial === material.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Loading...
                            </>
                          ) : material.quantity_available === 0 ? (
                            'Lot Exhausted'
                          ) : (
                            'Add to Batch'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                  {availableMaterials.length > 4 && (
                    <div className="mt-2 pt-2 border-t border-gray-300 text-center">
                      <p className="text-xs text-gray-500">
                        Showing 4 of {availableMaterials.length} materials. Scroll to see more.
                      </p>
                    </div>
                  )}
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
                    disabled={!canWrite || isSavingBatch}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSavingBatch ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
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
                <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <div className="max-h-[380px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {availableProducts.map(product => (
                    <div key={product.id} className={`border rounded-lg p-4 ${
                      product.quantity_available === 0 
                        ? 'border-gray-300 bg-gray-50 opacity-75' 
                        : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{product.name}</h4>
                          <div className={`text-sm ${
                            product.quantity_available === 0
                              ? 'text-gray-500'
                              : 'text-gray-600'
                          }`}>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span>Lot: <span className="font-mono">{product.lot_id}</span></span>
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-md border border-purple-200">
                                {product.supplier_name || 'Unknown'}
                              </span>
                              <span>Available: {product.quantity_available} {product.unit}</span>
                            </div>
                            {product.quantity_available === 0 && (
                              <span className="text-xs text-red-600">(Lot exhausted - used in production)</span>
                            )}
                          </div>
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
                          disabled={!currentBatch || product.quantity_available === 0 || isAddingRecurringProduct !== null}
                          className={`px-3 py-1 text-sm rounded flex items-center justify-center gap-1 ${
                            currentBatch && product.quantity_available > 0 && isAddingRecurringProduct === null
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          }`}
                        >
                          {isAddingRecurringProduct === product.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Loading...
                            </>
                          ) : product.quantity_available === 0 ? (
                            'Lot Exhausted'
                          ) : (
                            'Add to Batch'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                  {availableProducts.length > 4 && (
                    <div className="mt-2 pt-2 border-t border-gray-300 text-center">
                      <p className="text-xs text-gray-500">
                        Showing 4 of {availableProducts.length} products. Scroll to see more.
                      </p>
                    </div>
                  )}
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
                    disabled={!canWrite || isSavingBatch}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSavingBatch ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
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
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const selectedUnit = producedGoodsUnits.find(u => u.display_name === outputFormData.produced_unit);
                      if (selectedUnit && !selectedUnit.allows_decimal && value % 1 !== 0) {
                        setError(`Unit "${selectedUnit.display_name}" does not allow decimal values. Please enter a whole number.`);
                        return;
                      }
                      setError(null);
                      setOutputFormData(prev => ({ ...prev, produced_quantity: value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step={producedGoodsUnits.find(u => u.display_name === outputFormData.produced_unit)?.allows_decimal ? '0.01' : '1'}
                    required
                  />
                  {producedGoodsUnits.find(u => u.display_name === outputFormData.produced_unit) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {producedGoodsUnits.find(u => u.display_name === outputFormData.produced_unit)?.allows_decimal 
                        ? 'Decimal values allowed (e.g., 1.5)' 
                        : 'Whole numbers only (e.g., 1, 2, 3)'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit *
                  </label>
                  <select
                    value={outputFormData.produced_unit}
                    onChange={(e) => {
                      const selectedUnit = producedGoodsUnits.find(u => u.display_name === e.target.value);
                      setOutputFormData(prev => ({
                        ...prev,
                        produced_unit: e.target.value,
                        custom_produced_unit: '',
                        // Reset quantity if unit doesn't allow decimals and current value has decimals
                        produced_quantity: selectedUnit && !selectedUnit.allows_decimal && prev.produced_quantity % 1 !== 0
                          ? Math.floor(prev.produced_quantity)
                          : prev.produced_quantity
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a unit</option>
                    {producedGoodsUnits.map((unit) => (
                      <option key={unit.id} value={unit.display_name}>
                        {unit.display_name} {unit.allows_decimal ? '(decimals allowed)' : '(whole numbers only)'}
                      </option>
                    ))}
                  </select>
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
                  onClick={async () => {
                    if (editingOutputIndex !== null) {
                      const outputToUpdate: OutputFormData = {
        ...outputFormData,
        produced_unit: outputFormData.produced_unit,
        custom_produced_unit: '',
      };
      void updateBatchOutputLocal(batchOutputs[editingOutputIndex].id, outputToUpdate);
                    } else {
                      const success = await addBatchOutput(outputFormData);
                      // Only reset form after successful addition
                      if (success) {
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
                    }
                  }}
                  disabled={!outputFormData.output_name || outputFormData.produced_quantity <= 0 || !outputFormData.produced_goods_tag_id || !outputFormData.produced_unit || (currentBatch?.is_locked ?? false) || isAddingOutput}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isAddingOutput ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : editingOutputIndex !== null ? (
                    'Update Output'
                  ) : (
                    'Add Output'
                  )}
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
                    disabled={!canWrite || isSavingBatch}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSavingBatch ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
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
                    {(!batchCompletionData.qa_status || batchCompletionData.qa_status === 'pending') && (
                      <span className="block mt-2 font-semibold text-red-600">
                        ⚠️ Please select a QA Status before locking the batch.
                      </span>
                    )}
                    {batchCompletionData.qa_status === 'hold' && (
                      <span className="block mt-2 font-semibold text-red-600">
                        ⚠️ Batch is on hold state and cannot be locked. Use Save instead.
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
                    Production Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={batchCompletionData.production_start_date}
                    onChange={(e) => setBatchCompletionData(prev => ({ ...prev, production_start_date: e.target.value }))}
                    className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                  {!batchCompletionData.production_start_date && (
                    <p className="text-xs text-red-600 mt-1">Production Start Date is required</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Production End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={batchCompletionData.production_end_date}
                    onChange={(e) => setBatchCompletionData(prev => ({ ...prev, production_end_date: e.target.value }))}
                    className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                  {!batchCompletionData.production_end_date && (
                    <p className="text-xs text-red-600 mt-1">Production End Date is required</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    QA Status *
                  </label>
                  <select
                    value={batchCompletionData.qa_status}
                    onChange={(e) => setBatchCompletionData(prev => ({ ...prev, qa_status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">-- Select QA Status --</option>
                    <option value="pending">Pending - Not Yet Reviewed</option>
                    <option value="approved">Approved - Create Processed Goods</option>
                    <option value="hold">Hold - Further Processing Needed</option>
                    <option value="rejected">Rejected - Not Good for Sale</option>
                  </select>
                  {(!batchCompletionData.qa_status || batchCompletionData.qa_status === 'pending') && (
                    <p className="text-xs text-red-600 mt-1">Please select a QA Status to lock the batch</p>
                  )}
                  {batchCompletionData.qa_status === 'hold' && (
                    <p className="text-xs text-yellow-600 mt-1">⚠️ Batch cannot be locked with Hold status. Use Save instead.</p>
                  )}
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
                  onClick={saveBatch}
                  disabled={batchOutputs.length === 0 || !canWrite || isSavingBatch}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isSavingBatch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={finalizeBatch}
                  disabled={
                    batchOutputs.length === 0 ||
                    !canWrite ||
                    isLockingBatch ||
                    !batchCompletionData.production_start_date ||
                    !batchCompletionData.production_end_date ||
                    !batchCompletionData.qa_status ||
                    batchCompletionData.qa_status === 'pending' ||
                    batchCompletionData.qa_status === 'hold' ||
                    (batchCompletionData.qa_status === 'rejected' && !batchCompletionData.qa_reason?.trim())
                  }
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                  title={
                    !batchCompletionData.production_start_date
                      ? 'Production Start Date is required'
                      : !batchCompletionData.production_end_date
                      ? 'Production End Date is required'
                      : !batchCompletionData.qa_status || batchCompletionData.qa_status === 'pending'
                      ? 'Please select a QA Status before locking'
                      : batchCompletionData.qa_status === 'hold'
                      ? 'Batch is on hold state and cannot be locked'
                      : 'Lock batch permanently (cannot be undone)'
                  }
                >
                  {isLockingBatch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Lock Batch
                    </>
                  )}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                  {currentBatch ? 'Edit Production Batch' : 'Create Production Batch'}
                </h2>
                {currentBatch && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-md shadow-sm">
                    <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">Batch ID:</span>
                    <span className="text-sm font-mono font-bold text-blue-900">{currentBatch.batch_id}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowWizard(false);
                  resetWizard();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors self-start sm:self-center"
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
          isLoading={
            modalConfig && (
              (modalConfig.type === 'raw-material' && isAddingRawMaterial === modalConfig.itemId) ||
              (modalConfig.type === 'recurring-product' && isAddingRecurringProduct === modalConfig.itemId)
            )
          }
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

      {/* Lock Batch Confirmation Modal */}
      {showLockConfirmModal && currentBatch && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-50"
              onClick={() => !isLockingBatch && setShowLockConfirmModal(false)}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 sm:px-8 sm:py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-white bg-opacity-20">
                      <Lock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Confirm Lock Batch</h3>
                      <p className="text-sm text-red-100 mt-0.5">This action cannot be undone</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!isLockingBatch) {
                        setShowLockConfirmModal(false);
                        setLockModalErrors([]);
                      }
                    }}
                    disabled={isLockingBatch}
                    className="text-white hover:text-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="bg-white px-6 py-6 sm:px-8 sm:py-8">
                <div className="space-y-6">
                  {/* Validation Errors */}
                  {lockModalErrors.length > 0 && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="ml-3 flex-1">
                          <h4 className="text-sm font-semibold text-red-900 mb-2">Validation Errors</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {lockModalErrors.map((error, index) => (
                              <li key={index} className="text-sm text-red-800">{error}</li>
                            ))}
                          </ul>
                          <p className="text-xs text-red-700 mt-3 font-medium">
                            Please fix these errors before locking the batch.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Batch ID */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-5 h-5 text-blue-600" />
                      <label className="text-sm font-semibold text-blue-900">Batch ID</label>
                    </div>
                    <p className="text-lg font-mono font-bold text-blue-900 ml-7">{currentBatch.batch_id}</p>
                  </div>

                  {/* Used Materials */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-5 h-5 text-gray-600" />
                      <label className="text-sm font-semibold text-gray-900">
                        Used Materials ({selectedRawMaterials.length + selectedRecurringProducts.length})
                      </label>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                      {selectedRawMaterials.length === 0 && selectedRecurringProducts.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No materials used</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedRawMaterials.map((material) => (
                            <div key={material.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                              <span className="text-sm text-gray-700 flex-1">{material.raw_material_name}</span>
                              <span className="text-sm font-semibold text-gray-900 ml-4">
                                {material.quantity_consumed} {material.unit}
                              </span>
                            </div>
                          ))}
                          {selectedRecurringProducts.map((product) => (
                            <div key={product.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                              <span className="text-sm text-gray-700 flex-1">{product.recurring_product_name}</span>
                              <span className="text-sm font-semibold text-gray-900 ml-4">
                                {product.quantity_consumed} {product.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Output Products */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-semibold text-gray-900">
                        Output Products ({batchOutputs.length})
                      </label>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                      {batchOutputs.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No outputs defined</p>
                      ) : (
                        <div className="space-y-2">
                          {batchOutputs.map((output) => (
                            <div key={output.id} className="flex justify-between items-center py-2 border-b border-green-200 last:border-0">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">{output.output_name}</span>
                                {output.produced_goods_tag_name && (
                                  <span className="ml-2 text-xs text-gray-500">({output.produced_goods_tag_name})</span>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-900 ml-4">
                                {output.produced_quantity} {output.produced_unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QA Status */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <label className="text-sm font-semibold text-gray-900">QA Status</label>
                    </div>
                    <div className={`border rounded-lg p-4 ${
                      batchCompletionData.qa_status === 'approved' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${
                          batchCompletionData.qa_status === 'approved' ? 'text-green-900' : 'text-red-900'
                        }`}>
                          {batchCompletionData.qa_status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                        </span>
                      </div>
                      <p className={`text-xs ${
                        batchCompletionData.qa_status === 'approved' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {batchCompletionData.qa_status === 'approved' 
                          ? '✓ Output products will be moved to Processed Goods section and available for sale.'
                          : '✗ Output products will NOT be moved to Processed Goods section. This batch is rejected and cannot be sold.'}
                      </p>
                    </div>
                  </div>

                  {/* Warning Message */}
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="ml-3">
                        <h4 className="text-sm font-semibold text-amber-900">Important Warning</h4>
                        <p className="text-sm text-amber-800 mt-1">
                          Once you lock this batch, it cannot be edited or modified. All changes will be permanent. 
                          {batchCompletionData.qa_status === 'approved' && ' Processed goods will be created and available in inventory.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 sm:px-8 sm:py-5 flex flex-col sm:flex-row gap-3 sm:justify-end border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowLockConfirmModal(false);
                    setLockModalErrors([]);
                  }}
                  disabled={isLockingBatch}
                  className="w-full sm:w-auto px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLock}
                  disabled={isLockingBatch || lockModalErrors.length > 0}
                  className="w-full sm:w-auto px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                  title={lockModalErrors.length > 0 ? 'Please fix validation errors before locking' : undefined}
                >
                  {isLockingBatch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Locking...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Confirm and Lock
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}