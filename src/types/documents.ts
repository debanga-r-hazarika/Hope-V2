export interface DocumentFolder {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FolderUserAccess {
  id: string;
  folderId: string;
  userId: string;
  accessLevel: 'read-only' | 'read-write' | 'no-access';
  assignedBy: string | null;
  assignedAt: string;
  userName?: string; // Joined from users table
  userEmail?: string; // Joined from users table
}

export interface DocumentRecord {
  id: string;
  name: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  filePath: string;
  folderId: string; // Required - no root documents
  uploadedBy: string | null;
  uploadedByName?: string; // Joined from users table
  uploadedAt: string;
}

export interface FolderWithAccess extends DocumentFolder {
  userAccessLevel: 'admin' | 'read-only' | 'read-write' | 'no-access';
  documentCount?: number;
}
