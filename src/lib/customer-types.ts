import { supabase } from './supabase';
import type {
  CustomerType,
  CustomerTypeStatus,
  CreateCustomerTypeInput,
  UpdateCustomerTypeInput,
} from '../types/customer-types';

// Validate type_key format (lowercase, alphanumeric with underscores)
export function validateTypeKey(typeKey: string): boolean {
  return /^[a-z0-9_]+$/.test(typeKey);
}

// Format type_key (convert to lowercase, replace spaces/hyphens with underscores)
export function formatTypeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Fetch all customer types
export async function fetchCustomerTypes(includeInactive = false): Promise<CustomerType[]> {
  let query = supabase
    .from('customer_types')
    .select('*')
    .order('display_name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching customer types:', error);
    throw new Error(`Failed to fetch customer types: ${error.message}`);
  }

  return data || [];
}

// Create a new customer type
export async function createCustomerType(
  input: CreateCustomerTypeInput,
  userId: string
): Promise<CustomerType> {
  const { data, error } = await supabase
    .from('customer_types')
    .insert({
      type_key: input.type_key,
      display_name: input.display_name,
      description: input.description || null,
      status: input.status || 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating customer type:', error);
    throw new Error(`Failed to create customer type: ${error.message}`);
  }

  return data;
}

// Update a customer type
export async function updateCustomerType(
  id: string,
  input: UpdateCustomerTypeInput,
  userId: string
): Promise<CustomerType> {
  const updateData: Record<string, unknown> = {
    updated_by: userId,
  };

  if (input.display_name !== undefined) updateData.display_name = input.display_name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('customer_types')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating customer type:', error);
    throw new Error(`Failed to update customer type: ${error.message}`);
  }

  return data;
}

// Check if a customer type is being used
export async function checkCustomerTypeUsage(customerTypeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('customer_type_id', customerTypeId);

  if (error) {
    console.error('Error checking customer type usage:', error);
    throw new Error(`Failed to check customer type usage: ${error.message}`);
  }

  return count || 0;
}

// Delete a customer type (only if not used)
export async function deleteCustomerType(id: string): Promise<void> {
  const { error } = await supabase.from('customer_types').delete().eq('id', id);

  if (error) {
    console.error('Error deleting customer type:', error);
    throw new Error(`Failed to delete customer type: ${error.message}`);
  }
}
