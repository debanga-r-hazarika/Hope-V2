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

export async function fetchRawMaterials(showArchived: boolean = false): Promise<RawMaterial[]> {
  // First get the raw materials
  let query = supabase
    .from('raw_materials')
    .select('*')
    .order('received_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Filter by archived status if requested
  if (!showArchived) {
    query = query.eq('is_archived', false);
  }

  const { data: materials, error } = await query;

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

  // Extract raw_material_tag_id from raw_material_tag_ids if present
  // The database uses raw_material_tag_id (singular), not raw_material_tag_ids (plural)
  const { raw_material_tag_ids, ...restMaterial } = material as any;
  const raw_material_tag_id = raw_material_tag_ids && raw_material_tag_ids.length > 0 
    ? raw_material_tag_ids[0] 
    : (material as any).raw_material_tag_id;

  const materialData = {
    ...restMaterial,
    lot_id: lotId,
    raw_material_tag_id: raw_material_tag_id || undefined,
  };

  // Remove any undefined values to avoid issues
  Object.keys(materialData).forEach(key => {
    if (materialData[key as keyof typeof materialData] === undefined) {
      delete materialData[key as keyof typeof materialData];
    }
  });

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
  // Use the raw material's created_at timestamp to ensure proper ordering
  if (data.quantity_received > 0) {
    const initialIntakeCreatedAt = data.created_at 
      ? new Date(new Date(data.created_at).getTime() + 1).toISOString()
      : new Date().toISOString();

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
      created_at: initialIntakeCreatedAt, // Ensure movement comes after lot creation
    });

    // Update quantity_available from movements
    await updateStockBalance('raw_material', data.id);
  }

  console.log('Raw material created successfully:', data);
  return data;
}

