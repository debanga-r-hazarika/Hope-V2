import { supabase } from './supabase';
import type { DocumentRecord } from '../types/documents';

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, name, file_name, file_type, file_size, file_url, file_path, uploaded_by, uploaded_at')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((doc: any) => ({
    id: doc.id,
    name: doc.name,
    fileName: doc.file_name,
    fileType: doc.file_type,
    fileSize: doc.file_size,
    fileUrl: doc.file_url,
    filePath: doc.file_path,
    uploadedBy: doc.uploaded_by,
    uploadedAt: doc.uploaded_at,
  }));
}

export async function uploadDocument(file: File, name: string, userId: string): Promise<DocumentRecord> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const filePath = `documents/${fileName}`;
  const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
  if (uploadError) throw uploadError;
  const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath);
  const { data, error } = await supabase.from('documents').insert([
    { name, file_name: file.name, file_type: file.type, file_size: file.size, file_url: publicUrlData.publicUrl, file_path: filePath, uploaded_by: userId }
  ]).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, fileName: data.file_name, fileType: data.file_type, fileSize: data.file_size, fileUrl: data.file_url, filePath: data.file_path, uploadedBy: data.uploaded_by, uploadedAt: data.uploaded_at };
}

export async function deleteDocument(id: string, filePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from('documents').remove([filePath]);
  if (storageError) throw storageError;
  const { error: dbError } = await supabase.from('documents').delete().eq('id', id);
  if (dbError) throw dbError;
}
