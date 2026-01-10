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
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchUsers(): Promise<Array<{id: string, auth_user_id: string, full_name: string, email: string}>> {
  const { data, error } = await supabase
    .from('users')
    .select('id, auth_user_id, full_name, email')
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

// Generate unique waste_id (e.g., WASTE-000, WASTE-001)
async function generateWasteId(maxRetries: number = 10): Promise<string> {
  const prefix = 'WASTE-';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Get the highest waste_id number
    const { data, error } = await supabase
      .from('waste_tracking')
      .select('waste_id')
      .like('waste_id', `${prefix}%`)
      .order('waste_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to generate waste ID: ${error.message}`);
    }

    let nextNum: number;
    if (data?.waste_id) {
      const lastNum = parseInt(data.waste_id.replace(prefix, ''), 10);
      if (isNaN(lastNum)) {
        nextNum = 0;
      } else {
        nextNum = lastNum + 1;
      }
    } else {
      nextNum = 0;
    }

    const wasteId = `${prefix}${String(nextNum).padStart(3, '0')}`;

    // Check if this waste_id already exists (race condition check)
    const { data: existing, error: checkError } = await supabase
      .from('waste_tracking')
      .select('waste_id')
      .eq('waste_id', wasteId)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Failed to check waste ID uniqueness: ${checkError.message}`);
    }

    if (!existing) {
      return wasteId;
    }

    console.warn(`Waste ID ${wasteId} already exists, retrying... (attempt ${attempt + 1}/${maxRetries})`);
  }

  throw new Error(`Failed to generate unique waste ID after ${maxRetries} attempts`);
}

// Generate unique transfer_id (e.g., TRANSFER-000, TRANSFER-001)
async function generateTransferId(maxRetries: number = 10): Promise<string> {
  const prefix = 'TRANSFER-';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Get the highest transfer_id number
    const { data, error } = await supabase
      .from('transfer_tracking')
      .select('transfer_id')
      .like('transfer_id', `${prefix}%`)
      .order('transfer_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to generate transfer ID: ${error.message}`);
    }

    let nextNum: number;
    if (data?.transfer_id) {
      const lastNum = parseInt(data.transfer_id.replace(prefix, ''), 10);
      if (isNaN(lastNum)) {
        nextNum = 0;
      } else {
        nextNum = lastNum + 1;
      }
    } else {
      nextNum = 0;
    }

    const transferId = `${prefix}${String(nextNum).padStart(3, '0')}`;

    // Check if this transfer_id already exists (race condition check)
    const { data: existing, error: checkError } = await supabase
      .from('transfer_tracking')
      .select('transfer_id')
      .eq('transfer_id', transferId)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Failed to check transfer ID uniqueness: ${checkError.message}`);
    }

    if (!existing) {
      return transferId;
    }

    console.warn(`Transfer ID ${transferId} already exists, retrying... (attempt ${attempt + 1}/${maxRetries})`);
  }

  throw new Error(`Failed to generate unique transfer ID after ${maxRetries} attempts`);
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

export async function fetchRawMaterials(includeArchived: boolean = true): Promise<RawMaterial[]> {
  // First get the raw materials
  let query = supabase
    .from('raw_materials')
    .select('*');
  
  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }
  
  const { data: materials, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  if (!materials || materials.length === 0) return [];

  const materialIds = materials.map(m => m.id);

  // Get unique supplier IDs and handover user IDs
  const supplierIds = [...new Set(materials.map(m => m.supplier_id).filter(Boolean))];
  const handoverUserIds = [...new Set(materials.map(m => m.handover_to).filter(Boolean))];

  // Fetch tags from junction table
  const { data: tagLookups, error: tagLookupError } = await supabase
    .from('raw_material_tags_lookup')
    .select('raw_material_id, raw_material_tag_id')
    .in('raw_material_id', materialIds);

  if (tagLookupError) throw tagLookupError;

  // Get unique tag IDs from lookups
  const tagIds = [...new Set((tagLookups || []).map(t => t.raw_material_tag_id))];

  // Fetch suppliers, users, and tags in parallel
  const [suppliersResult, usersResult, tagsResult] = await Promise.all([
    supplierIds.length > 0 ? supabase.from('suppliers').select('id, name').in('id', supplierIds) : Promise.resolve({ data: [] }),
    handoverUserIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', handoverUserIds) : Promise.resolve({ data: [] }),
    tagIds.length > 0 ? supabase.from('raw_material_tags').select('id, display_name').in('id', tagIds) : Promise.resolve({ data: [] })
  ]);

  // Create lookup maps
  const supplierMap = new Map((suppliersResult.data || []).map(s => [s.id, s.name]));
  const userMap = new Map((usersResult.data || []).map(u => [u.id, u.full_name]));
  const tagMap = new Map((tagsResult.data || []).map(t => [t.id, t.display_name]));

  // Create material -> tags map from junction table
  const materialTagsMap = new Map<string, string[]>();
  const materialTagNamesMap = new Map<string, string[]>();
  
  (tagLookups || []).forEach((lookup: any) => {
    const materialId = lookup.raw_material_id;
    const tagId = lookup.raw_material_tag_id;
    const tagName = tagMap.get(tagId);

    if (!materialTagsMap.has(materialId)) {
      materialTagsMap.set(materialId, []);
      materialTagNamesMap.set(materialId, []);
    }
    materialTagsMap.get(materialId)!.push(tagId);
    if (tagName) {
      materialTagNamesMap.get(materialId)!.push(tagName);
    }
  });

  // Map the data
  return materials.map((material: any) => {
    const tagIds = materialTagsMap.get(material.id) || [];
    const tagNames = materialTagNamesMap.get(material.id) || [];
    
    return {
      ...material,
      supplier_name: material.supplier_id ? supplierMap.get(material.supplier_id) : undefined,
      handover_to_name: material.handover_to ? userMap.get(material.handover_to) : undefined,
      raw_material_tag_ids: tagIds.length > 0 ? tagIds : undefined,
      raw_material_tag_names: tagNames.length > 0 ? tagNames : undefined,
      // Legacy single tag support for backward compatibility
      raw_material_tag_id: tagIds.length > 0 ? tagIds[0] : material.raw_material_tag_id || undefined,
      raw_material_tag_name: tagNames.length > 0 ? tagNames[0] : undefined,
    };
  });
}

export async function createRawMaterial(material: Partial<RawMaterial>): Promise<RawMaterial> {
  // Generate lot_id if not provided
  const lotId = material.lot_id || await generateLotId('raw_materials');

  // Extract tag IDs (support both array and single value for backward compatibility)
  const tagIds = material.raw_material_tag_ids || (material.raw_material_tag_id ? [material.raw_material_tag_id] : []);
  
  // Remove tag fields from material data (they go in junction table)
  const { raw_material_tag_ids, raw_material_tag_names, raw_material_tag_id, raw_material_tag_name, ...materialData } = material;

  const insertData = {
    ...materialData,
    lot_id: lotId,
  };

  console.log('Inserting raw material data:', insertData);

  const { data, error } = await supabase
    .from('raw_materials')
    .insert([insertData])
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

  // Insert tags into junction table if provided
  if (tagIds.length > 0) {
    const tagLookups = tagIds.map(tagId => ({
      raw_material_id: data.id,
      raw_material_tag_id: tagId,
    }));

    const { error: tagError } = await supabase
      .from('raw_material_tags_lookup')
      .insert(tagLookups);

    if (tagError) {
      console.error('Error inserting tags:', tagError);
      // Note: We don't throw here to avoid partial data, but log the error
      // In production, you might want to delete the material if tag insertion fails
    }
  }

  // Refetch with tags populated
  const result = await fetchRawMaterials(true);
  const created = result.find(m => m.id === data.id);
  
  console.log('Raw material created successfully:', created || data);
  return created || data as RawMaterial;
}

export async function updateRawMaterial(id: string, updates: Partial<RawMaterial>): Promise<RawMaterial> {
  console.log('Updating raw material:', id, updates);

  // Extract tag IDs if provided (support both array and single value)
  const tagIds = updates.raw_material_tag_ids || (updates.raw_material_tag_id ? [updates.raw_material_tag_id] : undefined);
  
  // Remove tag fields from updates (they go in junction table)
  const { raw_material_tag_ids, raw_material_tag_names, raw_material_tag_id, raw_material_tag_name, ...materialUpdates } = updates;

  // Update main material record if there are non-tag updates
  if (Object.keys(materialUpdates).length > 0) {
    const { data, error } = await supabase
      .from('raw_materials')
      .update(materialUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
  }

  // Update tags in junction table if tagIds is provided (even if empty array)
  if (tagIds !== undefined) {
    // Delete existing tags
    const { error: deleteError } = await supabase
      .from('raw_material_tags_lookup')
      .delete()
      .eq('raw_material_id', id);

    if (deleteError) {
      console.error('Error deleting existing tags:', deleteError);
      throw deleteError;
    }

    // Insert new tags if provided
    if (tagIds.length > 0) {
      const tagLookups = tagIds.map(tagId => ({
        raw_material_id: id,
        raw_material_tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from('raw_material_tags_lookup')
        .insert(tagLookups);

      if (insertError) {
        console.error('Error inserting tags:', insertError);
        throw insertError;
      }
    }
  }

  // Refetch with tags populated
  const result = await fetchRawMaterials(true);
  const updated = result.find(m => m.id === id);
  
  if (!updated) {
    throw new Error('Failed to fetch updated raw material');
  }

  console.log('Raw material updated successfully:', updated);
  return updated;
}

export async function deleteRawMaterial(id: string): Promise<void> {
  const { error } = await supabase
    .from('raw_materials')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function archiveRawMaterial(id: string): Promise<RawMaterial> {
  const { data, error } = await supabase
    .from('raw_materials')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      suppliers!raw_materials_supplier_id_fkey(name),
      handover_user:users!raw_materials_handover_to_fkey(full_name)
    `)
    .single();

  if (error) throw error;
  
  const material = data as any;
  return {
    ...material,
    supplier_name: material.suppliers?.name,
    handover_to_name: material.handover_user?.full_name,
  };
}