export async function updateRawMaterial(id: string, updates: Partial<RawMaterial>): Promise<RawMaterial> {
  console.log('Updating raw material:', id, updates);

  // Extract raw_material_tag_id from raw_material_tag_ids if present
  // The database uses raw_material_tag_id (singular), not raw_material_tag_ids (plural)
  const { raw_material_tag_ids, quantity_received, quantity_available, created_by, ...restUpdates } = updates as any;
  
  // Protect critical fields - these should never be updated directly
  // quantity_received and quantity_available are managed by stock movements
  // created_by is historical data
  if (quantity_received !== undefined || quantity_available !== undefined || created_by !== undefined) {
    console.warn('Attempted to update protected fields (quantity_received, quantity_available, or created_by). These fields are ignored.');
  }

  const updateData: any = {
    ...restUpdates,
  };

  // Handle tag ID conversion
  if (raw_material_tag_ids !== undefined) {
    updateData.raw_material_tag_id = raw_material_tag_ids && raw_material_tag_ids.length > 0 
      ? raw_material_tag_ids[0] 
      : (updates as any).raw_material_tag_id || null;
  }

  // Remove any undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  const { data, error } = await supabase
    .from('raw_materials')
    .update(updateData)
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
    .order('received_date', { ascending: false })
    .order('created_at', { ascending: false });

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

  // Extract recurring_product_tag_id from recurring_product_tag_ids if present
  // The database uses recurring_product_tag_id (singular), not recurring_product_tag_ids (plural)
  const { recurring_product_tag_ids, ...restProduct } = product as any;
  const recurring_product_tag_id = recurring_product_tag_ids && recurring_product_tag_ids.length > 0 
    ? recurring_product_tag_ids[0] 
    : (product as any).recurring_product_tag_id;

  // Ensure quantity_available is set to quantity_received if not provided
  const productData = {
    ...restProduct,
    lot_id: lotId,
    recurring_product_tag_id: recurring_product_tag_id || undefined,
    quantity_available: product.quantity_available ?? product.quantity_received ?? 0,
  };

  // Remove any undefined values to avoid issues
  Object.keys(productData).forEach(key => {
    if (productData[key as keyof typeof productData] === undefined) {
      delete productData[key as keyof typeof productData];
    }
  });

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
  // Use the recurring product's created_at timestamp to ensure proper ordering
  if (data.quantity_received > 0) {
    const initialIntakeCreatedAt = data.created_at 
      ? new Date(new Date(data.created_at).getTime() + 1).toISOString()
      : new Date().toISOString();

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
      created_at: initialIntakeCreatedAt, // Ensure movement comes after product creation
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
    .order('batch_date', { ascending: false })
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
  // Movement is created immediately after batch_recurring_products record
  // Use current timestamp to ensure proper serial ordering
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
    // created_at will be set automatically by createStockMovement to current timestamp
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
  qa_status: 'approved' | 'rejected' | 'hold';
  production_start_date?: string;
  production_end_date?: string;
  qa_reason?: string;
  custom_fields?: Array<{key: string, value: string}>;
}): Promise<ProcessedGood[]> {
  // Validate QA status is not pending/blank
  if (!outputData.qa_status || outputData.qa_status === 'pending') {
    throw new Error('Cannot lock batch: QA Status must be Approved, Rejected, or Hold');
  }

  // Prevent locking if QA status is hold
  if (outputData.qa_status === 'hold') {
    throw new Error('Cannot lock batch: Batch is on hold state and cannot be locked');
  }
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
      quantity_created: output.produced_quantity, // Set initial quantity_created equal to produced_quantity
      unit: output.produced_unit,
      production_date: outputData.production_end_date || new Date().toISOString().split('T')[0],
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
    // Use current timestamp to ensure proper ordering when batch is deleted
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
      // created_at will be set automatically to current timestamp
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

  // Protect critical fields - these should never be updated directly
  // quantity_received and quantity_available are managed by stock movements
  // created_by is historical data
  // Extract recurring_product_tag_id from recurring_product_tag_ids if present
  // The database uses recurring_product_tag_id (singular), not recurring_product_tag_ids (plural)
  const { recurring_product_tag_ids, quantity_received, quantity_available, created_by, ...restUpdates } = updates as any;
  
  if (quantity_received !== undefined || quantity_available !== undefined || created_by !== undefined) {
    console.warn('Attempted to update protected fields (quantity_received, quantity_available, or created_by). These fields are ignored.');
  }

  const updateData: any = { ...restUpdates };
  
  // Handle tag IDs conversion
  if (recurring_product_tag_ids !== undefined) {
    updateData.recurring_product_tag_id = recurring_product_tag_ids && recurring_product_tag_ids.length > 0 
      ? recurring_product_tag_ids[0] 
      : (updates as any).recurring_product_tag_id || null;
  }

  // Remove any undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  const { data, error } = await supabase
    .from('recurring_products')
    .update(updateData)
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
  // Use current timestamp to ensure it comes after the deletion
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
    // created_at will be set automatically to current timestamp
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

// Helper function to validate and sanitize UUID
function validateAndSanitizeUUID(uuid: string): string {
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
    // Log the original and sanitized for debugging
    console.error('UUID validation failed:', {
      original: uuid,
      originalLength: uuid.length,
      sanitized: sanitized,
      sanitizedLength: sanitized.length,
      hexSegments: sanitized.split('-').map(s => ({ segment: s, length: s.length })),
    });
    throw new Error(`Invalid UUID format: "${uuid}" (sanitized: "${sanitized}"). Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
  }
  
  return sanitized.toLowerCase();
}

export async function createBatchOutput(batchOutput: Partial<BatchOutput>): Promise<BatchOutput> {
  // Validate that batch_id is provided
  if (!batchOutput.batch_id) {
    throw new Error('batch_id is required');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let resolvedBatchId: string = batchOutput.batch_id;
  
  // If batch_id is not a UUID, it might be the batch_id string (e.g., "BATCH-0007")
  // Try to find the actual UUID by looking up the batch
  if (!uuidRegex.test(resolvedBatchId)) {
    console.warn(`Invalid UUID format for batch_id: "${resolvedBatchId}". Attempting to resolve by looking up batch...`);
    
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .select('id')
      .eq('batch_id', resolvedBatchId)
      .single();

    if (batchError) {
      console.error('Error fetching batch:', batchError);
      throw new Error(`Failed to find batch with identifier "${resolvedBatchId}": ${batchError.message}`);
    }

    if (!batch || !batch.id) {
      throw new Error(`Batch not found with identifier: ${resolvedBatchId}`);
    }

    // Validate the fetched ID is actually a UUID
    if (!uuidRegex.test(batch.id)) {
      throw new Error(`Invalid UUID returned from database for batch "${resolvedBatchId}": ${batch.id}`);
    }

    // Use the resolved UUID
    resolvedBatchId = batch.id;
    console.log(`Resolved batch_id "${batchOutput.batch_id}" to UUID: ${resolvedBatchId}`);
  }

  // Final validation before database insert
  if (!uuidRegex.test(resolvedBatchId)) {
    throw new Error(`Invalid batch UUID: "${resolvedBatchId}". Expected a valid UUID format.`);
  }

  // Create the insert object with the resolved UUID - ensure we're using the resolved UUID
  const batchOutputToInsert = {
    output_name: batchOutput.output_name,
    output_size: batchOutput.output_size,
    output_size_unit: batchOutput.output_size_unit,
    produced_quantity: batchOutput.produced_quantity,
    produced_unit: batchOutput.produced_unit,
    produced_goods_tag_id: batchOutput.produced_goods_tag_id,
    batch_id: resolvedBatchId, // Use the resolved UUID, not the original batchOutput.batch_id
  };

  // Final check before insert - ensure batch_id is properly sanitized
  batchOutputToInsert.batch_id = validateAndSanitizeUUID(batchOutputToInsert.batch_id);
  
  // Log what we're about to insert
  console.log('Creating batch output with:', {
    batch_id: batchOutputToInsert.batch_id,
    batch_id_length: batchOutputToInsert.batch_id.length,
    batch_id_type: typeof batchOutputToInsert.batch_id,
    is_valid_uuid: uuidRegex.test(batchOutputToInsert.batch_id),
    original_batch_id: batchOutput.batch_id,
  });

  const { data, error } = await supabase
    .from('batch_outputs')
    .insert([batchOutputToInsert])
    .select(`
      *,
      produced_goods_tags(display_name)
    `)
    .single();

  if (error) {
    console.error('Error creating batch output:', {
      error,
      batch_id_sent: batchOutputToInsert.batch_id,
      batch_id_type: typeof batchOutputToInsert.batch_id,
      is_valid_uuid: uuidRegex.test(batchOutputToInsert.batch_id),
      original_batch_id: batchOutput.batch_id,
    });
    // Provide more helpful error message for UUID errors
    if (error.code === '22P02' && error.message?.includes('uuid')) {
      throw new Error(`Database error: Invalid UUID format. Received batch_id "${batchOutput.batch_id}" which was resolved to "${resolvedBatchId}", but database still rejected it. This suggests a data inconsistency. Please refresh the page and try again.`);
    }
    throw error;
  }

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

// Utility function to fix processed goods production dates
export async function fixProcessedGoodsProductionDates(): Promise<void> {
  console.log('Fixing processed goods production dates...');

  // Get all processed goods that have associated batches
  const { data: processedGoods, error: pgError } = await supabase
    .from('processed_goods')
    .select('id, batch_id, production_date')
    .not('batch_id', 'is', null);

  if (pgError) throw pgError;

  if (!processedGoods || processedGoods.length === 0) {
    console.log('No processed goods found');
    return;
  }

  // Get batch IDs
  const batchIds = [...new Set(processedGoods.map(pg => pg.batch_id).filter(Boolean))];

  // Get batches with production_end_date
  const { data: batches, error: batchError } = await supabase
    .from('production_batches')
    .select('id, production_end_date')
    .in('id', batchIds)
    .not('production_end_date', 'is', null);

  if (batchError) throw batchError;

  if (!batches || batches.length === 0) {
    console.log('No batches with production_end_date found');
    return;
  }

  // Create batch lookup map
  const batchMap = new Map(batches.map(b => [b.id, b.production_end_date]));

  // Update processed goods that have different production dates
  let updatedCount = 0;
  for (const pg of processedGoods) {
    const correctDate = batchMap.get(pg.batch_id);
    if (correctDate && pg.production_date !== correctDate) {
      const { error: updateError } = await supabase
        .from('processed_goods')
        .update({ production_date: correctDate })
        .eq('id', pg.id);

      if (updateError) {
        console.error(`Failed to update processed good ${pg.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Updated ${updatedCount} processed goods with correct production dates`);
}

export async function fetchProcessedGoods(): Promise<Array<ProcessedGood & { actual_available?: number; production_start_date?: string }>> {
  // First get all processed goods
  const { data: goodsData, error: goodsError } = await supabase
    .from('processed_goods')
    .select(`
      *,
      produced_goods_tags!processed_goods_produced_goods_tag_id_fkey(display_name)
    `)
    .order('production_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (goodsError) throw goodsError;
  if (!goodsData || goodsData.length === 0) return [];

  // Get batch IDs that have values
  const batchIds = goodsData
    .map(g => g.batch_id)
    .filter(id => id != null) as string[];

  // Fetch production start dates for batches
  let batchStartDates: Record<string, string> = {};
  if (batchIds.length > 0) {
    const { data: batchesData, error: batchesError } = await supabase
      .from('production_batches')
      .select('id, production_start_date')
      .in('id', batchIds);

    if (batchesError) throw batchesError;

    // Create a map of batch_id to production_start_date
    batchStartDates = (batchesData || []).reduce((acc, batch) => {
      acc[batch.id] = batch.production_start_date;
      return acc;
    }, {} as Record<string, string>);
  }

  // Get all processed good IDs
  const processedGoodIds = goodsData.map((item: any) => item.id);

  // Fetch all reservations for these processed goods
  const { data: reservations, error: resError } = await supabase
    .from('order_reservations')
    .select('processed_good_id, quantity_reserved, order:orders!inner(status)')
    .in('processed_good_id', processedGoodIds);

  if (resError) throw resError;

  // Fetch all delivered quantities from order_items
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('processed_good_id, quantity_delivered')
    .in('processed_good_id', processedGoodIds)
    .not('quantity_delivered', 'is', null);

  if (itemsError) throw itemsError;

  // Calculate total reserved for each processed good
  const reservedMap = new Map<string, number>();
  (reservations || []).forEach((res: any) => {
    const order = res.order as any;
    // Only count reservations from non-cancelled orders
    if (order && order.status !== 'CANCELLED') {
      const current = reservedMap.get(res.processed_good_id) || 0;
      reservedMap.set(res.processed_good_id, current + parseFloat(res.quantity_reserved));
    }
  });

  // Calculate total delivered for each processed good
  const deliveredMap = new Map<string, number>();
  (orderItems || []).forEach((item: any) => {
    if (item.processed_good_id && item.quantity_delivered) {
      const current = deliveredMap.get(item.processed_good_id) || 0;
      deliveredMap.set(item.processed_good_id, current + parseFloat(item.quantity_delivered));
    }
  });

  // Map the data and add actual_available and quantity_delivered
  return goodsData.map((item: any) => {
    const totalReserved = reservedMap.get(item.id) || 0;
    const totalDelivered = deliveredMap.get(item.id) || 0;
    const actualAvailable = Math.max(0, parseFloat(item.quantity_available) - totalReserved);
    return {
      ...item,
      produced_goods_tag_name: item.produced_goods_tags?.display_name,
      production_start_date: item.batch_id ? batchStartDates[item.batch_id] : undefined,
      actual_available: actualAvailable,
      quantity_delivered: totalDelivered,
      // Ensure quantity_created is set (fallback to quantity_available + delivered for old records)
      quantity_created: item.quantity_created ?? (parseFloat(item.quantity_available) + totalDelivered),
    };
  });
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

// Get stock balance at a specific point in time (before a specific movement)
export async function getStockBalanceAt(
  itemType: 'raw_material' | 'recurring_product',
  itemReference: string,
  asOfDate: string,
  asOfCreatedAt?: string
): Promise<number> {
  // Build query to get all movements up to (but not including) the specified point
  let query = supabase
    .from('stock_movements')
    .select('movement_type, quantity, effective_date, created_at')
    .eq('item_type', itemType)
    .eq('item_reference', itemReference)
    .lte('effective_date', asOfDate)
    .order('effective_date', { ascending: true })
    .order('created_at', { ascending: true });

  // If asOfCreatedAt is provided, exclude movements at the exact same time or later
  if (asOfCreatedAt) {
    query = query.or(`effective_date.lt.${asOfDate},and(effective_date.eq.${asOfDate},created_at.lt.${asOfCreatedAt})`);
  }

  const { data: movements, error } = await query;

  if (error) {
    // Fallback to RPC function if direct query fails
    try {
      const dayBefore = new Date(asOfDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      return await calculateStockBalance(itemType, itemReference, dayBefore.toISOString().split('T')[0]);
    } catch (fallbackError) {
      throw error;
    }
  }

  if (!movements || movements.length === 0) return 0;

  // Calculate balance from movements
  return movements.reduce((balance, movement) => {
    const qty = parseFloat(movement.quantity);
    switch (movement.movement_type) {
      case 'IN':
      case 'TRANSFER_IN':
        return balance + qty;
      case 'CONSUMPTION':
      case 'WASTE':
      case 'TRANSFER_OUT':
        return balance - qty;
      default:
        return balance;
    }
  }, 0);
}

// Create a stock movement record with accurate timestamp for serial ordering
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
  created_at?: string; // Optional: use specific timestamp for ordering
}): Promise<StockMovement> {
  // Ensure created_at is set for proper chronological ordering
  // If not provided, use current timestamp
  const movementData: any = {
    ...movement,
    created_at: movement.created_at || new Date().toISOString(),
  };

  // Only include created_by if it's a valid UUID (auth.users.id)
  // If created_by is invalid or doesn't exist in auth.users, set it to null
  if (movement.created_by) {
    // Validate that it's a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(movement.created_by)) {
      movementData.created_by = movement.created_by;
    } else {
      // Invalid UUID format, set to null
      movementData.created_by = null;
    }
  } else {
    // No created_by provided, set to null (column allows NULL)
    movementData.created_by = null;
  }

  const { data, error } = await supabase
    .from('stock_movements')
    .insert([movementData])
    .select()
    .single();

  if (error) {
    // If foreign key constraint fails, try again without created_by
    if (error.code === '23503' && error.message.includes('created_by')) {
      console.warn('Foreign key constraint failed for created_by, retrying without it:', error);
      const retryData = { ...movementData };
      delete retryData.created_by;
      const { data: retryResult, error: retryError } = await supabase
        .from('stock_movements')
        .insert([retryData])
        .select()
        .single();
      
      if (retryError) throw retryError;
      return retryResult;
    }
    throw error;
  }
  return data;
}

// Get complete stock movement history with running balances (for audit log)
// This provides a complete chronological log of all movements with accurate serial ordering
export async function getCompleteStockMovementHistory(
  itemType: 'raw_material' | 'recurring_product',
  itemReference: string
): Promise<StockMovement[]> {
  const { data: movements, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('item_type', itemType)
    .eq('item_reference', itemReference)
    .order('effective_date', { ascending: true })
    .order('created_at', { ascending: true }); // Critical: Order by created_at for same-date movements

  if (error) throw error;
  if (!movements || movements.length === 0) return [];

  // Calculate running balance for each movement in chronological order
  let runningBalance = 0;
  return movements.map((movement) => {
    const qty = parseFloat(movement.quantity);
    
    // Update running balance based on movement type
    switch (movement.movement_type) {
      case 'IN':
      case 'TRANSFER_IN':
        runningBalance += qty;
        break;
      case 'CONSUMPTION':
      case 'WASTE':
      case 'TRANSFER_OUT':
        runningBalance -= qty;
        break;
    }

    return {
      ...movement,
      running_balance: runningBalance,
    };
  });
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

// ==================== Waste Management ====================

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
  // Get the lot details
  const table = lotType === 'raw_material' ? 'raw_materials' : 'recurring_products';
  const { data: lot, error: lotError } = await supabase
    .from(table)
    .select('lot_id, name, quantity_available, unit')
    .eq('id', lotId)
    .single();

  if (lotError) throw lotError;
  if (!lot) throw new Error('Lot not found');

  // Calculate current balance from movements
  const effectiveDate = wasteDate || new Date().toISOString().split('T')[0];
  const currentBalance = await calculateStockBalance(lotType, lotId, effectiveDate);

  // Validate quantity
  if (quantityWasted > currentBalance) {
    throw new Error(`Cannot waste ${quantityWasted} ${lot.unit}. Only ${currentBalance.toFixed(2)} ${lot.unit} available.`);
  }

  if (quantityWasted <= 0) {
    throw new Error('Waste quantity must be greater than 0');
  }

  // Create waste record first to get its created_at timestamp
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

  // Create WASTE movement immediately after waste record creation
  // Use waste record's created_at to ensure proper serial ordering
  // Add 1ms to ensure movement comes after the waste record in chronological order
  const movementCreatedAt = wasteRecord.created_at 
    ? new Date(new Date(wasteRecord.created_at).getTime() + 1).toISOString()
    : new Date().toISOString();

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
    created_at: movementCreatedAt, // Ensure proper serial ordering
  });

  // Update the lot's available quantity from movements
  await updateStockBalance(lotType, lotId);

  return {
    ...wasteRecord,
    lot_name: lot.name,
  };
}

// Fetch waste records for a specific lot
export async function fetchWasteRecordsForLot(
  lotType: 'raw_material' | 'recurring_product',
  lotId: string
): Promise<WasteRecord[]> {
  const { data, error } = await supabase
    .from('waste_tracking')
    .select('*')
    .eq('lot_type', lotType)
    .eq('lot_id', lotId)
    .order('waste_date', { ascending: false })
    .order('created_at', { ascending: false });

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

  // Map the data
  return data.map((item: any) => ({
    ...item,
    created_by_name: item.created_by ? userMap.get(item.created_by) : undefined,
    lot_name: item.lot_id ? (lotType === 'raw_material' ? 'Raw Material' : 'Recurring Product') : undefined,
  }));
}

// ==================== Transfer Management ====================

// Transfer stock between two lots of the same type
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
  // Get both lot details
  const table = lotType === 'raw_material' ? 'raw_materials' : 'recurring_products';
  
  const { data: lots, error: lotsError } = await supabase
    .from(table)
    .select('id, lot_id, name, quantity_available, unit')
    .in('id', [fromLotId, toLotId]);

  if (lotsError) throw lotsError;
  if (!lots || lots.length !== 2) {
    throw new Error('One or both lots not found');
  }

  const fromLot = lots.find(l => l.id === fromLotId);
  const toLot = lots.find(l => l.id === toLotId);

  if (!fromLot || !toLot) {
    throw new Error('One or both lots not found');
  }

  // Validate units match
  if (fromLot.unit !== toLot.unit) {
    throw new Error(`Cannot transfer between lots with different units: ${fromLot.unit} vs ${toLot.unit}`);
  }

  // Calculate current balance for source lot
  const effectiveDate = transferDate || new Date().toISOString().split('T')[0];
  const fromLotBalance = await calculateStockBalance(lotType, fromLotId, effectiveDate);

  // Validate quantity
  if (quantityTransferred > fromLotBalance) {
    throw new Error(`Cannot transfer ${quantityTransferred} ${fromLot.unit}. Only ${fromLotBalance.toFixed(2)} ${fromLot.unit} available in source lot.`);
  }

  if (quantityTransferred <= 0) {
    throw new Error('Transfer quantity must be greater than 0');
  }

  // Create transfer record first to get its created_at timestamp
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

  // Create TRANSFER_OUT movement for source lot
  // Use transfer record's created_at to ensure proper serial ordering
  // Add 1ms to ensure movement comes after the transfer record in chronological order
  const movementCreatedAt = transferRecord.created_at 
    ? new Date(new Date(transferRecord.created_at).getTime() + 1).toISOString()
    : new Date().toISOString();

  // Create TRANSFER_OUT for source lot
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
    created_at: movementCreatedAt,
  });

  // Create TRANSFER_IN movement for target lot
  // Add 2ms to ensure it comes after TRANSFER_OUT for proper ordering
  const transferInCreatedAt = new Date(new Date(movementCreatedAt).getTime() + 1).toISOString();

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
    created_at: transferInCreatedAt,
  });

  // Update both lots' available quantities from movements
  await Promise.all([
    updateStockBalance(lotType, fromLotId),
    updateStockBalance(lotType, toLotId),
  ]);

  return {
    ...transferRecord,
    from_lot_name: fromLot.name,
    to_lot_name: toLot.name,
  };
}

// Fetch transfer records for a specific lot (both incoming and outgoing)
export async function fetchTransferRecordsForLot(
  lotType: 'raw_material' | 'recurring_product',
  lotId: string
): Promise<TransferRecord[]> {
  // Get lot identifier
  const table = lotType === 'raw_material' ? 'raw_materials' : 'recurring_products';
  const { data: lot, error: lotError } = await supabase
    .from(table)
    .select('lot_id')
    .eq('id', lotId)
    .single();

  if (lotError) throw lotError;
  if (!lot) return [];

  // Fetch transfers where this lot is either source or destination
  const { data, error } = await supabase
    .from('transfer_tracking')
    .select('*')
    .eq('lot_type', lotType)
    .or(`from_lot_id.eq.${lotId},to_lot_id.eq.${lotId}`)
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false });

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

  // Fetch lot names for display
  const allLotIds = [...new Set([
    ...data.map((item: any) => item.from_lot_id),
    ...data.map((item: any) => item.to_lot_id),
  ])];

  const { data: lots, error: lotsError } = await supabase
    .from(table)
    .select('id, lot_id, name')
    .in('id', allLotIds);

  const lotMap = new Map<string, { lot_id: string; name: string }>();
  if (!lotsError && lots) {
    lots.forEach((l: any) => {
      lotMap.set(l.id, { lot_id: l.lot_id, name: l.name });
    });
  }

  // Map the data with direction indicator
  return data.map((item: any) => {
    const isOutgoing = item.from_lot_id === lotId;

    return {
      ...item,
      created_by_name: item.created_by ? userMap.get(item.created_by) : undefined,
      from_lot_name: lotMap.get(item.from_lot_id)?.name,
      to_lot_name: lotMap.get(item.to_lot_id)?.name,
      type: isOutgoing ? 'transfer_out' : 'transfer_in',
    };
  });
}
