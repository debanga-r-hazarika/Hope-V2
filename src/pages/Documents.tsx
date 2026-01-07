import { useEffect, useMemo, useState } from 'react';
import { Clock, FileText, Loader2, Search, ShieldCheck, Trash2, Upload, ExternalLink } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { DocumentRecord } from '../types/documents';
import { deleteDocument, fetchDocuments, uploadDocument } from '../lib/documents';
import { useModuleAccess } from '../contexts/ModuleAccessContext';

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
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-700">
        You do not have access to the Documents module. Please contact an administrator.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            Store, search, and manage files. Supports PDFs, images, and any other document type.
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
            <ShieldCheck className="w-4 h-4" />
            {hasWriteAccess ? 'Read & Write' : 'Read Only'}
          </div>
        </div>
        <div className="w-full md:w-80 relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by name or type"
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {hasWriteAccess && (
        <form
          onSubmit={handleUpload}
          className="bg-white border border-gray-200 rounded-lg p-6 space-y-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Upload a document</h3>
              <p className="text-sm text-gray-600">
                Set a friendly name and pick any file. Accepted: any type, up to 50 MB.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="space-y-2 lg:col-span-1">
              <label className="text-sm font-medium text-gray-700">
                Document name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PAN card, Agreement, Invoice"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-gray-700 sr-only">File</label>
              <label
                className="block border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-blue-400 transition bg-gray-50"
              >
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {file ? file.name : 'Choose a file or drag & drop'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Any file type • Max 50 MB {file?.size ? `• Selected: ${formatBytes(file.size)}` : ''}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg">
                    Browse
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-gray-900">Documents</span>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {loading ? 'Loading documents...' : 'No documents found.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{doc.name}</p>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                        {doc.fileType || 'Unknown type'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 break-all">{doc.fileName}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{formatBytes(doc.fileSize)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Uploaded {formatRelativeTime(doc.uploadedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open
                    </a>
                  )}
                  {hasWriteAccess && (
                    <button
                      onClick={() => void handleDelete(doc.id, doc.filePath)}
                      disabled={deletingId === doc.id}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-60"
                    >
                      {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



