import { supabase } from './supabase';
import type {
  RawMaterialType,
  CreateRawMaterialTypeInput,
  UpdateRawMaterialTypeInput,
} from '../types/raw-material-types';

export async function fetchRawMaterialTypes(includeInactive = false): Promise<RawMaterialType[]> {
  let query = supabase
    .from('raw_material_types')
    .select('*')
    .order('type_name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;
  if (error) {
    if (error.message?.includes('schema cache') || error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('raw_material_types table not found; run migration 20260302130000_raw_material_types_and_prefixes.sql');
      return [];
    }
    console.error('Error fetching raw material types:', error);
    throw new Error(`Failed to fetch raw material types: ${error.message}`);
  }

  return (data || []) as RawMaterialType[];
}

export async function createRawMaterialType(
  input: CreateRawMaterialTypeInput,
  userId: string
): Promise<RawMaterialType> {
  const { data, error } = await supabase
    .from('raw_material_types')
    .insert({
      type_key: input.type_key,
      type_name: input.type_name,
      raw_material_tag_id: input.raw_material_tag_id,
      allowed_unit_ids: input.allowed_unit_ids,
      status: input.status ?? 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create raw material type: ${error.message}`);
  return data as RawMaterialType;
}

export async function updateRawMaterialType(
  id: string,
  input: UpdateRawMaterialTypeInput,
  userId: string
): Promise<RawMaterialType> {
  const updateData: Record<string, unknown> = { updated_by: userId };
  if (input.type_name !== undefined) updateData.type_name = input.type_name;
  if (input.raw_material_tag_id !== undefined) updateData.raw_material_tag_id = input.raw_material_tag_id;
  if (input.allowed_unit_ids !== undefined) updateData.allowed_unit_ids = input.allowed_unit_ids;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('raw_material_types')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update raw material type: ${error.message}`);
  return data as RawMaterialType;
}