export async function unarchiveRawMaterial(id: string): Promise<RawMaterial> {
  const { data, error } = await supabase
    .from('raw_materials')
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      suppliers!raw_materials_supplier_id_fkey(name),
      handover_user:users!raw_materials_handover_to_fkey(full_name)
    `)
    .single();

  if (error) throw error;
  
  const material = data as any;
  return {
    ...material,
    supplier_name: material.suppliers?.name,
    handover_to_name: material.handover_user?.full_name,
  };
}

export async function fetchRecurringProducts(includeArchived: boolean = true): Promise<RecurringProduct[]> {
  // First get the recurring products
  let query = supabase
    .from('recurring_products')
    .select('*');
  
  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }
  
  const { data: products, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  if (!products || products.length === 0) return [];

  const productIds = products.map(p => p.id);

  // Get unique supplier IDs and handover user IDs
  const supplierIds = [...new Set(products.map(p => p.supplier_id).filter(Boolean))];
  const handoverUserIds = [...new Set(products.map(p => p.handover_to).filter(Boolean))];

  // Fetch tags from junction table
  const { data: tagLookups, error: tagLookupError } = await supabase
    .from('recurring_product_tags_lookup')
    .select('recurring_product_id, recurring_product_tag_id')
    .in('recurring_product_id', productIds);

  if (tagLookupError) throw tagLookupError;

  // Get unique tag IDs from lookups
  const tagIds = [...new Set((tagLookups || []).map(t => t.recurring_product_tag_id))];

  // Fetch suppliers, users, and tags in parallel
  const [suppliersResult, usersResult, tagsResult] = await Promise.all([
    supplierIds.length > 0 ? supabase.from('suppliers').select('id, name').in('id', supplierIds) : Promise.resolve({ data: [] }),
    handoverUserIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', handoverUserIds) : Promise.resolve({ data: [] }),
    tagIds.length > 0 ? supabase.from('recurring_product_tags').select('id, display_name').in('id', tagIds) : Promise.resolve({ data: [] })
  ]);

  // Create lookup maps
  const supplierMap = new Map((suppliersResult.data || []).map(s => [s.id, s.name]));
  const userMap = new Map((usersResult.data || []).map(u => [u.id, u.full_name]));
  const tagMap = new Map((tagsResult.data || []).map(t => [t.id, t.display_name]));

  // Create product -> tags map from junction table
  const productTagsMap = new Map<string, string[]>();
  const productTagNamesMap = new Map<string, string[]>();
  
  (tagLookups || []).forEach((lookup: any) => {
    const productId = lookup.recurring_product_id;
    const tagId = lookup.recurring_product_tag_id;
    const tagName = tagMap.get(tagId);

    if (!productTagsMap.has(productId)) {
      productTagsMap.set(productId, []);
      productTagNamesMap.set(productId, []);
    }
    productTagsMap.get(productId)!.push(tagId);
    if (tagName) {
      productTagNamesMap.get(productId)!.push(tagName);
    }
  });

  // Map the data
  return products.map((product: any) => {
    const tagIds = productTagsMap.get(product.id) || [];
    const tagNames = productTagNamesMap.get(product.id) || [];
    
    return {
      ...product,
      supplier_name: product.supplier_id ? supplierMap.get(product.supplier_id) : undefined,
      handover_to_name: product.handover_to ? userMap.get(product.handover_to) : undefined,
      recurring_product_tag_ids: tagIds.length > 0 ? tagIds : undefined,
      recurring_product_tag_names: tagNames.length > 0 ? tagNames : undefined,
      // Legacy single tag support for backward compatibility
      recurring_product_tag_id: tagIds.length > 0 ? tagIds[0] : product.recurring_product_tag_id || undefined,
      recurring_product_tag_name: tagNames.length > 0 ? tagNames[0] : undefined,
    };
  });
}

export async function createRecurringProduct(product: Partial<RecurringProduct>): Promise<RecurringProduct> {
  // Generate lot_id if not provided
  const lotId = product.lot_id || await generateLotId('recurring_products');

  // Extract tag IDs (support both array and single value)
  const tagIds = product.recurring_product_tag_ids || (product.recurring_product_tag_id ? [product.recurring_product_tag_id] : []);
  
  // Remove tag fields from product data (they go in junction table)
  const { recurring_product_tag_ids, recurring_product_tag_names, recurring_product_tag_id, recurring_product_tag_name, ...productData } = product;

  // Ensure quantity_available is set to quantity_received if not provided
  const insertData = {
    ...productData,
    lot_id: lotId,
    quantity_available: product.quantity_available ?? product.quantity_received ?? 0,
  };

  console.log('Inserting recurring product data:', insertData);

  const { data, error } = await supabase
    .from('recurring_products')
    .insert([insertData])
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

  // Insert tags into junction table if provided
  if (tagIds.length > 0) {
    const tagLookups = tagIds.map(tagId => ({
      recurring_product_id: data.id,
      recurring_product_tag_id: tagId,
    }));

    const { error: tagError } = await supabase
      .from('recurring_product_tags_lookup')
      .insert(tagLookups);

    if (tagError) {
      console.error('Error inserting tags:', tagError);
    }
  }

  // Refetch with tags populated
  const result = await fetchRecurringProducts(true);
  const created = result.find(p => p.id === data.id);
  
  console.log('Recurring product created successfully:', created || data);
  return created || data as RecurringProduct;
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
  const { data: batches, error } = await supabase
    .from('production_batches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!batches || batches.length === 0) return [];

  // Get unique tag IDs
  const tagIds = [...new Set(batches.map((b: any) => b.produced_goods_tag_id).filter(Boolean))];

  // Fetch tags in parallel
  const tagsResult = tagIds.length > 0
    ? await supabase.from('produced_goods_tags').select('id, display_name').in('id', tagIds)
    : { data: [] };

  // Create lookup map
  const tagMap = new Map((tagsResult.data || []).map(t => [t.id, t.display_name]));

  // Map the data
  return batches.map((batch: any) => ({
    ...batch,
    produced_goods_tag_name: batch.produced_goods_tag_id ? tagMap.get(batch.produced_goods_tag_id) : undefined,
  }));
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

export async function updateProductionBatchOutput(batchId: string, outputData: {
  product_type: string;
  produced_goods_tag_ids?: string[];
  produced_goods_tag_id?: string; // Legacy support
  quantity: number;
  unit: string;
  qa_status: string;
  qa_reason?: string;
  production_start_date?: string;
  production_end_date?: string;
  additional_information?: string;
  custom_fields?: Array<{ key: string; value: string }>;
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

  // Extract tag IDs (support both array and single value for backward compatibility)
  const tagIds = outputData.produced_goods_tag_ids || (outputData.produced_goods_tag_id ? [outputData.produced_goods_tag_id] : []);

  // Update batch with output data (but don't lock)
  const updateData: any = {
    output_product_type: outputData.product_type,
    output_quantity: outputData.quantity,
    output_unit: outputData.unit,
    qa_status: outputData.qa_status,
  };

  // Store first tag in batch for backward compatibility (legacy single tag field)
  if (tagIds.length > 0) {
    updateData.produced_goods_tag_id = tagIds[0];
  } else if (outputData.produced_goods_tag_id) {
    updateData.produced_goods_tag_id = outputData.produced_goods_tag_id;
  }
  if (outputData.qa_reason) {
    updateData.qa_reason = outputData.qa_reason;
  }
  if (outputData.production_start_date) {
    updateData.production_start_date = outputData.production_start_date;
  }
  if (outputData.production_end_date) {
    updateData.production_end_date = outputData.production_end_date;
  }
  if (outputData.additional_information !== undefined) {
    updateData.additional_information = outputData.additional_information || null;
  }
  if (outputData.custom_fields !== undefined) {
    if (outputData.custom_fields && outputData.custom_fields.length > 0) {
      // Store as JSON string, only if there are fields
      try {
        updateData.custom_fields = JSON.stringify(outputData.custom_fields);
      } catch (jsonError) {
        console.error('Failed to stringify custom_fields:', jsonError);
        throw new Error('Failed to serialize custom fields. Please check the data format.');
      }
    } else {
      // Set to null if empty array or undefined
      updateData.custom_fields = null;
    }
  }

  const { data, error } = await supabase
    .from('production_batches')
    .update(updateData)
    .eq('id', batchId)
    .select()
    .single();

  if (error) {
    console.error('Update production batch output error:', error);
    // Check if error is due to missing columns
    if (error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
      throw new Error('Database schema is missing required columns. Please run the migration: 20250102000000_add_production_batch_fields.sql');
    }
    // Provide more detailed error message
    throw new Error(`Failed to update batch: ${error.message || 'Unknown error'}`);
  }
  return data;
}

export async function completeProductionBatch(batchId: string, outputData: {
  product_type: string;
  produced_goods_tag_ids?: string[];
  produced_goods_tag_id?: string; // Legacy support
  quantity: number;
  unit: string;
  qa_status: string;
  qa_reason?: string;
  production_start_date?: string;
  production_end_date?: string;
  additional_information?: string;
  custom_fields?: Array<{ key: string; value: string }>;
}): Promise<ProcessedGood | null> {
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

  // Prevent locking if status is hold
  if (outputData.qa_status === 'hold') {
    throw new Error('Hold status batches cannot be locked. Please approve or reject the batch first.');
  }

  // Extract tag IDs (support both array and single value for backward compatibility)
  const tagIds = outputData.produced_goods_tag_ids || (outputData.produced_goods_tag_id ? [outputData.produced_goods_tag_id] : []);

  // Lock the batch and save output data
  const updateData: any = {
    is_locked: true,
    qa_status: outputData.qa_status,
    output_product_type: outputData.product_type,
    output_quantity: outputData.quantity,
    output_unit: outputData.unit,
  };

  // Store first tag in batch for backward compatibility (legacy single tag field)
  if (tagIds.length > 0) {
    updateData.produced_goods_tag_id = tagIds[0];
  } else if (outputData.produced_goods_tag_id) {
    updateData.produced_goods_tag_id = outputData.produced_goods_tag_id;
  }
  if (outputData.qa_reason) {
    updateData.qa_reason = outputData.qa_reason;
  }
  if (outputData.production_start_date) {
    updateData.production_start_date = outputData.production_start_date;
  }
  if (outputData.production_end_date) {
    updateData.production_end_date = outputData.production_end_date;
  }
  if (outputData.additional_information !== undefined) {
    updateData.additional_information = outputData.additional_information;
  }
  if (outputData.custom_fields !== undefined) {
    // Store as JSON string
    updateData.custom_fields = JSON.stringify(outputData.custom_fields);
  }

  const { error: updateError } = await supabase
    .from('production_batches')
    .update(updateData)
    .eq('id', batchId);

  if (updateError) {
    // Check if error is due to missing columns
    if (updateError.message && (updateError.message.includes('column') || updateError.message.includes('does not exist'))) {
      throw new Error('Database schema is missing required columns. Please run the migration: 20250102000000_add_production_batch_fields.sql');
    }
    throw updateError;
  }

  // Create processed goods only if QA status is approved or hold
  // Approved = normal, Hold = red/caution background
  if (outputData.qa_status === 'approved' || outputData.qa_status === 'hold') {
    const processedGoodData: any = {
      batch_id: batchId,
      batch_reference: batch.batch_id,
      product_type: outputData.product_type,
      quantity_available: outputData.quantity,
      unit: outputData.unit,
      production_date: outputData.production_end_date || new Date().toISOString().split('T')[0],
      qa_status: outputData.qa_status,
    };

    // Store first tag in processed_goods for backward compatibility (legacy single tag field)
    if (tagIds.length > 0) {
      processedGoodData.produced_goods_tag_id = tagIds[0];
    } else if (outputData.produced_goods_tag_id) {
      processedGoodData.produced_goods_tag_id = outputData.produced_goods_tag_id;
    }

    const { data, error } = await supabase
      .from('processed_goods')
      .insert([processedGoodData])
      .select()
      .single();

    if (error) throw error;

    // Insert tags into junction table if provided
    if (tagIds.length > 0 && data) {
      const tagLookups = tagIds.map(tagId => ({
        processed_good_id: data.id,
        produced_goods_tag_id: tagId,
      }));

      const { error: tagError } = await supabase
        .from('produced_goods_tags_lookup')
        .insert(tagLookups);

      if (tagError) {
        console.error('Error inserting tags into junction table:', tagError);
        // Don't throw - tags are in junction table, processed good is created
      }
    }

    // Refetch with tags populated
    const result = await fetchProcessedGoods();
    const created = result.find(g => g.id === data.id);
    return created || data;
  }

  // Return null if rejected (no processed goods created)
  return null;
}

export async function updateRecurringProduct(id: string, updates: Partial<RecurringProduct>): Promise<RecurringProduct> {
  console.log('Updating recurring product:', id, updates);

  // Extract tag IDs if provided
  const tagIds = updates.recurring_product_tag_ids || (updates.recurring_product_tag_id ? [updates.recurring_product_tag_id] : undefined);
  
  // Remove tag fields from updates (they go in junction table)
  const { recurring_product_tag_ids, recurring_product_tag_names, recurring_product_tag_id, recurring_product_tag_name, ...productUpdates } = updates;

  // Update main product record if there are non-tag updates
  if (Object.keys(productUpdates).length > 0) {
    const { error } = await supabase
      .from('recurring_products')
      .update(productUpdates)
      .eq('id', id);

    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
  }

  // Update tags in junction table if tagIds is provided
  if (tagIds !== undefined) {
    // Delete existing tags
    const { error: deleteError } = await supabase
      .from('recurring_product_tags_lookup')
      .delete()
      .eq('recurring_product_id', id);

    if (deleteError) {
      console.error('Error deleting existing tags:', deleteError);
      throw deleteError;
    }

    // Insert new tags if provided
    if (tagIds.length > 0) {
      const tagLookups = tagIds.map(tagId => ({
        recurring_product_id: id,
        recurring_product_tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from('recurring_product_tags_lookup')
        .insert(tagLookups);

      if (insertError) {
        console.error('Error inserting tags:', insertError);
        throw insertError;
      }
    }
  }

  // Refetch with tags populated
  const result = await fetchRecurringProducts(true);
  const updated = result.find(p => p.id === id);
  
  if (!updated) {
    throw new Error('Failed to fetch updated recurring product');
  }

  console.log('Recurring product updated successfully:', updated);
  return updated;
}

export async function deleteRecurringProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_products')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function archiveRecurringProduct(id: string): Promise<RecurringProduct> {
  const { data, error } = await supabase
    .from('recurring_products')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      suppliers(name),
      handover_user:users!handover_to(full_name)
    `)
    .single();

  if (error) throw error;
  
  const product = data as any;
  return {
    ...product,
    supplier_name: product.suppliers?.name,
    handover_to_name: product.handover_user?.full_name,
  };
}

