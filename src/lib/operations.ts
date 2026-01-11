import { supabase } from './supabase';
import type {
  Supplier,
  RawMaterial,
  RecurringProduct,
  ProductionBatch,
  BatchRawMaterial,
  BatchRecurringProduct,
  BatchOutput,
  ProcessedGood,
  Machine,
  MachineDocument,
  WasteRecord,
  TransferRecord,
  StockMovement,
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

  // Create initial IN movement (immutable ledger entry)
  if (data.quantity_received > 0) {
    await createStockMovement({
      item_type: 'raw_material',
      item_reference: data.id,
      lot_reference: data.lot_id,
      movement_type: 'IN',
      quantity: data.quantity_received,
      unit: data.unit,
      effective_date: data.received_date,
      reference_type: 'initial_intake',
      notes: 'Initial intake',
      created_by: data.created_by,
    });

    // Update quantity_available from movements
    await updateStockBalance('raw_material', data.id);
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

export async function archiveRawMaterial(id: string): Promise<RawMaterial> {
  // Check if material can be archived (quantity must be <= 5)
  const { data: material, error: fetchError } = await supabase
    .from('raw_materials')
    .select('quantity_available')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  if (material.quantity_available > 5) {
    throw new Error('Can only archive lots with quantity 5 or less');
  }

  const { data, error } = await supabase
    .from('raw_materials')
    .update({ is_archived: true })
    .eq('id', id)
    .select(`
      *,
      suppliers!raw_materials_supplier_id_fkey(name),
      handover_user:users!raw_materials_handover_to_fkey(full_name)
    `)
    .single();

  if (error) throw error;

  return {
    ...data,
    supplier_name: data.suppliers?.name,
    handover_to_name: data.handover_user?.full_name,
  };
}

export async function unarchiveRawMaterial(id: string): Promise<RawMaterial> {
  const { data, error } = await supabase
    .from('raw_materials')
    .update({ is_archived: false })
    .eq('id', id)
    .select(`
      *,
      suppliers!raw_materials_supplier_id_fkey(name),
      handover_user:users!raw_materials_handover_to_fkey(full_name)
    `)
    .single();

  if (error) throw error;

  return {
    ...data,
    supplier_name: data.suppliers?.name,
    handover_to_name: data.handover_user?.full_name,
  };
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

  // Create initial IN movement (immutable ledger entry)
  if (data.quantity_received > 0) {
    await createStockMovement({
      item_type: 'recurring_product',
      item_reference: data.id,
      lot_reference: data.lot_id,
      movement_type: 'IN',
      quantity: data.quantity_received,
      unit: data.unit,
      effective_date: data.received_date,
      reference_type: 'initial_intake',
      notes: 'Initial intake',
      created_by: data.created_by,
    });

    // Update quantity_available from movements
    await updateStockBalance('recurring_product', data.id);
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

export async function fetchProductionBatch(batchId: string): Promise<ProductionBatch> {
  const { data, error } = await supabase
    .from('production_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (error) throw error;
  
  // Fetch user name if responsible_user_id exists
  let responsibleUserName: string | undefined;
  if (data.responsible_user_id) {
    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', data.responsible_user_id)
      .single();
    
    responsibleUserName = userData?.full_name;
  }
  
  return {
    ...data,
    responsible_user_name: responsibleUserName,
  };
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
  // Get raw material details and batch date
  const [materialResult, batchResult] = await Promise.all([
    supabase
      .from('raw_materials')
      .select('name, lot_id, unit, quantity_available')
      .eq('id', rawMaterialId)
      .single(),
    supabase
      .from('production_batches')
      .select('batch_date')
      .eq('id', batchId)
      .single()
  ]);

  if (materialResult.error || !materialResult.data) {
    throw new Error('Raw material not found');
  }

  if (batchResult.error || !batchResult.data) {
    throw new Error('Production batch not found');
  }

  const rawMaterial = materialResult.data;
  const batchDate = batchResult.data.batch_date;

  // Calculate current balance from movements
  const currentBalance = await calculateStockBalance('raw_material', rawMaterialId, batchDate);

  if (currentBalance < quantity) {
    throw new Error(`Insufficient quantity available. Available: ${currentBalance}, Requested: ${quantity}`);
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

  // Create CONSUMPTION movement (immutable ledger entry)
  await createStockMovement({
    item_type: 'raw_material',
    item_reference: rawMaterialId,
    lot_reference: rawMaterial.lot_id,
    movement_type: 'CONSUMPTION',
    quantity: quantity,
    unit: rawMaterial.unit,
    effective_date: batchDate,
    reference_id: batchId,
    reference_type: 'production_batch',
    notes: `Consumed in production batch ${batchId}`,
  });

  // Update raw material quantity_available from movements
  await updateStockBalance('raw_material', rawMaterialId);

  return data;
}

export async function addBatchRecurringProduct(batchId: string, recurringProductId: string, quantity: number): Promise<BatchRecurringProduct> {
  // Get recurring product details and batch date
  const [productResult, batchResult] = await Promise.all([
    supabase
      .from('recurring_products')
      .select('name, lot_id, unit, quantity_available')
      .eq('id', recurringProductId)
      .single(),
    supabase
      .from('production_batches')
      .select('batch_date')
      .eq('id', batchId)
      .single()
  ]);

  if (productResult.error || !productResult.data) {
    throw new Error('Recurring product not found');
  }

  if (batchResult.error || !batchResult.data) {
    throw new Error('Production batch not found');
  }

  const product = productResult.data;
  const batchDate = batchResult.data.batch_date;

  // Calculate current balance from movements
  const currentBalance = await calculateStockBalance('recurring_product', recurringProductId, batchDate);

  if (currentBalance < quantity) {
    throw new Error(`Insufficient quantity available. Available: ${currentBalance}, Requested: ${quantity}`);
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

  // Create CONSUMPTION movement (immutable ledger entry)
  await createStockMovement({
    item_type: 'recurring_product',
    item_reference: recurringProductId,
    lot_reference: product.lot_id,
    movement_type: 'CONSUMPTION',
    quantity: quantity,
    unit: product.unit,
    effective_date: batchDate,
    reference_id: batchId,
    reference_type: 'production_batch',
    notes: `Consumed in production batch ${batchId}`,
  });

  // Update recurring product quantity_available from movements
  await updateStockBalance('recurring_product', recurringProductId);

  return data;
}

// Save batch without locking (for draft/progress saving)
export async function saveProductionBatch(batchId: string, outputData: {
  qa_status?: string;
  production_start_date?: string;
  production_end_date?: string;
  qa_reason?: string;
  custom_fields?: Array<{key: string, value: string}>;
}): Promise<ProductionBatch> {
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
    throw new Error('Batch is already locked and cannot be modified');
  }

  // Update batch without locking
  const batchUpdateData: any = {};

  if (outputData.qa_status !== undefined) {
    batchUpdateData.qa_status = outputData.qa_status;
  }

  if (outputData.production_start_date !== undefined) {
    batchUpdateData.production_start_date = outputData.production_start_date || null;
  }

  if (outputData.production_end_date !== undefined) {
    batchUpdateData.production_end_date = outputData.production_end_date || null;
  }

  if (outputData.qa_reason !== undefined) {
    batchUpdateData.qa_reason = outputData.qa_reason || null;
  }

  if (outputData.custom_fields !== undefined) {
    batchUpdateData.custom_fields = outputData.custom_fields && outputData.custom_fields.length > 0 
      ? JSON.stringify(outputData.custom_fields) 
      : null;
  }

  const { data, error } = await supabase
    .from('production_batches')
    .update(batchUpdateData)
    .eq('id', batchId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeProductionBatch(batchId: string, outputData: {
  qa_status: string;
  production_start_date?: string;
  production_end_date?: string;
  qa_reason?: string;
  custom_fields?: Array<{key: string, value: string}>;
}): Promise<ProcessedGood[]> {
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

  // Get all batch outputs
  const batchOutputs = await fetchBatchOutputs(batchId);

  if (batchOutputs.length === 0) {
    throw new Error('Cannot complete batch: No outputs defined');
  }

  // Validate all outputs have required fields
  for (const output of batchOutputs) {
    if (!output.output_name || !output.produced_quantity || !output.produced_unit || !output.produced_goods_tag_id) {
      throw new Error(`Cannot complete batch: Output "${output.output_name || 'Unnamed'}" is missing required fields`);
    }
  }

  // Update batch with completion data and lock it
  const batchUpdateData: any = {
    is_locked: true,
    qa_status: outputData.qa_status,
  };

  if (outputData.production_start_date) {
    batchUpdateData.production_start_date = outputData.production_start_date;
  }

  if (outputData.production_end_date) {
    batchUpdateData.production_end_date = outputData.production_end_date;
  }

  if (outputData.qa_reason !== undefined) {
    batchUpdateData.qa_reason = outputData.qa_reason || null;
  }

  if (outputData.custom_fields && outputData.custom_fields.length > 0) {
    batchUpdateData.custom_fields = JSON.stringify(outputData.custom_fields);
  }

  await supabase
    .from('production_batches')
    .update(batchUpdateData)
    .eq('id', batchId);

  // Create processed goods only if QA status is approved
  const processedGoods: ProcessedGood[] = [];

  if (outputData.qa_status === 'approved') {
    const processedGoodsData = batchOutputs.map(output => ({
      batch_id: batchId,
      batch_reference: batch.batch_id,
      product_type: output.output_name,
      quantity_available: output.produced_quantity,
      unit: output.produced_unit,
      production_date: new Date().toISOString().split('T')[0],
      qa_status: outputData.qa_status,
      output_size: output.output_size,
      output_size_unit: output.output_size_unit,
      produced_goods_tag_id: output.produced_goods_tag_id,
      custom_fields: outputData.custom_fields ? JSON.stringify(outputData.custom_fields) : undefined,
    }));

    const { data, error } = await supabase
      .from('processed_goods')
      .insert(processedGoodsData)
      .select();

    if (error) throw error;
    processedGoods.push(...(data || []));
  }

  return processedGoods;
}

// Batch deletion for draft batches only
export async function deleteProductionBatch(batchId: string): Promise<void> {
  // Get batch details to check if it's locked
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('is_locked')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    throw new Error('Batch not found');
  }

  if (batch.is_locked) {
    throw new Error('Cannot delete locked batch. Locked batches cannot be deleted.');
  }

  // Get all batch raw materials to restore quantities
  const rawMaterials = await fetchBatchRawMaterials(batchId);
  const recurringProducts = await fetchBatchRecurringProducts(batchId);

  // Get batch date for reversal movements
  const { data: batchDetails, error: batchDetailsError } = await supabase
    .from('production_batches')
    .select('batch_date')
    .eq('id', batchId)
    .single();

  if (batchDetailsError || !batchDetails) {
    throw new Error('Production batch not found');
  }

  // Restore raw material quantities by creating reversal movements
  for (const rm of rawMaterials) {
    const { data: material, error: fetchError } = await supabase
      .from('raw_materials')
      .select('lot_id, unit')
      .eq('id', rm.raw_material_id)
      .single();

    if (fetchError) throw fetchError;

    // Create reversal IN movement
    await createStockMovement({
      item_type: 'raw_material',
      item_reference: rm.raw_material_id,
      lot_reference: material.lot_id,
      movement_type: 'IN',
      quantity: rm.quantity_consumed,
      unit: material.unit,
      effective_date: batchDetails.batch_date,
      reference_id: batchId,
      reference_type: 'production_batch',
      notes: `Reversal: Batch ${batchId} deleted`,
    });

    // Update quantity_available from movements
    await updateStockBalance('raw_material', rm.raw_material_id);
  }

  // Restore recurring product quantities by creating reversal movements
  for (const rp of recurringProducts) {
    const { data: product, error: fetchError } = await supabase
      .from('recurring_products')
      .select('lot_id, unit')
      .eq('id', rp.recurring_product_id)
      .single();

    if (fetchError) throw fetchError;

    // Create reversal IN movement
    await createStockMovement({
      item_type: 'recurring_product',
      item_reference: rp.recurring_product_id,
      lot_reference: product.lot_id,
      movement_type: 'IN',
      quantity: rp.quantity_consumed,
      unit: product.unit,
      effective_date: batchDetails.batch_date,
      reference_id: batchId,
      reference_type: 'production_batch',
      notes: `Reversal: Batch ${batchId} deleted`,
    });

    // Update quantity_available from movements
    await updateStockBalance('recurring_product', rp.recurring_product_id);
  }

  // Delete batch outputs (cascade will handle this, but being explicit)
  await deleteBatchOutputsByBatchId(batchId);

  // Delete batch recurring products
  await supabase
    .from('batch_recurring_products')
    .delete()
    .eq('batch_id', batchId);

  // Delete batch raw materials
  await supabase
    .from('batch_raw_materials')
    .delete()
    .eq('batch_id', batchId);

  // Finally delete the batch itself
  const { error: deleteError } = await supabase
    .from('production_batches')
    .delete()
    .eq('id', batchId);

  if (deleteError) throw deleteError;
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

export async function archiveRecurringProduct(id: string): Promise<RecurringProduct> {
  // Check if product can be archived (quantity must be <= 5)
  const { data: product, error: fetchError } = await supabase
    .from('recurring_products')
    .select('quantity_available')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  if (product.quantity_available > 5) {
    throw new Error('Can only archive lots with quantity 5 or less');
  }

  const { data, error } = await supabase
    .from('recurring_products')
    .update({ is_archived: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Get supplier and handover user data
  const supplierIds = data.supplier_id ? [data.supplier_id] : [];
  const handoverUserIds = data.handover_to ? [data.handover_to] : [];
  
  const [suppliersResult, usersResult] = await Promise.all([
    supplierIds.length > 0 ? supabase.from('suppliers').select('id, name').in('id', supplierIds) : Promise.resolve({ data: [] }),
    handoverUserIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', handoverUserIds) : Promise.resolve({ data: [] })
  ]);

  const supplierMap = new Map((suppliersResult.data || []).map(s => [s.id, s.name]));
  const userMap = new Map((usersResult.data || []).map(u => [u.id, u.full_name]));

  return {
    ...data,
    supplier_name: data.supplier_id ? supplierMap.get(data.supplier_id) : undefined,
    handover_to_name: data.handover_to ? userMap.get(data.handover_to) : undefined,
  };
}

export async function unarchiveRecurringProduct(id: string): Promise<RecurringProduct> {
  const { data, error } = await supabase
    .from('recurring_products')
    .update({ is_archived: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Get supplier and handover user data
  const supplierIds = data.supplier_id ? [data.supplier_id] : [];
  const handoverUserIds = data.handover_to ? [data.handover_to] : [];
  
  const [suppliersResult, usersResult] = await Promise.all([
    supplierIds.length > 0 ? supabase.from('suppliers').select('id, name').in('id', supplierIds) : Promise.resolve({ data: [] }),
    handoverUserIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', handoverUserIds) : Promise.resolve({ data: [] })
  ]);

  const supplierMap = new Map((suppliersResult.data || []).map(s => [s.id, s.name]));
  const userMap = new Map((usersResult.data || []).map(u => [u.id, u.full_name]));

  return {
    ...data,
    supplier_name: data.supplier_id ? supplierMap.get(data.supplier_id) : undefined,
    handover_to_name: data.handover_to ? userMap.get(data.handover_to) : undefined,
  };
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
  // Get batch and raw material details for reversal movement
  const [batchResult, materialResult] = await Promise.all([
    supabase
      .from('batch_raw_materials')
      .select('batch_id, lot_id, unit')
      .eq('id', batchRawMaterialId)
      .single(),
    supabase
      .from('raw_materials')
      .select('lot_id, unit, quantity_available')
      .eq('id', rawMaterialId)
      .single()
  ]);

  if (batchResult.error || !batchResult.data) {
    throw new Error('Batch raw material not found');
  }

  if (materialResult.error || !materialResult.data) {
    throw new Error('Raw material not found');
  }

  const batchMaterial = batchResult.data;
  const rawMaterial = materialResult.data;

  // Get batch date for effective date
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('batch_date')
    .eq('id', batchMaterial.batch_id)
    .single();

  if (batchError || !batch) {
    throw new Error('Production batch not found');
  }

  // Delete the batch raw material entry
  const { error: deleteError } = await supabase
    .from('batch_raw_materials')
    .delete()
    .eq('id', batchRawMaterialId);

  if (deleteError) throw deleteError;

  // Create reversal IN movement (immutable ledger entry)
  // This reverses the CONSUMPTION movement that was created when the material was added to the batch
  await createStockMovement({
    item_type: 'raw_material',
    item_reference: rawMaterialId,
    lot_reference: rawMaterial.lot_id,
    movement_type: 'IN',
    quantity: quantityToRestore,
    unit: rawMaterial.unit,
    effective_date: batch.batch_date,
    reference_id: batchMaterial.batch_id,
    reference_type: 'production_batch',
    notes: `Reversal: Removed from production batch ${batchMaterial.batch_id}`,
  });

  // Update raw material quantity_available from movements
  await updateStockBalance('raw_material', rawMaterialId);
}

// Fetch batch usage history for a raw material lot
export async function fetchRawMaterialBatchUsage(rawMaterialId: string): Promise<Array<{
  batch_id: string;
  batch_date: string;
  quantity_consumed: number;
  unit: string;
  is_locked: boolean;
  qa_status: string;
  outputs: Array<{
    output_name: string;
    produced_quantity: number;
    produced_unit: string;
    output_size?: number;
    output_size_unit?: string;
  }>;
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

  // Fetch batch details and outputs
  const [batchesResult, outputsResult] = await Promise.all([
    supabase
      .from('production_batches')
      .select('id, batch_id, batch_date, is_locked, qa_status')
      .in('id', batchIds),
    supabase
      .from('batch_outputs')
      .select('batch_id, output_name, produced_quantity, produced_unit, output_size, output_size_unit')
      .in('batch_id', batchIds)
  ]);

  if (batchesResult.error) throw batchesResult.error;
  if (outputsResult.error) throw outputsResult.error;

  // Group outputs by batch_id
  const outputsByBatch = new Map<string, any[]>();
  (outputsResult.data || []).forEach((output: any) => {
    if (!outputsByBatch.has(output.batch_id)) {
      outputsByBatch.set(output.batch_id, []);
    }
    outputsByBatch.get(output.batch_id)!.push({
      output_name: output.output_name,
      produced_quantity: output.produced_quantity,
      produced_unit: output.produced_unit,
      output_size: output.output_size,
      output_size_unit: output.output_size_unit,
    });
  });

  // Combine the data
  const batchMap = new Map((batchesResult.data || []).map((b: any) => [b.id, b]));

  return batchMaterials.map((bm: any) => {
    const batch = batchMap.get(bm.batch_id);
    return {
      batch_id: batch?.batch_id || 'N/A',
      batch_date: batch?.batch_date || '',
      quantity_consumed: bm.quantity_consumed,
      unit: bm.unit,
      is_locked: batch?.is_locked || false,
      qa_status: batch?.qa_status || 'pending',
      outputs: outputsByBatch.get(bm.batch_id) || [],
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
  outputs: Array<{
    output_name: string;
    produced_quantity: number;
    produced_unit: string;
    output_size?: number;
    output_size_unit?: string;
  }>;
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

  // Fetch batch details and outputs
  const [batchesResult, outputsResult] = await Promise.all([
    supabase
      .from('production_batches')
      .select('id, batch_id, batch_date, is_locked, qa_status')
      .in('id', batchIds),
    supabase
      .from('batch_outputs')
      .select('batch_id, output_name, produced_quantity, produced_unit, output_size, output_size_unit')
      .in('batch_id', batchIds)
  ]);

  if (batchesResult.error) throw batchesResult.error;
  if (outputsResult.error) throw outputsResult.error;

  // Group outputs by batch_id
  const outputsByBatch = new Map<string, any[]>();
  (outputsResult.data || []).forEach((output: any) => {
    if (!outputsByBatch.has(output.batch_id)) {
      outputsByBatch.set(output.batch_id, []);
    }
    outputsByBatch.get(output.batch_id)!.push({
      output_name: output.output_name,
      produced_quantity: output.produced_quantity,
      produced_unit: output.produced_unit,
      output_size: output.output_size,
      output_size_unit: output.output_size_unit,
    });
  });

  // Combine the data
  const batchMap = new Map((batchesResult.data || []).map((b: any) => [b.id, b]));

  return batchProducts.map((bp: any) => {
    const batch = batchMap.get(bp.batch_id);
    return {
      batch_id: batch?.batch_id || 'N/A',
      batch_date: batch?.batch_date || '',
      quantity_consumed: bp.quantity_consumed,
      unit: bp.unit,
      is_locked: batch?.is_locked || false,
      qa_status: batch?.qa_status || 'pending',
      outputs: outputsByBatch.get(bp.batch_id) || [],
    };
  });
}

export async function deleteBatchRecurringProduct(batchRecurringProductId: string, recurringProductId: string, quantityToRestore: number): Promise<void> {
  // Get batch and recurring product details for reversal movement
  const [batchResult, productResult] = await Promise.all([
    supabase
      .from('batch_recurring_products')
      .select('batch_id, unit')
      .eq('id', batchRecurringProductId)
      .single(),
    supabase
      .from('recurring_products')
      .select('lot_id, unit, quantity_available')
      .eq('id', recurringProductId)
      .single()
  ]);

  if (batchResult.error || !batchResult.data) {
    throw new Error('Batch recurring product not found');
  }

  if (productResult.error || !productResult.data) {
    throw new Error('Recurring product not found');
  }

  const batchProduct = batchResult.data;
  const product = productResult.data;

  // Get batch date for effective date
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('batch_date')
    .eq('id', batchProduct.batch_id)
    .single();

  if (batchError || !batch) {
    throw new Error('Production batch not found');
  }

  // Delete the batch recurring product entry
  const { error: deleteError } = await supabase
    .from('batch_recurring_products')
    .delete()
    .eq('id', batchRecurringProductId);

  if (deleteError) throw deleteError;

  // Create reversal IN movement (immutable ledger entry)
  // This reverses the CONSUMPTION movement that was created when the product was added to the batch
  await createStockMovement({
    item_type: 'recurring_product',
    item_reference: recurringProductId,
    lot_reference: product.lot_id,
    movement_type: 'IN',
    quantity: quantityToRestore,
    unit: product.unit,
    effective_date: batch.batch_date,
    reference_id: batchProduct.batch_id,
    reference_type: 'production_batch',
    notes: `Reversal: Removed from production batch ${batchProduct.batch_id}`,
  });

  // Update recurring product quantity_available from movements
  await updateStockBalance('recurring_product', recurringProductId);
}

// ==================== Batch Output Functions ====================

export async function fetchBatchOutputs(batchId: string): Promise<BatchOutput[]> {
  const { data, error } = await supabase
    .from('batch_outputs')
    .select(`
      *,
      produced_goods_tags(display_name)
    `)
    .eq('batch_id', batchId)
    .order('created_at');

  if (error) throw error;

  // Transform the response to include tag name
  return (data || []).map((item: any) => ({
    ...item,
    produced_goods_tag_name: item.produced_goods_tags?.display_name,
  }));
}

export async function createBatchOutput(batchOutput: Partial<BatchOutput>): Promise<BatchOutput> {
  const { data, error } = await supabase
    .from('batch_outputs')
    .insert([batchOutput])
    .select(`
      *,
      produced_goods_tags(display_name)
    `)
    .single();

  if (error) throw error;

  return {
    ...data,
    produced_goods_tag_name: data.produced_goods_tags?.display_name,
  };
}

export async function updateBatchOutput(id: string, updates: Partial<BatchOutput>): Promise<BatchOutput> {
  const { data, error } = await supabase
    .from('batch_outputs')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      produced_goods_tags(display_name)
    `)
    .single();

  if (error) throw error;

  return {
    ...data,
    produced_goods_tag_name: data.produced_goods_tags?.display_name,
  };
}

export async function deleteBatchOutput(id: string): Promise<void> {
  const { error } = await supabase
    .from('batch_outputs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Delete all outputs for a batch (used during batch deletion)
export async function deleteBatchOutputsByBatchId(batchId: string): Promise<void> {
  const { error } = await supabase
    .from('batch_outputs')
    .delete()
    .eq('batch_id', batchId);

  if (error) throw error;
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
    .select(`
      *,
      produced_goods_tags!processed_goods_produced_goods_tag_id_fkey(display_name)
    `)
    .order('production_date', { ascending: false });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    produced_goods_tag_name: item.produced_goods_tags?.display_name,
  }));
}

export async function fetchMachines(): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select(`
      *,
      suppliers!machines_supplier_id_fkey(name),
      responsible_user:users!machines_responsible_user_id_fkey(full_name)
    `)
    .order('name');

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    supplier_name: item.suppliers?.name,
    responsible_user_name: item.responsible_user?.full_name,
  }));
}

export async function createMachine(machine: Partial<Machine>): Promise<Machine> {
  const { data, error } = await supabase
    .from('machines')
    .insert([machine])
    .select(`
      *,
      suppliers!machines_supplier_id_fkey(name),
      responsible_user:users!machines_responsible_user_id_fkey(full_name)
    `)
    .single();

  if (error) throw error;
  
  return {
    ...data,
    supplier_name: data.suppliers?.name,
    responsible_user_name: data.responsible_user?.full_name,
  };
}

export async function updateMachine(id: string, updates: Partial<Machine>): Promise<Machine> {
  const { data, error } = await supabase
    .from('machines')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      suppliers!machines_supplier_id_fkey(name),
      responsible_user:users!machines_responsible_user_id_fkey(full_name)
    `)
    .single();

  if (error) throw error;
  
  return {
    ...data,
    supplier_name: data.suppliers?.name,
    responsible_user_name: data.responsible_user?.full_name,
  };
}

export async function deleteMachine(id: string): Promise<void> {
  const { error } = await supabase
    .from('machines')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ==================== Machine Documents ====================

export async function fetchMachineDocuments(machineId: string): Promise<MachineDocument[]> {
  const { data, error } = await supabase
    .from('machine_documents')
    .select(`
      *,
      uploaded_by_user:users!machine_documents_uploaded_by_fkey(full_name)
    `)
    .eq('machine_id', machineId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    uploaded_by_name: item.uploaded_by_user?.full_name,
  }));
}

export async function uploadMachineDocument(
  machineId: string,
  file: File,
  name: string,
  userId: string
): Promise<MachineDocument> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const filePath = `machine-documents/${machineId}/${fileName}`;
  
  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('machine-documents')
    .upload(filePath, file);
  
  if (uploadError) throw uploadError;
  
  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('machine-documents')
    .getPublicUrl(filePath);
  
  // Insert document record
  const { data, error } = await supabase
    .from('machine_documents')
    .insert([
      {
        machine_id: machineId,
        name,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: publicUrlData.publicUrl,
        file_path: filePath,
        uploaded_by: userId,
      },
    ])
    .select(`
      *,
      uploaded_by_user:users!machine_documents_uploaded_by_fkey(full_name)
    `)
    .single();
  
  if (error) throw error;
  
  return {
    ...data,
    uploaded_by_name: data.uploaded_by_user?.full_name,
  };
}

export async function deleteMachineDocument(id: string, filePath: string): Promise<void> {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('machine-documents')
    .remove([filePath]);
  
  if (storageError) throw storageError;
  
  // Delete from database
  const { error } = await supabase
    .from('machine_documents')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ==================== Stock Movement Ledger Functions ====================

// Calculate current stock balance from movements
export async function calculateStockBalance(
  itemType: 'raw_material' | 'recurring_product',
  itemReference: string,
  asOfDate?: string
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('calculate_stock_balance', {
      p_item_type: itemType,
      p_item_reference: itemReference,
      p_as_of_date: asOfDate || new Date().toISOString().split('T')[0],
    });

    if (error) {
      // If function doesn't exist, fall back to querying stock_movements directly
      if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) {
        console.warn('calculate_stock_balance function not found, falling back to direct query. Please apply migration 20260111000000_create_stock_movements_ledger.sql');
        
        // Fallback: calculate balance directly from stock_movements table
        const { data: movements, error: movementsError } = await supabase
          .from('stock_movements')
          .select('movement_type, quantity')
          .eq('item_type', itemType)
          .eq('item_reference', itemReference)
          .lte('effective_date', asOfDate || new Date().toISOString().split('T')[0]);

        if (movementsError) {
          // If stock_movements table doesn't exist, return 0 and log warning
          console.warn('stock_movements table not found. Migration needs to be applied.');
          // Fallback to reading from raw_materials/recurring_products quantity_available
          const table = itemType === 'raw_material' ? 'raw_materials' : 'recurring_products';
          const { data: item, error: itemError } = await supabase
            .from(table)
            .select('quantity_available')
            .eq('id', itemReference)
            .single();
          
          if (itemError) throw itemError;
          return item?.quantity_available || 0;
        }

        if (!movements || movements.length === 0) return 0;

        // Calculate balance from movements
        const balance = movements.reduce((sum, m) => {
          const qty = parseFloat(m.quantity);
          switch (m.movement_type) {
            case 'IN':
            case 'TRANSFER_IN':
              return sum + qty;
            case 'CONSUMPTION':
            case 'WASTE':
            case 'TRANSFER_OUT':
              return sum - qty;
            default:
              return sum;
          }
        }, 0);

        return balance;
      }
      throw error;
    }
    return data || 0;
  } catch (err) {
    console.error('Error calculating stock balance:', err);
    throw err;
  }
}

// Get stock movement history for an item
export async function getStockMovementHistory(
  itemType: 'raw_material' | 'recurring_product',
  itemReference: string,
  startDate?: string,
  endDate?: string
): Promise<StockMovement[]> {
  const { data, error } = await supabase.rpc('get_stock_movement_history', {
    p_item_type: itemType,
    p_item_reference: itemReference,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) throw error;
  return data || [];
}

// Create a stock movement record
async function createStockMovement(movement: {
  item_type: 'raw_material' | 'recurring_product';
  item_reference: string;
  lot_reference?: string;
  movement_type: 'IN' | 'CONSUMPTION' | 'WASTE' | 'TRANSFER_OUT' | 'TRANSFER_IN';
  quantity: number;
  unit: string;
  effective_date: string;
  reference_id?: string;
  reference_type?: 'waste_record' | 'transfer_record' | 'production_batch' | 'initial_intake';
  notes?: string;
  created_by?: string;
}): Promise<StockMovement> {
  const { data, error } = await supabase
    .from('stock_movements')
    .insert([movement])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Check if waste/transfer record can be edited (must be less than 15 days old)
export async function canEditWasteTransferRecord(
  recordDate: string,
  createdAt: string
): Promise<boolean> {
  const recordDateObj = new Date(recordDate);
  const daysSinceRecord = Math.floor((Date.now() - recordDateObj.getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceRecord < 15;
}

// Update stock balance in raw_materials or recurring_products table
// This is now calculated from movements, but we keep it for backward compatibility
async function updateStockBalance(
  itemType: 'raw_material' | 'recurring_product',
  itemReference: string
): Promise<void> {
  const balance = await calculateStockBalance(itemType, itemReference);
  const table = itemType === 'raw_material' ? 'raw_materials' : 'recurring_products';
  
  const { error } = await supabase
    .from(table)
    .update({ quantity_available: balance })
    .eq('id', itemReference);

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

  // Calculate current balance from movements
  const currentBalance = await calculateStockBalance(lotType, lotId, wasteDate);

  // Validate quantity
  if (quantityWasted > currentBalance) {
    throw new Error(`Cannot waste ${quantityWasted} ${lot.unit}. Only ${currentBalance} ${lot.unit} available.`);
  }

  // Note: Waste records can be created even if lot is used in locked batches
  // This allows correcting inventory discrepancies regardless of batch status

  const effectiveDate = wasteDate || new Date().toISOString().split('T')[0];

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
      waste_date: effectiveDate,
      created_by: createdBy,
    }])
    .select()
    .single();

  if (wasteError) throw wasteError;

  // Create WASTE movement (immutable ledger entry)
  await createStockMovement({
    item_type: lotType,
    item_reference: lotId,
    lot_reference: lot.lot_id,
    movement_type: 'WASTE',
    quantity: quantityWasted,
    unit: lot.unit,
    effective_date: effectiveDate,
    reference_id: wasteRecord.id,
    reference_type: 'waste_record',
    notes: notes ? `Waste: ${reason}. ${notes}` : `Waste: ${reason}`,
    created_by: createdBy,
  });

  // Update the lot's available quantity from movements
  await updateStockBalance(lotType, lotId);

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

  // Calculate current balance from movements for source lot
  const effectiveDate = transferDate || new Date().toISOString().split('T')[0];
  const fromLotBalance = await calculateStockBalance(lotType, fromLotId, effectiveDate);

  // Validate quantity
  if (quantityTransferred > fromLotBalance) {
    throw new Error(`Cannot transfer ${quantityTransferred} ${fromLot.unit}. Only ${fromLotBalance} ${fromLot.unit} available in source lot.`);
  }

  // Note: Transfers can be created even if source lot is used in locked batches
  // This allows correcting inventory discrepancies regardless of batch status

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
      transfer_date: effectiveDate,
      created_by: createdBy,
    }])
    .select()
    .single();

  if (transferError) throw transferError;

  // Create TRANSFER_OUT movement for source lot (immutable ledger entry)
  await createStockMovement({
    item_type: lotType,
    item_reference: fromLotId,
    lot_reference: fromLot.lot_id,
    movement_type: 'TRANSFER_OUT',
    quantity: quantityTransferred,
    unit: fromLot.unit,
    effective_date: effectiveDate,
    reference_id: transferRecord.id,
    reference_type: 'transfer_record',
    notes: notes ? `Transfer to ${toLot.lot_id}: ${reason}. ${notes}` : `Transfer to ${toLot.lot_id}: ${reason}`,
    created_by: createdBy,
  });

  // Create TRANSFER_IN movement for destination lot (immutable ledger entry)
  await createStockMovement({
    item_type: lotType,
    item_reference: toLotId,
    lot_reference: toLot.lot_id,
    movement_type: 'TRANSFER_IN',
    quantity: quantityTransferred,
    unit: toLot.unit,
    effective_date: effectiveDate,
    reference_id: transferRecord.id,
    reference_type: 'transfer_record',
    notes: notes ? `Transfer from ${fromLot.lot_id}: ${reason}. ${notes}` : `Transfer from ${fromLot.lot_id}: ${reason}`,
    created_by: createdBy,
  });

  // Update both lots' available quantities from movements
  await updateStockBalance(lotType, fromLotId);
  await updateStockBalance(lotType, toLotId);

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

  // Map the data and determine transfer type
  return data.map((item: any) => {
    const isTransferOut = lotId && item.from_lot_id === lotId;
    const isTransferIn = lotId && item.to_lot_id === lotId;
    
    return {
      ...item,
      created_by_name: item.created_by ? userMap.get(item.created_by) : undefined,
      from_lot_name: item.from_lot_id ? lotNameMap.get(item.from_lot_id) : undefined,
      to_lot_name: item.to_lot_id ? lotNameMap.get(item.to_lot_id) : undefined,
      // Add type field for transfer records based on the queried lot
      type: isTransferOut ? 'transfer_out' as const : isTransferIn ? 'transfer_in' as const : undefined,
    };
  });
}

// Fetch waste and transfer history for a raw material lot
export async function fetchRawMaterialWasteTransferHistory(lotId: string): Promise<{
  wasteRecords: WasteRecord[];
  transferRecords: TransferRecord[];
}> {
  const [wasteRecords, transferRecords] = await Promise.all([
    fetchWasteRecords('raw_material', lotId),
    fetchTransferRecords('raw_material', lotId),
  ]);

  return {
    wasteRecords: wasteRecords || [],
    transferRecords: transferRecords || [],
  };
}

// Fetch waste and transfer history for a recurring product lot
export async function fetchRecurringProductWasteTransferHistory(lotId: string): Promise<{
  wasteRecords: WasteRecord[];
  transferRecords: TransferRecord[];
}> {
  const [wasteRecords, transferRecords] = await Promise.all([
    fetchWasteRecords('recurring_product', lotId),
    fetchTransferRecords('recurring_product', lotId),
  ]);

  return {
    wasteRecords: wasteRecords || [],
    transferRecords: transferRecords || [],
  };
}
