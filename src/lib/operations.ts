import { supabase } from './supabase';
import type {
  Supplier,
  RawMaterial,
  RecurringProduct,
  ProductionBatch,
  BatchRawMaterial,
  BatchRecurringProduct,
  ProcessedGood,
  Machine,
  WasteRecord,
  TransferRecord,
} from '../types/operations';

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function fetchUsers(): Promise<Array<{id: string, full_name: string, email: string}>> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('is_active', true)
    .order('full_name');

  if (error) throw error;
  return data || [];
}

async function generateLotId(table: 'raw_materials' | 'recurring_products', maxRetries: number = 10): Promise<string> {
  const prefix = table === 'raw_materials' ? 'LOT-RM-' : 'LOT-RP-';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Get the highest lot_id number for this prefix
    const { data, error } = await supabase
      .from(table)
      .select('lot_id')
      .like('lot_id', `${prefix}%`)
      .order('lot_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to generate lot ID: ${error.message}`);
    }

    let nextNum: number;
    if (data?.lot_id) {
      const lastNum = parseInt(data.lot_id.replace(prefix, ''), 10);
      if (isNaN(lastNum)) {
        // If parsing fails, start from 0
        nextNum = 0;
      } else {
        nextNum = lastNum + 1;
      }
    } else {
      // Start from 000 for the first lot
      nextNum = 0;
    }

    const lotId = `${prefix}${String(nextNum).padStart(3, '0')}`;

    // Check if this lot_id already exists (race condition check)
    const { data: existing, error: checkError } = await supabase
      .from(table)
      .select('lot_id')
      .eq('lot_id', lotId)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Failed to check lot ID uniqueness: ${checkError.message}`);
    }

    // If lot_id doesn't exist, it's safe to use
    if (!existing) {
      return lotId;
    }

    // If it exists, increment and try again (shouldn't happen often, but handles race conditions)
    console.warn(`Lot ID ${lotId} already exists, retrying... (attempt ${attempt + 1}/${maxRetries})`);
  }

  // If we've exhausted retries, throw an error
  throw new Error(`Failed to generate unique lot ID after ${maxRetries} attempts`);
}

export async function createSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert([supplier])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchRawMaterials(): Promise<RawMaterial[]> {
  // First get the raw materials
  const { data: materials, error } = await supabase
    .from('raw_materials')
    .select('*')
    .order('received_date', { ascending: false });

  if (error) throw error;

  if (!materials || materials.length === 0) return [];

  // Get unique supplier IDs and handover user IDs
  const supplierIds = [...new Set(materials.map(m => m.supplier_id).filter(Boolean))];
  const handoverUserIds = [...new Set(materials.map(m => m.handover_to).filter(Boolean))];

  // Fetch suppliers and users in parallel
  const [suppliersResult, usersResult] = await Promise.all([
    supplierIds.length > 0 ? supabase.from('suppliers').select('id, name').in('id', supplierIds) : Promise.resolve({ data: [] }),
    handoverUserIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', handoverUserIds) : Promise.resolve({ data: [] })
  ]);

  // Create lookup maps
  const supplierMap = new Map((suppliersResult.data || []).map(s => [s.id, s.name]));
  const userMap = new Map((usersResult.data || []).map(u => [u.id, u.full_name]));

  // Map the data
  return materials.map((material: any) => ({
    ...material,
    supplier_name: material.supplier_id ? supplierMap.get(material.supplier_id) : undefined,
    handover_to_name: material.handover_to ? userMap.get(material.handover_to) : undefined,
  }));
}

export async function createRawMaterial(material: Partial<RawMaterial>): Promise<RawMaterial> {
  // Generate lot_id if not provided
  const lotId = material.lot_id || await generateLotId('raw_materials');

  const materialData = {
    ...material,
    lot_id: lotId,
  };

  console.log('Inserting raw material data:', materialData);

  const { data, error } = await supabase
    .from('raw_materials')
    .insert([materialData])
    .select()
    .single();

  if (error) {
    console.error('Supabase error:', error);
    // Check for unique constraint violation
    if (error.code === '23505' && error.message.includes('lot_id')) {
      throw new Error(`Lot ID "${lotId}" already exists. Please use a different lot ID or let the system generate a unique one.`);
    }
    throw error;
  }

  console.log('Raw material created successfully:', data);
  return data;
}

export async function updateRawMaterial(id: string, updates: Partial<RawMaterial>): Promise<RawMaterial> {
  console.log('Updating raw material:', id, updates);

  const { data, error } = await supabase
    .from('raw_materials')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      suppliers!raw_materials_supplier_id_fkey(name),
      handover_user:users!raw_materials_handover_to_fkey(full_name)
    `)
    .single();

  if (error) {
    console.error('Supabase update error:', error);
    throw error;
  }

  console.log('Raw material updated successfully:', data);

  // Transform the response to match the expected format
  return {
    ...data,
    supplier_name: data.suppliers?.name,
    handover_to_name: data.handover_user?.full_name,
  };
}