export async function unarchiveRecurringProduct(id: string): Promise<RecurringProduct> {
  const { data, error } = await supabase
    .from('recurring_products')
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      suppliers(name),
      handover_user:users!handover_to(full_name)
    `)
    .single();

  if (error) throw error;
  
  const product = data as any;
  return {
    ...product,
    supplier_name: product.suppliers?.name,
    handover_to_name: product.handover_user?.full_name,
  };
}


export async function approveBatch(id: string): Promise<void> {
  const { error } = await supabase
    .from('production_batches')
    .update({ qa_status: 'approved' })
    .eq('id', id);

  if (error) throw error;
}

export async function updateBatchQAStatus(batchId: string, qaStatus: 'approved' | 'rejected' | 'hold'): Promise<ProductionBatch> {
  // Get batch details first
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    throw new Error('Batch not found');
  }

  // Update QA status
  const { data, error } = await supabase
    .from('production_batches')
    .update({ qa_status: qaStatus })
    .eq('id', batchId)
    .select()
    .single();

  if (error) throw error;

  // If status changed to approved and processed goods don't exist, create them
  if (qaStatus === 'approved' && batch.output_product_type && batch.output_quantity && batch.output_unit) {
    const existing = await checkProcessedGoodsExists(batchId);
    if (!existing) {
      // Auto-create processed goods
      await moveBatchToProcessedGoods(batchId);
    }
  }

  return data;
}

export async function checkProcessedGoodsExists(batchId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('processed_goods')
    .select('id')
    .eq('batch_id', batchId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function moveBatchToProcessedGoods(batchId: string): Promise<ProcessedGood> {
  // Get batch details
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    throw new Error('Batch not found');
  }

  // Validate batch has output data
  if (!batch.output_product_type || !batch.output_quantity || !batch.output_unit) {
    throw new Error('Batch does not have complete output data. Cannot create processed goods.');
  }

  // Check if processed goods already exist
  const existing = await checkProcessedGoodsExists(batchId);
  if (existing) {
    throw new Error('Processed goods already exist for this batch.');
  }

  // Create processed goods entry
  const processedGoodData = {
    batch_id: batchId,
    batch_reference: batch.batch_id,
    product_type: batch.output_product_type,
    quantity_available: batch.output_quantity,
    unit: batch.output_unit,
    production_date: batch.batch_date || new Date().toISOString().split('T')[0],
    qa_status: batch.qa_status || 'approved',
  };

  const { data, error } = await supabase
    .from('processed_goods')
    .insert([processedGoodData])
    .select()
    .single();

  if (error) throw error;
  return data;
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
  // First, get the current quantity_available before deleting to avoid race conditions
  const { data: rawMaterial, error: fetchError } = await supabase
    .from('raw_materials')
    .select('quantity_available')
    .eq('id', rawMaterialId)
    .single();

  if (fetchError || !rawMaterial) {
    throw new Error(`Failed to fetch raw material: ${fetchError?.message || 'Raw material not found'}`);
  }

  // Delete the batch raw material entry
  const { error: deleteError } = await supabase
    .from('batch_raw_materials')
    .delete()
    .eq('id', batchRawMaterialId);

  if (deleteError) {
    throw new Error(`Failed to delete batch raw material: ${deleteError.message}`);
  }

  // Restore the quantity to the raw material
  const newQuantity = rawMaterial.quantity_available + quantityToRestore;
  const { error: updateError } = await supabase
    .from('raw_materials')
    .update({ quantity_available: newQuantity })
    .eq('id', rawMaterialId);

  if (updateError) {
    throw new Error(`Failed to restore quantity to raw material: ${updateError.message}. Please manually restore ${quantityToRestore} units to material ID ${rawMaterialId}`);
  }
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

// Fetch waste and transfer history for a raw material lot
export async function fetchRawMaterialWasteTransferHistory(rawMaterialId: string): Promise<{
  wasteRecords: Array<{
    waste_id: string;
    waste_date: string;
    quantity_wasted: number;
    unit: string;
    reason: string;
    notes?: string;
    type: 'waste';
  }>;
  transferRecords: Array<{
    transfer_id: string;
    transfer_date: string;
    quantity_transferred: number;
    unit: string;
    reason: string;
    notes?: string;
    from_lot_id: string;
    from_lot_identifier: string;
    from_lot_name?: string;
    to_lot_id: string;
    to_lot_identifier: string;
    to_lot_name?: string;
    type: 'transfer_out' | 'transfer_in';
  }>;
}> {
  // Fetch waste records for this lot
  const { data: wasteData, error: wasteError } = await supabase
    .from('waste_tracking')
    .select('waste_id, waste_date, quantity_wasted, unit, reason, notes, created_at')
    .eq('lot_id', rawMaterialId)
    .eq('lot_type', 'raw_material')
    .order('waste_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (wasteError) throw wasteError;

  // Fetch transfer records where this lot is the source (transfer out)
  const { data: transferOutData, error: transferOutError } = await supabase
    .from('transfer_tracking')
    .select('transfer_id, transfer_date, quantity_transferred, unit, reason, notes, to_lot_id, to_lot_identifier, created_at')
    .eq('from_lot_id', rawMaterialId)
    .eq('lot_type', 'raw_material')
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (transferOutError) throw transferOutError;

  // Fetch transfer records where this lot is the destination (transfer in)
  const { data: transferInData, error: transferInError } = await supabase
    .from('transfer_tracking')
    .select('transfer_id, transfer_date, quantity_transferred, unit, reason, notes, from_lot_id, from_lot_identifier, created_at')
    .eq('to_lot_id', rawMaterialId)
    .eq('lot_type', 'raw_material')
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (transferInError) throw transferInError;

  // Get lot IDs to fetch names
  const toLotIds = [...new Set((transferOutData || []).map((t: any) => t.to_lot_id).filter(Boolean))];
  const fromLotIds = [...new Set((transferInData || []).map((t: any) => t.from_lot_id).filter(Boolean))];
  const allLotIds = [...new Set([...toLotIds, ...fromLotIds])];

  // Fetch lot names
  let lotNameMap = new Map<string, string>();
  if (allLotIds.length > 0) {
    const { data: lots, error: lotsError } = await supabase
      .from('raw_materials')
      .select('id, name')
      .in('id', allLotIds);

    if (!lotsError && lots) {
      lotNameMap = new Map(lots.map((l: any) => [l.id, l.name]));
    }
  }

  const wasteRecords = (wasteData || []).map((w: any) => ({
    waste_id: w.waste_id || 'N/A',
    waste_date: w.waste_date,
    quantity_wasted: w.quantity_wasted,
    unit: w.unit,
    reason: w.reason,
    notes: w.notes,
    type: 'waste' as const,
  }));

  // Get current lot info for display
  const { data: currentLot } = await supabase
    .from('raw_materials')
    .select('lot_id, name')
    .eq('id', rawMaterialId)
    .single();

  const transferRecords = [
    ...(transferOutData || []).map((t: any) => ({
      transfer_id: t.transfer_id || 'N/A',
      transfer_date: t.transfer_date,
      quantity_transferred: t.quantity_transferred,
      unit: t.unit,
      reason: t.reason,
      notes: t.notes,
      from_lot_id: rawMaterialId,
      from_lot_identifier: currentLot?.lot_id || '',
      from_lot_name: currentLot?.name,
      to_lot_id: t.to_lot_id,
      to_lot_identifier: t.to_lot_identifier,
      to_lot_name: lotNameMap.get(t.to_lot_id),
      type: 'transfer_out' as const,
      created_at: t.created_at,
    })),
    ...(transferInData || []).map((t: any) => ({
      transfer_id: t.transfer_id || 'N/A',
      transfer_date: t.transfer_date,
      quantity_transferred: t.quantity_transferred,
      unit: t.unit,
      reason: t.reason,
      notes: t.notes,
      from_lot_id: t.from_lot_id,
      from_lot_identifier: t.from_lot_identifier,
      from_lot_name: lotNameMap.get(t.from_lot_id),
      to_lot_id: rawMaterialId,
      to_lot_identifier: currentLot?.lot_id || '',
      to_lot_name: currentLot?.name,
      type: 'transfer_in' as const,
      created_at: t.created_at,
    })),
  ];

  return { wasteRecords, transferRecords };
}

// Fetch waste and transfer history for a recurring product lot
export async function fetchRecurringProductWasteTransferHistory(recurringProductId: string): Promise<{
  wasteRecords: Array<{
    waste_id: string;
    waste_date: string;
    quantity_wasted: number;
    unit: string;
    reason: string;
    notes?: string;
    type: 'waste';
  }>;
  transferRecords: Array<{
    transfer_id: string;
    transfer_date: string;
    quantity_transferred: number;
    unit: string;
    reason: string;
    notes?: string;
    from_lot_id: string;
    from_lot_identifier: string;
    from_lot_name?: string;
    to_lot_id: string;
    to_lot_identifier: string;
    to_lot_name?: string;
    type: 'transfer_out' | 'transfer_in';
  }>;
}> {
  // Fetch waste records for this lot
  const { data: wasteData, error: wasteError } = await supabase
    .from('waste_tracking')
    .select('waste_id, waste_date, quantity_wasted, unit, reason, notes, created_at')
    .eq('lot_id', recurringProductId)
    .eq('lot_type', 'recurring_product')
    .order('waste_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (wasteError) throw wasteError;

  // Fetch transfer records where this lot is the source (transfer out)
  const { data: transferOutData, error: transferOutError } = await supabase
    .from('transfer_tracking')
    .select('transfer_id, transfer_date, quantity_transferred, unit, reason, notes, to_lot_id, to_lot_identifier, created_at')
    .eq('from_lot_id', recurringProductId)
    .eq('lot_type', 'recurring_product')
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (transferOutError) throw transferOutError;

  // Fetch transfer records where this lot is the destination (transfer in)
  const { data: transferInData, error: transferInError } = await supabase
    .from('transfer_tracking')
    .select('transfer_id, transfer_date, quantity_transferred, unit, reason, notes, from_lot_id, from_lot_identifier, created_at')
    .eq('to_lot_id', recurringProductId)
    .eq('lot_type', 'recurring_product')
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (transferInError) throw transferInError;

  // Get lot IDs to fetch names
  const toLotIds = [...new Set((transferOutData || []).map((t: any) => t.to_lot_id).filter(Boolean))];
  const fromLotIds = [...new Set((transferInData || []).map((t: any) => t.from_lot_id).filter(Boolean))];
  const allLotIds = [...new Set([...toLotIds, ...fromLotIds])];

  // Fetch lot names
  let lotNameMap = new Map<string, string>();
  if (allLotIds.length > 0) {
    const { data: lots, error: lotsError } = await supabase
      .from('recurring_products')
      .select('id, name')
      .in('id', allLotIds);

    if (!lotsError && lots) {
      lotNameMap = new Map(lots.map((l: any) => [l.id, l.name]));
    }
  }

  const wasteRecords = (wasteData || []).map((w: any) => ({
    waste_id: w.waste_id || 'N/A',
    waste_date: w.waste_date,
    quantity_wasted: w.quantity_wasted,
    unit: w.unit,
    reason: w.reason,
    notes: w.notes,
    type: 'waste' as const,
    created_at: w.created_at,
  }));

  // Get current lot info for display
  const { data: currentLot } = await supabase
    .from('recurring_products')
    .select('lot_id, name')
    .eq('id', recurringProductId)
    .single();

  const transferRecords = [
    ...(transferOutData || []).map((t: any) => ({
      transfer_id: t.transfer_id || 'N/A',
      transfer_date: t.transfer_date,
      quantity_transferred: t.quantity_transferred,
      unit: t.unit,
      reason: t.reason,
      notes: t.notes,
      from_lot_id: recurringProductId,
      from_lot_identifier: currentLot?.lot_id || '',
      from_lot_name: currentLot?.name,
      to_lot_id: t.to_lot_id,
      to_lot_identifier: t.to_lot_identifier,
      to_lot_name: lotNameMap.get(t.to_lot_id),
      type: 'transfer_out' as const,
      created_at: t.created_at,
    })),
    ...(transferInData || []).map((t: any) => ({
      transfer_id: t.transfer_id || 'N/A',
      transfer_date: t.transfer_date,
      quantity_transferred: t.quantity_transferred,
      unit: t.unit,
      reason: t.reason,
      notes: t.notes,
      from_lot_id: t.from_lot_id,
      from_lot_identifier: t.from_lot_identifier,
      from_lot_name: lotNameMap.get(t.from_lot_id),
      to_lot_id: recurringProductId,
      to_lot_identifier: currentLot?.lot_id || '',
      to_lot_name: currentLot?.name,
      type: 'transfer_in' as const,
      created_at: t.created_at,
    })),
  ];

  return { wasteRecords, transferRecords };
}

export async function deleteBatchRecurringProduct(batchRecurringProductId: string, recurringProductId: string, quantityToRestore: number): Promise<void> {
  // First, get the current quantity_available before deleting to avoid race conditions
  const { data: product, error: fetchError } = await supabase
    .from('recurring_products')
    .select('quantity_available')
    .eq('id', recurringProductId)
    .single();

  if (fetchError || !product) {
    throw new Error(`Failed to fetch recurring product: ${fetchError?.message || 'Recurring product not found'}`);
  }

  // Delete the batch recurring product entry
  const { error: deleteError } = await supabase
    .from('batch_recurring_products')
    .delete()
    .eq('id', batchRecurringProductId);

  if (deleteError) {
    throw new Error(`Failed to delete batch recurring product: ${deleteError.message}`);
  }

  // Restore the quantity to the recurring product
  const newQuantity = product.quantity_available + quantityToRestore;
  const { error: updateError } = await supabase
    .from('recurring_products')
    .update({ quantity_available: newQuantity })
    .eq('id', recurringProductId);

  if (updateError) {
    throw new Error(`Failed to restore quantity to recurring product: ${updateError.message}. Please manually restore ${quantityToRestore} units to product ID ${recurringProductId}`);
  }
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
  const { data: goods, error } = await supabase
    .from('processed_goods')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!goods || goods.length === 0) return [];

  const goodIds = goods.map(g => g.id);

  // Fetch tags from junction table
  const { data: tagLookups, error: tagLookupError } = await supabase
    .from('produced_goods_tags_lookup')
    .select('processed_good_id, produced_goods_tag_id')
    .in('processed_good_id', goodIds);

  if (tagLookupError) throw tagLookupError;

  // Get unique tag IDs from lookups
  const tagIds = [...new Set((tagLookups || []).map(t => t.produced_goods_tag_id))];

  // Fetch tags in parallel
  const tagsResult = tagIds.length > 0
    ? await supabase.from('produced_goods_tags').select('id, display_name').in('id', tagIds)
    : { data: [] };

  // Create lookup map
  const tagMap = new Map((tagsResult.data || []).map(t => [t.id, t.display_name]));

  // Create good -> tags map from junction table
  const goodTagsMap = new Map<string, string[]>();
  const goodTagNamesMap = new Map<string, string[]>();
  
  (tagLookups || []).forEach((lookup: any) => {
    const goodId = lookup.processed_good_id;
    const tagId = lookup.produced_goods_tag_id;
    const tagName = tagMap.get(tagId);

    if (!goodTagsMap.has(goodId)) {
      goodTagsMap.set(goodId, []);
      goodTagNamesMap.set(goodId, []);
    }
    goodTagsMap.get(goodId)!.push(tagId);
    if (tagName) {
      goodTagNamesMap.get(goodId)!.push(tagName);
    }
  });

  // Map the data
  return goods.map((good: any) => {
    const tagIds = goodTagsMap.get(good.id) || [];
    const tagNames = goodTagNamesMap.get(good.id) || [];
    
    return {
      ...good,
      produced_goods_tag_ids: tagIds.length > 0 ? tagIds : undefined,
      produced_goods_tag_names: tagNames.length > 0 ? tagNames : undefined,
      // Legacy single tag support for backward compatibility
      produced_goods_tag_id: tagIds.length > 0 ? tagIds[0] : good.produced_goods_tag_id || undefined,
      produced_goods_tag_name: tagNames.length > 0 ? tagNames[0] : undefined,
    };
  });
}

export async function fetchMachines(): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select(`
      *,
      suppliers!machines_supplier_id_fkey(name)
    `)
    .order('created_at', { ascending: false });

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
// NOTE: This function can overwrite lots even if used in locked production batches
// This is intentional for accountability purposes - only waste & transfer section can do this
export async function recordWaste(
  lotType: 'raw_material' | 'recurring_product',
  lotId: string,
  quantityWasted: number,
  reason: string,
  notes?: string,
  wasteDate?: string,
  createdBy?: string
): Promise<WasteRecord> {
  // First, get the lot details - try with description_log first, fallback if column doesn't exist
  const table = lotType === 'raw_material' ? 'raw_materials' : 'recurring_products';
  let lot: any;
  let hasDescriptionLog = false;
  
  // Try to fetch with description_log
  const { data: lotWithLog, error: lotErrorWithLog } = await supabase
    .from(table)
    .select('lot_id, name, quantity_available, unit, description_log')
    .eq('id', lotId)
    .single();

  if (lotErrorWithLog) {
    // If error is about missing column, try without description_log
    if (lotErrorWithLog.message?.includes('column') || lotErrorWithLog.message?.includes('does not exist')) {
      const { data: lotWithoutLog, error: lotErrorWithoutLog } = await supabase
        .from(table)
        .select('lot_id, name, quantity_available, unit')
        .eq('id', lotId)
        .single();
      
      if (lotErrorWithoutLog) throw lotErrorWithoutLog;
      if (!lotWithoutLog) throw new Error('Lot not found');
      lot = lotWithoutLog;
      hasDescriptionLog = false;
    } else {
      throw lotErrorWithLog;
    }
  } else {
    if (!lotWithLog) throw new Error('Lot not found');
    lot = lotWithLog;
    hasDescriptionLog = true;
  }

  // Validate quantity
  if (quantityWasted > lot.quantity_available) {
    throw new Error(`Cannot waste ${quantityWasted} ${lot.unit}. Only ${lot.quantity_available} ${lot.unit} available.`);
  }

  // NOTE: Removed locked batch check - waste & transfer section can overwrite even if used in locked batches
  // This is intentional for accountability purposes

  // Generate unique waste_id
  const wasteId = await generateWasteId();

  // Create waste record
  const { data: wasteRecord, error: wasteError } = await supabase
    .from('waste_tracking')
    .insert([{
      waste_id: wasteId,
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

  // Build update data
  const updateData: any = {
    quantity_available: lot.quantity_available - quantityWasted,
  };

  // Only update description_log if the column exists
  if (hasDescriptionLog) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] WASTE: Quantity ${quantityWasted} ${lot.unit} wasted. Reason: ${reason}${notes ? `. Notes: ${notes}` : ''}`;
    updateData.description_log = lot.description_log 
      ? `${lot.description_log}\n${logEntry}`
      : logEntry;
  }

  // Update the lot's available quantity and description log (if column exists)
  const { error: updateError } = await supabase
    .from(table)
    .update(updateData)
    .eq('id', lotId);

  if (updateError) throw updateError;

  return {
    ...wasteRecord,
    lot_name: lot.name,
  };
}

