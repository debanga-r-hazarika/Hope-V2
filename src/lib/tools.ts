import { supabase } from './supabase';

export interface Tool {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchTools(): Promise<Tool[]> {
  const { data, error } = await supabase
    .from('tools')
    .select('id, name, description, created_at, updated_at')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createTool(input: { name: string; description?: string | null }): Promise<Tool> {
  const { data, error } = await supabase
    .from('tools')
    .insert({ name: input.name, description: input.description ?? null })
    .select('id, name, description, created_at, updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTool(
  id: string,
  input: { name?: string; description?: string | null }
): Promise<Tool> {
  const { data, error } = await supabase
    .from('tools')
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
    })
    .eq('id', id)
    .select('id, name, description, created_at, updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTool(id: string): Promise<void> {
  const { error } = await supabase.from('tools').delete().eq('id', id);
  if (error) throw error;
}
