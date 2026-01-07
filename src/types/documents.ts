export interface DocumentRecord {
  id: string;
  name: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  filePath: string;
  uploadedBy: string | null;
  uploadedAt: string;
}