// Transfer quantity from one lot to another
// NOTE: This function can overwrite lots even if used in locked production batches
// This is intentional for accountability purposes - only waste & transfer section can do this
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

  // Try to get both lots with description_log first, fallback if column doesn't exist
  let lots: any[];
  let hasDescriptionLog = false;
  
  const { data: lotsWithLog, error: lotsErrorWithLog } = await supabase
    .from(table)
    .select('id, lot_id, name, quantity_available, unit, description_log')
    .in('id', [fromLotId, toLotId]);

  if (lotsErrorWithLog) {
    // If error is about missing column, try without description_log
    if (lotsErrorWithLog.message?.includes('column') || lotsErrorWithLog.message?.includes('does not exist')) {
      const { data: lotsWithoutLog, error: lotsErrorWithoutLog } = await supabase
        .from(table)
        .select('id, lot_id, name, quantity_available, unit')
        .in('id', [fromLotId, toLotId]);
      
      if (lotsErrorWithoutLog) throw lotsErrorWithoutLog;
      if (!lotsWithoutLog || lotsWithoutLog.length !== 2) {
        throw new Error('One or both lots not found');
      }
      lots = lotsWithoutLog;
      hasDescriptionLog = false;
    } else {
      throw lotsErrorWithLog;
    }
  } else {
    if (!lotsWithLog || lotsWithLog.length !== 2) {
      throw new Error('One or both lots not found');
    }
    lots = lotsWithLog;
    hasDescriptionLog = true;
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

  // NOTE: Removed locked batch check - waste & transfer section can overwrite even if used in locked batches
  // This is intentional for accountability purposes

  // Generate unique transfer_id
  const transferId = await generateTransferId();

  // Create transfer record
  const { data: transferRecord, error: transferError } = await supabase
    .from('transfer_tracking')
    .insert([{
      transfer_id: transferId,
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

  // Build update data for both lots
  const updateFromData: any = {
    quantity_available: fromLot.quantity_available - quantityTransferred,
  };

  const updateToData: any = {
    quantity_available: toLot.quantity_available + quantityTransferred,
  };

  // Only update description_log if the column exists
  if (hasDescriptionLog) {
    const timestamp = new Date().toISOString();
    
    // From lot log entry
    const fromLogEntry = `[${timestamp}] TRANSFER OUT: Transferred ${quantityTransferred} ${fromLot.unit} to ${toLot.lot_id} (${toLot.name}). Reason: ${reason}${notes ? `. Notes: ${notes}` : ''}`;
    updateFromData.description_log = fromLot.description_log 
      ? `${fromLot.description_log}\n${fromLogEntry}`
      : fromLogEntry;

    // To lot log entry
    const toLogEntry = `[${timestamp}] TRANSFER IN: Received ${quantityTransferred} ${toLot.unit} from ${fromLot.lot_id} (${fromLot.name}). Reason: ${reason}${notes ? `. Notes: ${notes}` : ''}`;
    updateToData.description_log = toLot.description_log 
      ? `${toLot.description_log}\n${toLogEntry}`
      : toLogEntry;
  }

  // Update both lots with new quantities and description logs (if column exists)
  const { error: updateFromError } = await supabase
    .from(table)
    .update(updateFromData)
    .eq('id', fromLotId);

  if (updateFromError) throw updateFromError;

  const { error: updateToError } = await supabase
    .from(table)
    .update(updateToData)
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
      .select('id, name, is_archived')
      .in('id', lotIds);

    if (!lotsError && lots) {
      lotNameMap = new Map(lots.map((l: any) => [l.id, l.name]));
      // Store archived status for each lot
      lots.forEach((l: any) => {
        const record = data.find((item: any) => item.lot_id === l.id);
        if (record) {
          record.lot_is_archived = l.is_archived || false;
        }
      });
    }
  }

  // Map the data
  return data.map((item: any) => ({
    ...item,
    created_by_name: item.created_by ? userMap.get(item.created_by) : undefined,
    lot_name: item.lot_id ? lotNameMap.get(item.lot_id) : undefined,
    lot_is_archived: item.lot_is_archived || false,
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
      .select('id, name, is_archived')
      .in('id', allLotIds);

    if (!lotsError && lots) {
      lotNameMap = new Map(lots.map((l: any) => [l.id, l.name]));
      // Store archived status for each lot
      lots.forEach((l: any) => {
        const fromRecord = data.find((item: any) => item.from_lot_id === l.id);
        const toRecord = data.find((item: any) => item.to_lot_id === l.id);
        if (fromRecord) {
          fromRecord.from_lot_is_archived = l.is_archived || false;
        }
        if (toRecord) {
          toRecord.to_lot_is_archived = l.is_archived || false;
        }
      });
    }
  }

  // Map the data
  return data.map((item: any) => ({
    ...item,
    created_by_name: item.created_by ? userMap.get(item.created_by) : undefined,
    from_lot_name: item.from_lot_id ? lotNameMap.get(item.from_lot_id) : undefined,
    from_lot_is_archived: item.from_lot_is_archived || false,
    to_lot_name: item.to_lot_id ? lotNameMap.get(item.to_lot_id) : undefined,
    to_lot_is_archived: item.to_lot_is_archived || false,
  }));
}
