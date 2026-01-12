import { supabase } from './supabase';
import type {
  RawMaterialTag,
  RecurringProductTag,
  ProducedGoodsTag,
  TagType,
  TagStatus,
  CreateTagInput,
  UpdateTagInput,
} from '../types/tags';

// ============================================
// RAW MATERIAL TAGS
// ============================================

export async function fetchRawMaterialTags(includeInactive = false): Promise<RawMaterialTag[]> {
  let query = supabase
    .from('raw_material_tags')
    .select('*')
    .order('display_name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching raw material tags:', error);
    throw new Error(`Failed to fetch raw material tags: ${error.message}`);
  }

  return data || [];
}

export async function createRawMaterialTag(
  input: CreateTagInput,
  userId: string
): Promise<RawMaterialTag> {
  const { data, error } = await supabase
    .from('raw_material_tags')
    .insert({
      tag_key: input.tag_key,
      display_name: input.display_name,
      description: input.description || null,
      status: input.status || 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating raw material tag:', error);
    throw new Error(`Failed to create raw material tag: ${error.message}`);
  }

  return data;
}

export async function updateRawMaterialTag(
  id: string,
  input: UpdateTagInput,
  userId: string
): Promise<RawMaterialTag> {
  const updateData: Record<string, unknown> = {
    updated_by: userId,
  };

  if (input.display_name !== undefined) updateData.display_name = input.display_name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('raw_material_tags')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating raw material tag:', error);
    throw new Error(`Failed to update raw material tag: ${error.message}`);
  }

  return data;
}

export async function checkRawMaterialTagUsage(tagId: string): Promise<number> {
  const { count, error } = await supabase
    .from('raw_materials')
    .select('*', { count: 'exact', head: true })
    .eq('raw_material_tag_id', tagId);

  if (error) {
    console.error('Error checking raw material tag usage:', error);
    throw new Error(`Failed to check tag usage: ${error.message}`);
  }

  return count || 0;
}

export async function deleteRawMaterialTag(tagId: string): Promise<void> {
  const usageCount = await checkRawMaterialTagUsage(tagId);
  if (usageCount > 0) {
    throw new Error(`Cannot delete tag. It is used by ${usageCount} raw material(s).`);
  }

  const { error } = await supabase.from('raw_material_tags').delete().eq('id', tagId);

  if (error) {
    console.error('Error deleting raw material tag:', error);
    throw new Error(`Failed to delete raw material tag: ${error.message}`);
  }
}

// ============================================
// RECURRING PRODUCT TAGS
// ============================================

export async function fetchRecurringProductTags(
  includeInactive = false
): Promise<RecurringProductTag[]> {
  let query = supabase
    .from('recurring_product_tags')
    .select('*')
    .order('display_name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching recurring product tags:', error);
    throw new Error(`Failed to fetch recurring product tags: ${error.message}`);
  }

  return data || [];
}

export async function createRecurringProductTag(
  input: CreateTagInput,
  userId: string
): Promise<RecurringProductTag> {
  const { data, error } = await supabase
    .from('recurring_product_tags')
    .insert({
      tag_key: input.tag_key,
      display_name: input.display_name,
      description: input.description || null,
      status: input.status || 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating recurring product tag:', error);
    throw new Error(`Failed to create recurring product tag: ${error.message}`);
  }

  return data;
}

export async function updateRecurringProductTag(
  id: string,
  input: UpdateTagInput,
  userId: string
): Promise<RecurringProductTag> {
  const updateData: Record<string, unknown> = {
    updated_by: userId,
  };

  if (input.display_name !== undefined) updateData.display_name = input.display_name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('recurring_product_tags')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating recurring product tag:', error);
    throw new Error(`Failed to update recurring product tag: ${error.message}`);
  }

  return data;
}

export async function checkRecurringProductTagUsage(tagId: string): Promise<number> {
  const { count, error } = await supabase
    .from('recurring_products')
    .select('*', { count: 'exact', head: true })
    .eq('recurring_product_tag_id', tagId);

  if (error) {
    console.error('Error checking recurring product tag usage:', error);
    throw new Error(`Failed to check tag usage: ${error.message}`);
  }

  return count || 0;
}

export async function deleteRecurringProductTag(tagId: string): Promise<void> {
  const usageCount = await checkRecurringProductTagUsage(tagId);
  if (usageCount > 0) {
    throw new Error(`Cannot delete tag. It is used by ${usageCount} recurring product(s).`);
  }

  const { error } = await supabase.from('recurring_product_tags').delete().eq('id', tagId);

  if (error) {
    console.error('Error deleting recurring product tag:', error);
    throw new Error(`Failed to delete recurring product tag: ${error.message}`);
  }
}

// ============================================
// PRODUCED GOODS TAGS
// ============================================

export async function fetchProducedGoodsTags(includeInactive = false): Promise<ProducedGoodsTag[]> {
  let query = supabase
    .from('produced_goods_tags')
    .select('*')
    .order('display_name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching produced goods tags:', error);
    throw new Error(`Failed to fetch produced goods tags: ${error.message}`);
  }

  return data || [];
}

export async function createProducedGoodsTag(
  input: CreateTagInput,
  userId: string
): Promise<ProducedGoodsTag> {
  const { data, error } = await supabase
    .from('produced_goods_tags')
    .insert({
      tag_key: input.tag_key,
      display_name: input.display_name,
      description: input.description || null,
      status: input.status || 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating produced goods tag:', error);
    throw new Error(`Failed to create produced goods tag: ${error.message}`);
  }

  return data;
}

export async function updateProducedGoodsTag(
  id: string,
  input: UpdateTagInput,
  userId: string
): Promise<ProducedGoodsTag> {
  const updateData: Record<string, unknown> = {
    updated_by: userId,
  };

  if (input.display_name !== undefined) updateData.display_name = input.display_name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('produced_goods_tags')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating produced goods tag:', error);
    throw new Error(`Failed to update produced goods tag: ${error.message}`);
  }

  return data;
}

export async function checkProducedGoodsTagUsage(tagId: string): Promise<number> {
  // Check usage in both processed_goods_tags_lookup junction table and production_batches
  const [processedCount, batchCount] = await Promise.all([
    supabase
      .from('produced_goods_tags_lookup')
      .select('*', { count: 'exact', head: true })
      .eq('produced_goods_tag_id', tagId),
    supabase
      .from('production_batches')
      .select('*', { count: 'exact', head: true })
      .eq('produced_goods_tag_id', tagId),
  ]);

  if (processedCount.error || batchCount.error) {
    console.error('Error checking produced goods tag usage:', processedCount.error || batchCount.error);
    throw new Error(`Failed to check tag usage: ${processedCount.error?.message || batchCount.error?.message}`);
  }

  return (processedCount.count || 0) + (batchCount.count || 0);
}

export async function deleteProducedGoodsTag(tagId: string): Promise<void> {
  const usageCount = await checkProducedGoodsTagUsage(tagId);
  if (usageCount > 0) {
    throw new Error(`Cannot delete tag. It is used by ${usageCount} produced good(s) or production batch(es).`);
  }

  const { error } = await supabase.from('produced_goods_tags').delete().eq('id', tagId);

  if (error) {
    console.error('Error deleting produced goods tag:', error);
    throw new Error(`Failed to delete produced goods tag: ${error.message}`);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function validateTagKey(tagKey: string): boolean {
  // Tag key must be lowercase, alphanumeric with underscores, no spaces
  const tagKeyPattern = /^[a-z0-9_]+$/;
  return tagKeyPattern.test(tagKey);
}

export function formatTagKey(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-/g, '_') // Replace hyphens with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}
