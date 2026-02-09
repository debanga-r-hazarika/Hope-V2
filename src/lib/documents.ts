import { supabase } from './supabase';
import type { DocumentRecord, DocumentFolder, FolderUserAccess, FolderWithAccess } from '../types/documents';

// Folder Management (Module R/W only)
export async function fetchFolders(): Promise<FolderWithAccess[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('document_folders')
    .select('id, name, description, created_by, created_at, updated_at')
    .order('name', { ascending: true });

  if (error) throw error;

  // Get access level for each folder
  const foldersWithAccess = await Promise.all(
    (data || []).map(async (folder: any) => {
      const { data: accessData } = await supabase
        .rpc('get_user_folder_access', {
          p_folder_id: folder.id,
          p_auth_user_id: user.id
        });

      // Count documents in folder
      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('folder_id', folder.id);

      return {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        createdBy: folder.created_by,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
        userAccessLevel: accessData || 'no-access',
        documentCount: count || 0,
      };
    })
  );

  // Filter out folders with no-access
  return foldersWithAccess.filter(f => f.userAccessLevel !== 'no-access');
}

export async function createFolder(name: string, description: string | null, userId: string): Promise<DocumentFolder> {
  const { data, error } = await supabase
    .from('document_folders')
    .insert([{ name, description, created_by: userId }])
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateFolder(id: string, name: string, description: string | null): Promise<void> {
  const { error } = await supabase
    .from('document_folders')
    .update({ name, description })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  // First, delete all documents in the folder from storage
  const { data: documents } = await supabase
    .from('documents')
    .select('file_path')
    .eq('folder_id', id);

  if (documents && documents.length > 0) {
    const filePaths = documents.map(doc => doc.file_path);
    await supabase.storage.from('documents').remove(filePaths);
  }

  // Delete folder (cascade will handle documents and access records)
  const { error } = await supabase.from('document_folders').delete().eq('id', id);
  if (error) throw error;
}

// Folder Access Management (Module R/W only)
export async function fetchFolderUsers(folderId: string): Promise<FolderUserAccess[]> {
  const { data, error } = await supabase
    .from('folder_user_access')
    .select(`
      id,
      folder_id,
      user_id,
      access_level,
      assigned_by,
      assigned_at,
      users:user_id (
        full_name,
        email
      )
    `)
    .eq('folder_id', folderId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((access: any) => ({
    id: access.id,
    folderId: access.folder_id,
    userId: access.user_id,
    accessLevel: access.access_level,
    assignedBy: access.assigned_by,
    assignedAt: access.assigned_at,
    userName: access.users?.full_name,
    userEmail: access.users?.email,
  }));
}

export async function assignFolderAccess(
  folderId: string,
  userId: string,
  accessLevel: 'read-only' | 'read-write' | 'no-access',
  assignedBy: string
): Promise<FolderUserAccess> {
  const { data, error } = await supabase
    .from('folder_user_access')
    .upsert([{
      folder_id: folderId,
      user_id: userId,
      access_level: accessLevel,
      assigned_by: assignedBy
    }], {
      onConflict: 'folder_id,user_id'
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    folderId: data.folder_id,
    userId: data.user_id,
    accessLevel: data.access_level,
    assignedBy: data.assigned_by,
    assignedAt: data.assigned_at,
  };
}

export async function removeFolderAccess(accessId: string): Promise<void> {
  const { error } = await supabase
    .from('folder_user_access')
    .delete()
    .eq('id', accessId);
  if (error) throw error;
}

// Document Management (Folder-level access)
export async function fetchDocuments(folderId: string): Promise<DocumentRecord[]> {
  // Join with users table to get uploader name
  const { data, error } = await supabase
    .from('documents')
    .select(`
      id, 
      name, 
      file_name, 
      file_type, 
      file_size, 
      file_url, 
      file_path, 
      folder_id, 
      uploaded_by, 
      uploaded_at,
      users:uploaded_by (
        full_name
      )
    `)
    .eq('folder_id', folderId)
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
    folderId: doc.folder_id,
    uploadedBy: doc.uploaded_by,
    uploadedByName: doc.users?.full_name,
    uploadedAt: doc.uploaded_at,
  }));
}

export async function uploadDocument(
  file: File,
  name: string,
  userId: string,
  folderId: string
): Promise<DocumentRecord> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const filePath = `documents/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  const { data, error } = await supabase
    .from('documents')
    .insert([{
      name,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_url: publicUrlData.publicUrl,
      file_path: filePath,
      folder_id: folderId,
      uploaded_by: userId
    }])
    .select()
    .single();

  if (error) throw error;

  // Ideally fetch user name here too, but for simplicity returning basic record
  // The UI can refetch or just show "You" if it matches current user ID if needed

  return {
    id: data.id,
    name: data.name,
    fileName: data.file_name,
    fileType: data.file_type,
    fileSize: data.file_size,
    fileUrl: data.file_url,
    filePath: data.file_path,
    folderId: data.folder_id,
    uploadedBy: data.uploaded_by,
    uploadedAt: data.uploaded_at
  };
}

export async function deleteDocument(id: string, filePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([filePath]);
  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);
  if (dbError) throw dbError;
}

// Get user's access level for a specific folder
export async function getUserFolderAccess(folderId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .rpc('get_user_folder_access', {
      p_folder_id: folderId,
      p_user_id: userId
    });

  if (error) throw error;
  return data || 'no-access';
}
