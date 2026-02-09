import { useEffect, useState } from 'react';
import {
  Folder,
  FileText,
  Search,
  Plus,
  Trash2,
  Upload,
  Users,
  Clock,
  ChevronRight,
  Home,
  Settings,
  Shield,
  Loader2,
  File as FileIcon,
  Download
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { DocumentRecord, FolderWithAccess } from '../types/documents';
import {
  deleteDocument,
  fetchDocuments,
  uploadDocument,
  fetchFolders,
  createFolder,
  deleteFolder
} from '../lib/documents';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { FolderAccessModal } from '../components/FolderAccessModal';

interface DocumentsProps {
  accessLevel: AccessLevel;
}

// Utility to format file size
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Utility to format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export function Documents({ accessLevel }: DocumentsProps) {
  const { userId } = useModuleAccess();
  const [folders, setFolders] = useState<FolderWithAccess[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderWithAccess | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // Loading & UI States
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeFolderIdForAccess, setActiveFolderIdForAccess] = useState<string | null>(null);

  // Form States
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');

  // Derived Access Rights
  const hasModuleWriteAccess = accessLevel === 'read-write' || accessLevel === 'admin';
  const currentFolderWriteAccess = selectedFolder
    ? (selectedFolder.userAccessLevel === 'read-write' || selectedFolder.userAccessLevel === 'admin')
    : false;

  useEffect(() => {
    loadFolders();
  }, [accessLevel]);

  useEffect(() => {
    if (selectedFolder) {
      loadDocuments(selectedFolder.id);
    }
  }, [selectedFolder]);

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const data = await fetchFolders();
      setFolders(data);
    } catch (error) {
      console.error('Failed to load folders', error);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const loadDocuments = async (folderId: string) => {
    setIsLoadingDocs(true);
    try {
      const data = await fetchDocuments(folderId);
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents', error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await createFolder(newFolderName, newFolderDesc, userId || '');
      await loadFolders();
      setShowNewFolderModal(false);
      setNewFolderName('');
      setNewFolderDesc('');
    } catch (error) {
      console.error('Failed to create folder', error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm('Are you sure you want to delete this folder and all its contents?')) return;
    try {
      await deleteFolder(folderId);
      if (selectedFolder?.id === folderId) setSelectedFolder(null);
      await loadFolders();
    } catch (error) {
      console.error('Failed to delete folder', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolder || !uploadFile || !uploadName) return;

    setIsUploading(true);
    try {
      await uploadDocument(uploadFile, uploadName, userId || '', selectedFolder.id);
      await loadDocuments(selectedFolder.id);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadName('');
    } catch (error) {
      console.error('Failed to upload', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, filePath: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteDocument(docId, filePath);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Failed to delete document', error);
    }
  };

  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocuments = documents.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (accessLevel === 'no-access') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900">Access Restricted</h3>
          <p className="text-slate-500 mt-1">You do not have permission to view documents.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">

      {/* Premium Header Section */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center text-white transform transition-transform hover:scale-105 duration-300">
              <Folder className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Document Center</h1>
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                Manage, organize, and secure your business assets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Module Access Badge */}
            <div className={`px-4 py-2 rounded-xl border-2 flex items-center gap-2 shadow-sm ${hasModuleWriteAccess
              ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
              : 'bg-slate-50 border-slate-100 text-slate-700'
              }`}>
              <Shield className="w-4 h-4" />
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider opacity-70">Current Mode</p>
                <p className="text-sm font-bold leading-none">{hasModuleWriteAccess ? 'Admin Access' : 'User Access'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Toolbar & Breadcrumbs */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-xl border-b border-slate-200 px-4 sm:px-6 py-4 shadow-sm transition-all duration-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 overflow-hidden bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <button
                onClick={() => setSelectedFolder(null)}
                className={`flex items-center gap-2 p-1.5 rounded-md transition-colors ${!selectedFolder ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Home className="w-4 h-4" />
                <span className={!selectedFolder ? 'block' : 'hidden sm:block text-sm'}>Home</span>
              </button>

              {selectedFolder && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <div className="flex items-center gap-2 min-w-0 bg-indigo-50 px-2 py-1.5 rounded-md text-indigo-700 border border-indigo-100">
                    <Folder className="w-4 h-4 flex-shrink-0" />
                    <span className="font-semibold text-sm truncate max-w-[150px] sm:max-w-xs">{selectedFolder.name}</span>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder={selectedFolder ? "Search files..." : "Search folders..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-sm transition-all outline-none shadow-sm"
                />
              </div>

              {!selectedFolder && hasModuleWriteAccess && (
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-slate-200 hover:shadow-xl transform active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Folder</span>
                </button>
              )}

              {selectedFolder && currentFolderWriteAccess && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-200 hover:shadow-xl transform active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload File</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* FOLDER GRID VIEW */}
        {!selectedFolder && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              All Folders
              <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {filteredFolders.length}
              </span>
            </h2>

            {isLoadingFolders ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : filteredFolders.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder)}
                    className="group relative bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-3 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                        <Folder className="w-6 h-6 text-amber-500 fill-amber-100" />
                      </div>
                      {hasModuleWriteAccess && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setActiveFolderIdForAccess(folder.id);
                              setShowAccessModal(true);
                            }}
                            title="Manage Access"
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFolder(folder.id)}
                            title="Delete Folder"
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div>
                      <h3 className="font-semibold text-slate-900 truncate mb-1">{folder.name}</h3>
                      <p className="text-xs text-slate-500 line-clamp-1 h-4">{folder.description}</p>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {folder.documentCount || 0} files
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(folder.updatedAt || folder.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Folder className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No folders here</h3>
                <p className="text-slate-500 mt-1">Create a new folder to start organizing your documents.</p>
                {hasModuleWriteAccess && (
                  <button
                    onClick={() => setShowNewFolderModal(true)}
                    className="mt-4 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Create Folder
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTS LIST VIEW */}
        {selectedFolder && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

            {/* List Header */}
            <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <Folder className="w-6 h-6 text-indigo-600 fill-indigo-50" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedFolder.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${selectedFolder.userAccessLevel === 'admin' ? 'bg-purple-100 text-purple-700' :
                      selectedFolder.userAccessLevel === 'read-write' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-sky-100 text-sky-700'
                      }`}>
                      {selectedFolder.userAccessLevel?.replace('-', ' ') || 'No Access'}
                    </span>
                    <span>•</span>
                    <span>{filteredDocuments.length} items</span>
                  </div>
                </div>
              </div>
              {hasModuleWriteAccess && (
                <button
                  onClick={() => {
                    setActiveFolderIdForAccess(selectedFolder.id);
                    setShowAccessModal(true);
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Manage Access
                </button>
              )}
            </div>

            {/* File List */}
            {isLoadingDocs ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : filteredDocuments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                    <tr>
                      <th className="px-6 py-3 pl-8">Name</th>
                      <th className="px-6 py-3 hidden sm:table-cell">Date Uploaded</th>
                      <th className="px-6 py-3 hidden md:table-cell">Size</th>
                      <th className="px-6 py-3 hidden lg:table-cell">Uploaded By</th>
                      <th className="px-6 py-3 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 group transition-colors">
                        <td className="px-6 py-4 pl-8">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-500">
                              <FileIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate max-w-[200px] sm:max-w-xs">{doc.name}</p>
                              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:hidden">{formatBytes(doc.fileSize)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell whitespace-nowrap">
                          {formatDate(doc.uploadedAt)}
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell font-mono text-xs text-slate-500">
                          {formatBytes(doc.fileSize)}
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell text-xs">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">
                            {doc.uploadedByName || (doc.uploadedBy ? `ID: ${doc.uploadedBy.split('-')[0]}` : 'Unknown')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={doc.fileUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Download/View"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            {currentFolderWriteAccess && (
                              <button
                                onClick={() => handleDeleteDocument(doc.id, doc.filePath)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-medium">This folder is empty</h3>
                {currentFolderWriteAccess && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-3 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                  >
                    Upload your first file
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}

      {/* Create Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create New Folder</h3>
            <form onSubmit={handleCreateFolder}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Folder Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g. Marketing Assets"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={newFolderDesc}
                    onChange={(e) => setNewFolderDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Upload File</h3>
            <p className="text-sm text-slate-500 mb-5">Upload document to <span className="font-semibold text-indigo-600">{selectedFolder?.name}</span></p>

            <form onSubmit={handleUpload}>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {uploadFile ? (
                    <div className="flex flex-col items-center text-indigo-600">
                      <FileText className="w-8 h-8 mb-2" />
                      <span className="text-sm font-medium truncate max-w-[200px]">{uploadFile.name}</span>
                      <span className="text-xs text-slate-400 mt-1">{formatBytes(uploadFile.size)}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400">
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-sm font-medium text-slate-600">Click to browse</span>
                      <span className="text-xs mt-1">or drag and drop file here</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Display Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g. Q3 Report Final"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile || !uploadName}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Modal Wrapper */}
      {showAccessModal && activeFolderIdForAccess && (
        <FolderAccessModal
          folderId={activeFolderIdForAccess}
          folderName={folders.find(f => f.id === activeFolderIdForAccess)?.name || 'Folder'}
          currentUserId={userId || ''}
          onClose={() => { setShowAccessModal(false); setActiveFolderIdForAccess(null); }}
        />
      )}
    </div>
  );
}