export async function deleteRawMaterial(id: string): Promise<void> {
  const { error } = await supabase
    .from('raw_materials')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchRecurringProducts(): Promise<RecurringProduct[]> {
  // First get the recurring products
  const { data: products, error } = await supabase
    .from('recurring_products')
    .select('*')
    .order('received_date', { ascending: false });

  if (error) throw error;

  if (!products || products.length === 0) return [];

  // Get unique supplier IDs and handover user IDs
  const supplierIds = [...new Set(products.map(p => p.supplier_id).filter(Boolean))];
  const handoverUserIds = [...new Set(products.map(p => p.handover_to).filter(Boolean))];

  // Fetch suppliers and users in parallel
  const [suppliersResult, usersResult] = await Promise.all([
    supplierIds.length > 0 ? supabase.from('suppliers').select('id, name').in('id', supplierIds) : Promise.resolve({ data: [] }),
    handoverUserIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', handoverUserIds) : Promise.resolve({ data: [] })
  ]);

  // Create lookup maps
  const supplierMap = new Map((suppliersResult.data || []).map(s => [s.id, s.name]));
  const userMap = new Map((usersResult.data || []).map(u => [u.id, u.full_name]));

  // Map the data
  return products.map((product: any) => ({
    ...product,
    supplier_name: product.supplier_id ? supplierMap.get(product.supplier_id) : undefined,
    handover_to_name: product.handover_to ? userMap.get(product.handover_to) : undefined,
  }));
}

export async function createRecurringProduct(product: Partial<RecurringProduct>): Promise<RecurringProduct> {
  // Generate lot_id if not provided
  const lotId = product.lot_id || await generateLotId('recurring_products');

  // Ensure quantity_available is set to quantity_received if not provided
  const productData = {
    ...product,
    lot_id: lotId,
    quantity_available: product.quantity_available ?? product.quantity_received ?? 0,
  };

  console.log('Inserting recurring product data:', productData);

  const { data, error } = await supabase
    .from('recurring_products')
    .insert([productData])
    .select()
    .single();

  if (error) {
    console.error('Supabase error:', error);
    // Check for unique constraint violation
    if (error.code === '23505' && error.message.includes('lot_id')) {
      throw new Error(`Lot ID "${lotId}" already exists. Please use a different lot ID or let the system generate a unique one.`);
    }
    throw error;
  }

  console.log('Recurring product created successfully:', data);
  return data;
}

// Production Batch Functions
async function generateBatchId(): Promise<string> {
  const prefix = 'BATCH-';
  const { data } = await supabase.from('production_batches').select('batch_id').like('batch_id', `${prefix}%`).order('batch_id', { ascending: false }).limit(1).maybeSingle();
  if (data?.batch_id) {
    const lastNum = parseInt(data.batch_id.replace(prefix, ''));
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

export async function createProductionBatch(batch: Partial<ProductionBatch>): Promise<ProductionBatch> {
  // Generate batch_id if not provided
  const batchId = batch.batch_id || await generateBatchId();

  const batchData = {
    ...batch,
    batch_id: batchId,
    qa_status: batch.qa_status || 'pending',
    is_locked: batch.is_locked || false,
  };

  console.log('Creating production batch:', batchData);

  const { data, error } = await supabase
    .from('production_batches')
    .insert([batchData])
    .select()
    .single();

  if (error) {
    console.error('Supabase error creating batch:', error);
    throw error;
  }

  console.log('Production batch created successfully:', data);
  return data;
}

export async function fetchProductionBatches(): Promise<ProductionBatch[]> {
  const { data, error } = await supabase
    .from('production_batches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateProductionBatch(id: string, updates: Partial<ProductionBatch>): Promise<ProductionBatch> {
  const { data, error } = await supabase
    .from('production_batches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addBatchRawMaterial(batchId: string, rawMaterialId: string, quantity: number): Promise<BatchRawMaterial> {
  // Get raw material details
  const { data: rawMaterial, error: fetchError } = await supabase
    .from('raw_materials')
    .select('name, lot_id, unit, quantity_available')
    .eq('id', rawMaterialId)
    .single();

  if (fetchError || !rawMaterial) {
    throw new Error('Raw material not found');
  }

  if (rawMaterial.quantity_available < quantity) {
    throw new Error(`Insufficient quantity available. Available: ${rawMaterial.quantity_available}, Requested: ${quantity}`);
  }

  const batchMaterialData = {
    batch_id: batchId,
    raw_material_id: rawMaterialId,
    raw_material_name: rawMaterial.name,
    lot_id: rawMaterial.lot_id,
    quantity_consumed: quantity,
    unit: rawMaterial.unit,
  };

  const { data, error } = await supabase
    .from('batch_raw_materials')
    .insert([batchMaterialData])
    .select()
    .single();

  if (error) throw error;

  // Update raw material quantity_available
  await supabase
    .from('raw_materials')
    .update({ quantity_available: rawMaterial.quantity_available - quantity })
    .eq('id', rawMaterialId);

  return data;
}

export async function addBatchRecurringProduct(batchId: string, recurringProductId: string, quantity: number): Promise<BatchRecurringProduct> {
  // Get recurring product details
  const { data: product, error: fetchError } = await supabase
    .from('recurring_products')
    .select('name, unit, quantity_available')
    .eq('id', recurringProductId)
    .single();

  if (fetchError || !product) {
    throw new Error('Recurring product not found');
  }

  if (product.quantity_available < quantity) {
    throw new Error(`Insufficient quantity available. Available: ${product.quantity_available}, Requested: ${quantity}`);
  }

  const batchProductData = {
    batch_id: batchId,
    recurring_product_id: recurringProductId,
    recurring_product_name: product.name,
    quantity_consumed: quantity,
    unit: product.unit,
  };

  const { data, error } = await supabase
    .from('batch_recurring_products')
    .insert([batchProductData])
    .select()
    .single();

  if (error) throw error;

  // Update recurring product quantity_available
  await supabase
    .from('recurring_products')
    .update({ quantity_available: product.quantity_available - quantity })
    .eq('id', recurringProductId);

  return data;
}

export async function completeProductionBatch(batchId: string, outputData: {
  product_type: string;
  quantity: number;
  unit: string;
  qa_status: string;
}): Promise<ProcessedGood> {
  // Get batch details
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    throw new Error('Batch not found');
  }

  if (batch.is_locked) {
    throw new Error('Batch is already completed and locked');
  }

  // Lock the batch
  await supabase
    .from('production_batches')
    .update({ is_locked: true, qa_status: outputData.qa_status })
    .eq('id', batchId);

  // Create processed goods only if QA status is approved
  if (outputData.qa_status === 'approved') {
    const processedGoodData = {
      batch_id: batchId,
      batch_reference: batch.batch_id,
      product_type: outputData.product_type,
      quantity_available: outputData.quantity,
      unit: outputData.unit,
      production_date: new Date().toISOString().split('T')[0],
      qa_status: outputData.qa_status,
    };

    const { data, error } = await supabase
      .from('processed_goods')
      .insert([processedGoodData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Return empty object if not approved
  return {} as ProcessedGood;
}

export async function updateRecurringProduct(id: string, updates: Partial<RecurringProduct>): Promise<RecurringProduct> {
  console.log('Updating recurring product:', id, updates);

  const { data, error } = await supabase
    .from('recurring_products')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      suppliers(name),
      handover_user:users!handover_to(full_name)
    `)
    .single();

  if (error) {
    console.error('Supabase update error:', error);
    throw error;
  }

  console.log('Recurring product updated successfully:', data);

  // Transform the response to match the expected format
  return {
    ...data,
    supplier_name: data.suppliers?.name,
    handover_to_name: data.handover_user?.full_name,
  };
}

export async function deleteRecurringProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_products')
    .delete()
    .eq('id', id);

  if (error) throw error;
}


export async function approveBatch(id: string): Promise<void> {
  const { error } = await supabase
    .from('production_batches')
    .update({ qa_status: 'approved' })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchBatchRawMaterials(batchId: string): Promise<BatchRawMaterial[]> {
  const { data, error } = await supabase
    .from('batch_raw_materials')
    .select('*')
    .eq('batch_id', batchId);

  if (error) throw error;
  return data || [];
}

export async function fetchBatchRecurringProducts(batchId: string): Promise<BatchRecurringProduct[]> {
  const { data, error } = await supabase
    .from('batch_recurring_products')
    .select('*')
    .eq('batch_id', batchId);

  if (error) throw error;
  return data || [];
}

export async function deleteBatchRawMaterial(batchRawMaterialId: string, rawMaterialId: string, quantityToRestore: number): Promise<void> {
  // Delete the batch raw material entry
  const { error: deleteError } = await supabase
    .from('batch_raw_materials')
    .delete()
    .eq('id', batchRawMaterialId);

  if (deleteError) throw deleteError;

  // Restore the quantity to the raw material
  const { data: rawMaterial, error: fetchError } = await supabase
    .from('raw_materials')
    .select('quantity_available')
    .eq('id', rawMaterialId)
    .single();

  if (fetchError) throw fetchError;

  await supabase
    .from('raw_materials')
    .update({ quantity_available: rawMaterial.quantity_available + quantityToRestore })
    .eq('id', rawMaterialId);
}

// Fetch batch usage history for a raw material lot
export async function fetchRawMaterialBatchUsage(rawMaterialId: string): Promise<Array<{
  batch_id: string;
  batch_date: string;
  quantity_consumed: number;
  unit: string;
  is_locked: boolean;
  qa_status: string;
  output_product_type?: string;
}>> {
  // First get all batch_raw_materials entries for this raw material
  const { data: batchMaterials, error: batchError } = await supabase
    .from('batch_raw_materials')
    .select('batch_id, quantity_consumed, unit, created_at')
    .eq('raw_material_id', rawMaterialId)
    .order('created_at', { ascending: false });

  if (batchError) throw batchError;
  if (!batchMaterials || batchMaterials.length === 0) return [];

  // Get batch IDs
  const batchIds = batchMaterials.map((bm: any) => bm.batch_id);

  // Fetch batch details
  const { data: batches, error: batchesError } = await supabase
    .from('production_batches')
    .select('id, batch_id, batch_date, is_locked, qa_status, output_product_type')
    .in('id', batchIds);

  if (batchesError) throw batchesError;

  // Combine the data
  const batchMap = new Map((batches || []).map((b: any) => [b.id, b]));
  
  return batchMaterials.map((bm: any) => {
    const batch = batchMap.get(bm.batch_id);
    return {
      batch_id: batch?.batch_id || 'N/A',
      batch_date: batch?.batch_date || '',
      quantity_consumed: bm.quantity_consumed,
      unit: bm.unit,
      is_locked: batch?.is_locked || false,
      qa_status: batch?.qa_status || 'pending',
      output_product_type: batch?.output_product_type,
    };
  });
}

// Fetch batch usage history for a recurring product lot
export async function fetchRecurringProductBatchUsage(recurringProductId: string): Promise<Array<{
  batch_id: string;
  batch_date: string;
  quantity_consumed: number;
  unit: string;
  is_locked: boolean;
  qa_status: string;
  output_product_type?: string;
}>> {
  // First get all batch_recurring_products entries for this recurring product
  const { data: batchProducts, error: batchError } = await supabase
    .from('batch_recurring_products')
    .select('batch_id, quantity_consumed, unit, created_at')
    .eq('recurring_product_id', recurringProductId)
    .order('created_at', { ascending: false });

  if (batchError) throw batchError;
  if (!batchProducts || batchProducts.length === 0) return [];

  // Get batch IDs
  const batchIds = batchProducts.map((bp: any) => bp.batch_id);

  // Fetch batch details
  const { data: batches, error: batchesError } = await supabase
    .from('production_batches')
    .select('id, batch_id, batch_date, is_locked, qa_status, output_product_type')
    .in('id', batchIds);

  if (batchesError) throw batchesError;

  // Combine the data
  const batchMap = new Map((batches || []).map((b: any) => [b.id, b]));
  
  return batchProducts.map((bp: any) => {
    const batch = batchMap.get(bp.batch_id);
    return {
      batch_id: batch?.batch_id || 'N/A',
      batch_date: batch?.batch_date || '',
      quantity_consumed: bp.quantity_consumed,
      unit: bp.unit,
      is_locked: batch?.is_locked || false,
      qa_status: batch?.qa_status || 'pending',
      output_product_type: batch?.output_product_type,
    };
  });
}

export async function deleteBatchRecurringProduct(batchRecurringProductId: string, recurringProductId: string, quantityToRestore: number): Promise<void> {
  // Delete the batch recurring product entry
  const { error: deleteError } = await supabase
    .from('batch_recurring_products')
    .delete()
    .eq('id', batchRecurringProductId);

  if (deleteError) throw deleteError;

  // Restore the quantity to the recurring product
  const { data: product, error: fetchError } = await supabase
    .from('recurring_products')
    .select('quantity_available')
    .eq('id', recurringProductId)
    .single();

  if (fetchError) throw fetchError;

  await supabase
    .from('recurring_products')
    .update({ quantity_available: product.quantity_available + quantityToRestore })
    .eq('id', recurringProductId);
}

// Check if raw material lot is used in locked batches
export async function checkRawMaterialInLockedBatches(rawMaterialId: string): Promise<{ locked: boolean; batchIds: string[] }> {
  // Get all batches using this raw material
  const { data: batchMaterials, error: batchError } = await supabase
    .from('batch_raw_materials')
    .select('batch_id')
    .eq('raw_material_id', rawMaterialId);

  if (batchError) throw batchError;

  if (!batchMaterials || batchMaterials.length === 0) {
    return { locked: false, batchIds: [] };
  }

  // Get batch IDs
  const batchIds = batchMaterials.map((bm: any) => bm.batch_id);

  // Check which batches are locked
  const { data: batches, error: batchesError } = await supabase
    .from('production_batches')
    .select('id, batch_id, is_locked')
    .in('id', batchIds)
    .eq('is_locked', true);

  if (batchesError) throw batchesError;

  return {
    locked: (batches || []).length > 0,
    batchIds: (batches || []).map((b: any) => b.batch_id),
  };
}

// Check if recurring product is used in locked batches
export async function checkRecurringProductInLockedBatches(recurringProductId: string): Promise<{ locked: boolean; batchIds: string[] }> {
  // Get all batches using this recurring product
  const { data: batchProducts, error: batchError } = await supabase
    .from('batch_recurring_products')
    .select('batch_id')
    .eq('recurring_product_id', recurringProductId);

  if (batchError) throw batchError;

  if (!batchProducts || batchProducts.length === 0) {
    return { locked: false, batchIds: [] };
  }

  // Get batch IDs
  const batchIds = batchProducts.map((bp: any) => bp.batch_id);

  // Check which batches are locked
  const { data: batches, error: batchesError } = await supabase
    .from('production_batches')
    .select('id, batch_id, is_locked')
    .in('id', batchIds)
    .eq('is_locked', true);

  if (batchesError) throw batchesError;

  return {
    locked: (batches || []).length > 0,
    batchIds: (batches || []).map((b: any) => b.batch_id),
  };
}

export async function fetchProcessedGoods(): Promise<ProcessedGood[]> {
  const { data, error } = await supabase
    .from('processed_goods')
    .select('*')
    .order('production_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchMachines(): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select(`
      *,
      suppliers!machines_supplier_id_fkey(name)
    `)
    .order('name');

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    supplier_name: item.suppliers?.name,
  }));
}

export async function createMachine(machine: Partial<Machine>): Promise<Machine> {
  const { data, error } = await supabase
    .from('machines')
    .insert([machine])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMachine(id: string, updates: Partial<Machine>): Promise<Machine> {
  const { data, error } = await supabase
    .from('machines')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMachine(id: string): Promise<void> {
  const { error } = await supabase
    .from('machines')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ==================== Waste & Transfer Management ====================

// Record waste for a raw material or recurring product lot
export async function recordWaste(
  lotType: 'raw_material' | 'recurring_product',
  lotId: string,
  quantityWasted: number,
  reason: string,
  notes?: string,
  wasteDate?: string,
  createdBy?: string
): Promise<WasteRecord> {
  // First, get the lot details to get lot_identifier
  const table = lotType === 'raw_material' ? 'raw_materials' : 'recurring_products';
  const { data: lot, error: lotError } = await supabase
    .from(table)
    .select('lot_id, name, quantity_available, unit')
    .eq('id', lotId)
    .single();

  if (lotError) throw lotError;
  if (!lot) throw new Error('Lot not found');

  // Validate quantity
  if (quantityWasted > lot.quantity_available) {
    throw new Error(`Cannot waste ${quantityWasted} ${lot.unit}. Only ${lot.quantity_available} ${lot.unit} available.`);
  }

  // Check if lot is used in locked production batches
  const checkResult = lotType === 'raw_material'
    ? await checkRawMaterialInLockedBatches(lotId)
    : await checkRecurringProductInLockedBatches(lotId);

  if (checkResult.locked) {
    throw new Error('Cannot record waste for a lot that is used in locked production batches.');
  }

  // Create waste record
  const { data: wasteRecord, error: wasteError } = await supabase
    .from('waste_tracking')
    .insert([{
      lot_type: lotType,
      lot_id: lotId,
      lot_identifier: lot.lot_id,
      quantity_wasted: quantityWasted,
      unit: lot.unit,
      reason,
      notes,
      waste_date: wasteDate || new Date().toISOString().split('T')[0],
      created_by: createdBy,
    }])
    .select()
    .single();

  if (wasteError) throw wasteError;

  // Update the lot's available quantity
  const { error: updateError } = await supabase
    .from(table)
    .update({ quantity_available: lot.quantity_available - quantityWasted })
    .eq('id', lotId);

  if (updateError) throw updateError;

  return {
    ...wasteRecord,
    lot_name: lot.name,
  };
}

// Transfer quantity from one lot to another
export async function transferBetweenLots(
  lotType: 'raw_material' | 'recurring_product',
  fromLotId: string,
  toLotId: string,
  quantityTransferred: number,
  reason: string,
  notes?: string,
  transferDate?: string,
  createdBy?: string
): Promise<TransferRecord> {
  if (fromLotId === toLotId) {
    throw new Error('Cannot transfer to the same lot');
  }

  const table = lotType === 'raw_material' ? 'raw_materials' : 'recurring_products';

  // Get both lots
  const { data: lots, error: lotsError } = await supabase
    .from(table)
    .select('id, lot_id, name, quantity_available, unit')
    .in('id', [fromLotId, toLotId]);

  if (lotsError) throw lotsError;
  if (!lots || lots.length !== 2) {
    throw new Error('One or both lots not found');
  }

  const fromLot = lots.find((l: any) => l.id === fromLotId);
  const toLot = lots.find((l: any) => l.id === toLotId);

  if (!fromLot || !toLot) {
    throw new Error('One or both lots not found');
  }

  // Validate units match
  if (fromLot.unit !== toLot.unit) {
    throw new Error(`Unit mismatch: Cannot transfer ${fromLot.unit} to ${toLot.unit}`);
  }

  // Validate quantity
  if (quantityTransferred > fromLot.quantity_available) {
    throw new Error(`Cannot transfer ${quantityTransferred} ${fromLot.unit}. Only ${fromLot.quantity_available} ${fromLot.unit} available in source lot.`);
  }

  // Check if source lot is used in locked production batches
  const checkResult = lotType === 'raw_material'
    ? await checkRawMaterialInLockedBatches(fromLotId)
    : await checkRecurringProductInLockedBatches(fromLotId);

  if (checkResult.locked) {
    throw new Error('Cannot transfer from a lot that is used in locked production batches.');
  }

  // Create transfer record
  const { data: transferRecord, error: transferError } = await supabase
    .from('transfer_tracking')
    .insert([{
      lot_type: lotType,
      from_lot_id: fromLotId,
      from_lot_identifier: fromLot.lot_id,
      to_lot_id: toLotId,
      to_lot_identifier: toLot.lot_id,
      quantity_transferred: quantityTransferred,
      unit: fromLot.unit,
      reason,
      notes,
      transfer_date: transferDate || new Date().toISOString().split('T')[0],
      created_by: createdBy,
    }])
    .select()
    .single();

  if (transferError) throw transferError;

  // Update both lots
  const { error: updateFromError } = await supabase
    .from(table)
    .update({ quantity_available: fromLot.quantity_available - quantityTransferred })
    .eq('id', fromLotId);

  if (updateFromError) throw updateFromError;

  const { error: updateToError } = await supabase
    .from(table)
    .update({ quantity_available: toLot.quantity_available + quantityTransferred })
    .eq('id', toLotId);

  if (updateToError) throw updateToError;

  return {
    ...transferRecord,
    from_lot_name: fromLot.name,
    to_lot_name: toLot.name,
  };
}

// Fetch waste records
export async function fetchWasteRecords(
  lotType?: 'raw_material' | 'recurring_product',
  lotId?: string
): Promise<WasteRecord[]> {
  let query = supabase
    .from('waste_tracking')
    .select('*')
    .order('waste_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (lotType) {
    query = query.eq('lot_type', lotType);
  }

  if (lotId) {
    query = query.eq('lot_id', lotId);
  }

  const { data, error } = await query;

  if (error) throw error;

  if (!data || data.length === 0) return [];

  // Get unique created_by IDs (auth.users IDs)
  const createdByIds = [...new Set(data.map((item: any) => item.created_by).filter(Boolean))];

  // Fetch users where auth_user_id matches created_by
  let userMap = new Map<string, string>();
  if (createdByIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('auth_user_id, full_name')
      .in('auth_user_id', createdByIds);

    if (!usersError && users) {
      userMap = new Map(users.map((u: any) => [u.auth_user_id, u.full_name]));
    }
  }

  // Get lot names for display
  const lotIds = [...new Set(data.map((item: any) => item.lot_id).filter(Boolean))];
  let lotNameMap = new Map<string, string>();
  
  if (lotIds.length > 0 && data.length > 0) {
    const lotType = data[0].lot_type;
    const table = lotType === 'raw_material' ? 'raw_materials' : 'recurring_products';
    
    const { data: lots, error: lotsError } = await supabase
      .from(table)
      .select('id, name')
      .in('id', lotIds);

    if (!lotsError && lots) {
      lotNameMap = new Map(lots.map((l: any) => [l.id, l.name]));
    }
  }

  // Map the data
  return data.map((item: any) => ({
    ...item,
    created_by_name: item.created_by ? userMap.get(item.created_by) : undefined,
    lot_name: item.lot_id ? lotNameMap.get(item.lot_id) : undefined,
  }));
}

// Fetch transfer records
export async function fetchTransferRecords(
  lotType?: 'raw_material' | 'recurring_product',
  lotId?: string
): Promise<TransferRecord[]> {
  let query = supabase
    .from('transfer_tracking')
    .select('*')
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (lotType) {
    query = query.eq('lot_type', lotType);
  }

  if (lotId) {
    query = query.or(`from_lot_id.eq.${lotId},to_lot_id.eq.${lotId}`);
  }

  const { data, error } = await query;

  if (error) throw error;

  if (!data || data.length === 0) return [];

  // Get unique created_by IDs (auth.users IDs)
  const createdByIds = [...new Set(data.map((item: any) => item.created_by).filter(Boolean))];

  // Fetch users where auth_user_id matches created_by
  let userMap = new Map<string, string>();
  if (createdByIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('auth_user_id, full_name')
      .in('auth_user_id', createdByIds);

    if (!usersError && users) {
      userMap = new Map(users.map((u: any) => [u.auth_user_id, u.full_name]));
    }
  }

  // Get lot names for display
  const fromLotIds = [...new Set(data.map((item: any) => item.from_lot_id).filter(Boolean))];
  const toLotIds = [...new Set(data.map((item: any) => item.to_lot_id).filter(Boolean))];
  const allLotIds = [...new Set([...fromLotIds, ...toLotIds])];
  let lotNameMap = new Map<string, string>();
  
  if (allLotIds.length > 0 && data.length > 0) {
    const lotType = data[0].lot_type;
    const table = lotType === 'raw_material' ? 'raw_materials' : 'recurring_products';
    
    const { data: lots, error: lotsError } = await supabase
      .from(table)
      .select('id, name')
      .in('id', allLotIds);

    if (!lotsError && lots) {
      lotNameMap = new Map(lots.map((l: any) => [l.id, l.name]));
    }
  }

  // Map the data
  return data.map((item: any) => ({
    ...item,
    created_by_name: item.created_by ? userMap.get(item.created_by) : undefined,
    from_lot_name: item.from_lot_id ? lotNameMap.get(item.from_lot_id) : undefined,
    to_lot_name: item.to_lot_id ? lotNameMap.get(item.to_lot_id) : undefined,
  }));
}
