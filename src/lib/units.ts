import { supabase } from './supabase';
import type {
  RawMaterialUnit,
  RecurringProductUnit,
  ProducedGoodsUnit,
  UnitType,
  UnitStatus,
  CreateUnitInput,
  UpdateUnitInput,
} from '../types/units';

// ============================================
// RAW MATERIAL UNITS
// ============================================

export async function fetchRawMaterialUnits(includeInactive = false): Promise<RawMaterialUnit[]> {
  let query = supabase
    .from('raw_material_units')
    .select('*')
    .order('display_name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching raw material units:', error);
    throw new Error(`Failed to fetch raw material units: ${error.message}`);
  }

  return data || [];
}

export async function createRawMaterialUnit(
  input: CreateUnitInput,
  userId: string
): Promise<RawMaterialUnit> {
  const { data, error } = await supabase
    .from('raw_material_units')
    .insert({
      unit_key: input.unit_key,
      display_name: input.display_name,
      description: input.description || null,
      allows_decimal: input.allows_decimal,
      status: input.status || 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating raw material unit:', error);
    throw new Error(`Failed to create raw material unit: ${error.message}`);
  }

  return data;
}

export async function updateRawMaterialUnit(
  id: string,
  input: UpdateUnitInput,
  userId: string
): Promise<RawMaterialUnit> {
  const updateData: Record<string, unknown> = {
    updated_by: userId,
  };

  if (input.display_name !== undefined) updateData.display_name = input.display_name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.allows_decimal !== undefined) updateData.allows_decimal = input.allows_decimal;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('raw_material_units')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating raw material unit:', error);
    throw new Error(`Failed to update raw material unit: ${error.message}`);
  }

  return data;
}

export async function checkRawMaterialUnitUsage(unitId: string): Promise<number> {
  // Get unit display_name first
  const unitResult = await supabase.from('raw_material_units').select('display_name').eq('id', unitId).single();
  
  if (unitResult.error || !unitResult.data) {
    console.error('Error fetching unit:', unitResult.error);
    throw new Error(`Failed to fetch unit: ${unitResult.error?.message || 'Unit not found'}`);
  }

  // Check usage by matching unit display_name
  const { count, error } = await supabase
    .from('raw_materials')
    .select('*', { count: 'exact', head: true })
    .eq('unit', unitResult.data.display_name);

  if (error) {
    console.error('Error checking raw material unit usage:', error);
    throw new Error(`Failed to check unit usage: ${error.message}`);
  }

  return count || 0;
}

export async function deleteRawMaterialUnit(unitId: string): Promise<void> {
  const usageCount = await checkRawMaterialUnitUsage(unitId);
  if (usageCount > 0) {
    throw new Error(`Cannot delete unit. It is used by ${usageCount} raw material(s).`);
  }

  const { error } = await supabase.from('raw_material_units').delete().eq('id', unitId);

  if (error) {
    console.error('Error deleting raw material unit:', error);
    throw new Error(`Failed to delete raw material unit: ${error.message}`);
  }
}

// ============================================
// RECURRING PRODUCT UNITS
// ============================================

export async function fetchRecurringProductUnits(
  includeInactive = false
): Promise<RecurringProductUnit[]> {
  let query = supabase
    .from('recurring_product_units')
    .select('*')
    .order('display_name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching recurring product units:', error);
    throw new Error(`Failed to fetch recurring product units: ${error.message}`);
  }

  return data || [];
}

export async function createRecurringProductUnit(
  input: CreateUnitInput,
  userId: string
): Promise<RecurringProductUnit> {
  const { data, error } = await supabase
    .from('recurring_product_units')
    .insert({
      unit_key: input.unit_key,
      display_name: input.display_name,
      description: input.description || null,
      allows_decimal: input.allows_decimal,
      status: input.status || 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating recurring product unit:', error);
    throw new Error(`Failed to create recurring product unit: ${error.message}`);
  }

  return data;
}

export async function updateRecurringProductUnit(
  id: string,
  input: UpdateUnitInput,
  userId: string
): Promise<RecurringProductUnit> {
  const updateData: Record<string, unknown> = {
    updated_by: userId,
  };

  if (input.display_name !== undefined) updateData.display_name = input.display_name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.allows_decimal !== undefined) updateData.allows_decimal = input.allows_decimal;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('recurring_product_units')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating recurring product unit:', error);
    throw new Error(`Failed to update recurring product unit: ${error.message}`);
  }

  return data;
}

