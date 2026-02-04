import { useEffect, useMemo, useState } from 'react';
import { Clock, FileText, Loader2, Search, ShieldCheck, Trash2, Upload, ExternalLink, File, FolderOpen } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { DocumentRecord } from '../types/documents';
import { deleteDocument, fetchDocuments, uploadDocument } from '../lib/documents';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

interface DocumentsProps {
  accessLevel: AccessLevel;
}

const formatBytes = (size?: number | null) => {
  if (!size || size <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
};

const formatRelativeTime = (timestamp: string) => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (Number.isNaN(diffMinutes)) return 'Unknown';
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return then.toLocaleString();
};

export function Documents({ accessLevel }: DocumentsProps) {
  const { userId } = useModuleAccess();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');

  const hasWriteAccess = accessLevel === 'read-write';

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments();
      setDocuments(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasWriteAccess) return;
    if (!file) {
      setError('Choose a file to upload');
      return;
    }
    if (!name.trim()) {
      setError('Document name is required');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const created = await uploadDocument(file, name.trim(), userId || '');
      setDocuments((prev) => [created, ...prev]);
      setFile(null);
      setName('');
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload document';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!hasWriteAccess) return;
    if (!confirm('Are you sure you want to delete this document?')) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteDocument(id, filePath);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return documents;
    const term = search.toLowerCase();
    return documents.filter((doc) =>
      doc.name.toLowerCase().includes(term) ||
      doc.fileName.toLowerCase().includes(term) ||
      (doc.fileType ?? '').toLowerCase().includes(term)
    );
  }, [documents, search]);

  if (accessLevel === 'no-access') {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 text-center text-gray-500 shadow-premium">
        <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        You do not have access to the Documents module. Please contact an administrator.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-surface p-6 rounded-2xl shadow-premium border border-border">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-gray-500 text-sm">
            Store, search, and manage your organization's files securely
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            {hasWriteAccess ? 'Read & Write Access' : 'Read Only Access'}
          </div>
        </div>
        <div className="w-full md:w-80 relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm shadow-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          {error}
        </div>
      )}

      {hasWriteAccess && (
        <ModernCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Upload Document</h3>
              <p className="text-sm text-gray-500">
                Supported formats: PDF, Images, Excel, Word (Max 50MB)
              </p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="space-y-2 lg:col-span-1">
              <label className="text-sm font-medium text-gray-700">
                Document Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Annual Report 2024"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                File Attachment
              </label>
              <label
                className={`
                  group block border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-200
                  ${file ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'}
                `}
              >
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
                <div className="flex items-center gap-4">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-colors
                    ${file ? 'bg-white text-primary shadow-sm' : 'bg-gray-100 text-gray-400 group-hover:bg-white group-hover:text-primary group-hover:shadow-sm'}
                  `}>
                    <File className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${file ? 'text-primary' : 'text-gray-900'}`}>
                      {file ? file.name : 'Click to browse or drag file here'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {file?.size ? `Size: ${formatBytes(file.size)}` : 'Any file type up to 50MB'}
                    </p>
                  </div>
                  <span className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${file ? 'bg-white text-primary shadow-sm' : 'bg-gray-100 text-gray-600 group-hover:bg-white group-hover:text-primary group-hover:shadow-sm'}
                  `}>
                    Browse
                  </span>
                </div>
              </label>
            </div>

            <div className="lg:col-span-3 flex justify-end">
              <ModernButton
                type="submit"
                loading={uploading}
                disabled={!file || !name.trim()}
                icon={<Upload className="w-4 h-4" />}
              >
                Upload Document
              </ModernButton>
            </div>
          </form>
        </ModernCard>
      )}

      <ModernCard padding="none" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            <span className="font-bold text-gray-900">All Documents</span>
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {filteredDocuments.length}
            </span>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No documents found</h3>
            <p className="text-gray-500 text-sm">
              {search ? 'Try adjusting your search terms' : 'Upload your first document to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDocuments.map((doc) => (
              <div 
                key={doc.id} 
                className="group flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-base">{doc.name}</p>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600 uppercase tracking-wide">
                        {doc.fileType || 'FILE'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 break-all mt-0.5 font-medium">{doc.fileName}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1.5">
                      <span className="font-medium">{formatBytes(doc.fileSize)}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(doc.uploadedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-16 md:pl-0">
                  {doc.fileUrl && (
                    <ModernButton
                      onClick={() => window.open(doc.fileUrl, '_blank')}
                      variant="secondary"
                      size="sm"
                      icon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      Open
                    </ModernButton>
                  )}
                  {hasWriteAccess && (
                    <ModernButton
                      onClick={() => void handleDelete(doc.id, doc.filePath)}
                      variant="danger"
                      size="sm"
                      disabled={deletingId === doc.id}
                      loading={deletingId === doc.id}
                      icon={deletingId !== doc.id ? <Trash2 className="w-3.5 h-3.5" /> : undefined}
                    >
                      {deletingId === doc.id ? 'Deleting' : 'Delete'}
                    </ModernButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ModernCard>
    </div>
  );
}