export async function checkRecurringProductUnitUsage(unitId: string): Promise<number> {
  const unit = await supabase.from('recurring_product_units').select('display_name').eq('id', unitId).single();
  if (unit.data) {
    const { count, error } = await supabase
      .from('recurring_products')
      .select('*', { count: 'exact', head: true })
      .eq('unit', unit.data.display_name);

    if (error) {
      console.error('Error checking recurring product unit usage:', error);
      throw new Error(`Failed to check unit usage: ${error.message}`);
    }

    return count || 0;
  }

  return 0;
}

export async function deleteRecurringProductUnit(unitId: string): Promise<void> {
  const usageCount = await checkRecurringProductUnitUsage(unitId);
  if (usageCount > 0) {
    throw new Error(`Cannot delete unit. It is used by ${usageCount} recurring product(s).`);
  }

  const { error } = await supabase.from('recurring_product_units').delete().eq('id', unitId);

  if (error) {
    console.error('Error deleting recurring product unit:', error);
    throw new Error(`Failed to delete recurring product unit: ${error.message}`);
  }
}

// ============================================
// PRODUCED GOODS UNITS
// ============================================

export async function fetchProducedGoodsUnits(includeInactive = false): Promise<ProducedGoodsUnit[]> {
  let query = supabase
    .from('produced_goods_units')
    .select('*')
    .order('display_name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching produced goods units:', error);
    throw new Error(`Failed to fetch produced goods units: ${error.message}`);
  }

  return data || [];
}

export async function createProducedGoodsUnit(
  input: CreateUnitInput,
  userId: string
): Promise<ProducedGoodsUnit> {
  const { data, error } = await supabase
    .from('produced_goods_units')
    .insert({
      unit_key: input.unit_key,
      display_name: input.display_name,
      description: input.description || null,
      allows_decimal: input.allows_decimal,
      status: input.status || 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating produced goods unit:', error);
    throw new Error(`Failed to create produced goods unit: ${error.message}`);
  }

  return data;
}

export async function updateProducedGoodsUnit(
  id: string,
  input: UpdateUnitInput,
  userId: string
): Promise<ProducedGoodsUnit> {
  const updateData: Record<string, unknown> = {
    updated_by: userId,
  };

  if (input.display_name !== undefined) updateData.display_name = input.display_name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.allows_decimal !== undefined) updateData.allows_decimal = input.allows_decimal;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('produced_goods_units')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating produced goods unit:', error);
    throw new Error(`Failed to update produced goods unit: ${error.message}`);
  }

  return data;
}

export async function checkProducedGoodsUnitUsage(unitId: string): Promise<number> {
  const unit = await supabase.from('produced_goods_units').select('display_name').eq('id', unitId).single();
  if (unit.data) {
    // Check usage in processed_goods and batch_outputs
    const [processedCount, batchCount] = await Promise.all([
      supabase
        .from('processed_goods')
        .select('*', { count: 'exact', head: true })
        .eq('unit', unit.data.display_name),
      supabase
        .from('batch_outputs')
        .select('*', { count: 'exact', head: true })
        .eq('output_size_unit', unit.data.display_name),
    ]);

    if (processedCount.error || batchCount.error) {
      console.error('Error checking produced goods unit usage:', processedCount.error || batchCount.error);
      throw new Error(`Failed to check unit usage: ${processedCount.error?.message || batchCount.error?.message}`);
    }

    return (processedCount.count || 0) + (batchCount.count || 0);
  }

  return 0;
}

export async function deleteProducedGoodsUnit(unitId: string): Promise<void> {
  const usageCount = await checkProducedGoodsUnitUsage(unitId);
  if (usageCount > 0) {
    throw new Error(`Cannot delete unit. It is used by ${usageCount} produced good(s) or production batch(es).`);
  }

  const { error } = await supabase.from('produced_goods_units').delete().eq('id', unitId);

  if (error) {
    console.error('Error deleting produced goods unit:', error);
    throw new Error(`Failed to delete produced goods unit: ${error.message}`);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function validateUnitKey(unitKey: string): boolean {
  // Unit key must be lowercase, alphanumeric with underscores, no spaces
  const unitKeyPattern = /^[a-z0-9_]+$/;
  return unitKeyPattern.test(unitKey);
}

export function formatUnitKey(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-/g, '_') // Replace hyphens with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}
