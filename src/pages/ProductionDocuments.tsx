import { useEffect, useState, useMemo } from 'react';
import {
    Plus,
    RefreshCw,
    FileText,
    Search,
    X,
    Download,
    Upload,
    Trash2,
    Edit,
    AlertCircle,
    Eye,
    User,
    Calendar,
    FileCheck,
    File
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { ProductionDocument } from '../types/operations';
import {
    fetchProductionDocuments,
    createProductionDocument,
    updateProductionDocument,
    deleteProductionDocument,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

interface ProductionDocumentsProps {
    accessLevel: AccessLevel;
}

export function ProductionDocuments({ accessLevel }: ProductionDocumentsProps) {
    const { userId } = useModuleAccess();
    const canWrite = accessLevel === 'read-write';

    // State
    const [documents, setDocuments] = useState<ProductionDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<ProductionDocument | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        document_name: '',
        description: '',
        author_name: '',
    });
    const [documentFile, setDocumentFile] = useState<File | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchProductionDocuments();
            setDocuments(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (accessLevel === 'no-access') return;
        void loadData();
    }, [accessLevel]);

    const resetForm = () => {
        setFormData({
            document_name: '',
            description: '',
            author_name: '',
        });
        setDocumentFile(null);
        const fileInput = document.getElementById('production-doc-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleSubmit = async () => {
        if (!canWrite) return;

        if (!formData.document_name.trim()) {
            setError('Please enter a document name');
            return;
        }

        if (!formData.author_name.trim()) {
            setError('Please enter the author name');
            return;
        }

        if (!editingId && !documentFile) {
            setError('Please select a file to upload');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            if (editingId) {
                // Update existing document
                const updated = await updateProductionDocument(editingId, {
                    document_name: formData.document_name.trim(),
                    description: formData.description.trim(),
                    author_name: formData.author_name.trim(),
                });
                setDocuments((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
            } else {
                // Create new document
                if (!documentFile || !userId) {
                    setError('Please select a file and ensure you are logged in');
                    return;
                }
                const created = await createProductionDocument(
                    documentFile,
                    formData.document_name.trim(),
                    formData.description.trim(),
                    formData.author_name.trim(),
                    userId
                );
                setDocuments((prev) => [created, ...prev]);
            }

            setShowForm(false);
            setEditingId(null);
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save document');
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (doc: ProductionDocument) => {
        setEditingId(doc.id);
        setFormData({
            document_name: doc.document_name,
            description: doc.description || '',
            author_name: doc.author_name,
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (doc: ProductionDocument) => {
        if (!canWrite) return;

        try {
            await deleteProductionDocument(doc.id, doc.file_path);
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            setShowDeleteConfirm(null);
            if (selectedDocument?.id === doc.id) {
                setSelectedDocument(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete document');
            setShowDeleteConfirm(null);
        }
    };

    const handleDownload = (doc: ProductionDocument) => {
        if (doc.file_url) {
            window.open(doc.file_url, '_blank');
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = (fileType?: string) => {
        if (!fileType) return FileText;
        if (fileType.includes('pdf')) return FileCheck;
        if (fileType.includes('word') || fileType.includes('doc')) return FileText;
        return File;
    };

    // Filter documents
    const filteredDocuments = useMemo(() => {
        if (!searchTerm.trim()) return documents;

        const term = searchTerm.toLowerCase();
        return documents.filter((doc) =>
            doc.document_name.toLowerCase().includes(term) ||
            (doc.description || '').toLowerCase().includes(term) ||
            doc.author_name.toLowerCase().includes(term) ||
            doc.file_name.toLowerCase().includes(term)
        );
    }, [documents, searchTerm]);

    if (accessLevel === 'no-access') return null;

    return (
        <div className="space-y-6">
            {/* Top Controls Card */}
            <ModernCard padding="sm" className="bg-white sticky top-0 z-20 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex-1 w-full sm:w-auto flex gap-2">
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search documents..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        {canWrite && (
                            <ModernButton
                                onClick={() => {
                                    setShowForm(!showForm);
                                    setEditingId(null);
                                    resetForm();
                                }}
                                variant={showForm ? 'secondary' : 'primary'}
                                size="sm"
                                icon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                className={showForm ? "" : "bg-gray-900 hover:bg-gray-800 text-white"}
                            >
                                {showForm ? 'Close' : 'Add Document'}
                            </ModernButton>
                        )}
                    </div>
                </div>
            </ModernCard>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Add/Edit Form */}
            {canWrite && showForm && (
                <ModernCard className="animate-slide-down border-gray-200 shadow-premium">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            {editingId ? <Edit className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-green-500" />}
                            {editingId ? 'Edit Document' : 'Upload New Production Document'}
                        </h3>
                        <button
                            onClick={() => {
                                setShowForm(false);
                                setEditingId(null);
                                resetForm();
                            }}
                            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Document Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.document_name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, document_name: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                                    placeholder="e.g., Honey Production Formula v2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Author / Written By <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.author_name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, author_name: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                                    placeholder="Enter author name"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                                    rows={3}
                                    placeholder="Brief description of the document..."
                                />
                            </div>
                            {!editingId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Upload File <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="production-doc-file-input"
                                        type="file"
                                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-gray-500 bg-gray-50 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        accept=".pdf,.doc,.docx"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Accepted formats: PDF, DOC, DOCX</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                        <ModernButton
                            onClick={() => {
                                setShowForm(false);
                                setEditingId(null);
                                resetForm();
                            }}
                            variant="secondary"
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton onClick={() => void handleSubmit()} disabled={uploading}>
                            {uploading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    {editingId ? 'Updating...' : 'Uploading...'}
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    {editingId ? 'Update Document' : 'Upload Document'}
                                </>
                            )}
                        </ModernButton>
                    </div>
                </ModernCard>
            )}

            {/* Main Content Area */}
            {loading ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                        <span className="text-gray-500 font-medium">Loading documents...</span>
                    </div>
                </div>
            ) : filteredDocuments.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                        <FileText className="w-12 h-12 text-gray-300" />
                        <span className="text-gray-500 font-medium">
                            {documents.length === 0 ? 'No production documents uploaded yet' : 'No documents match your search'}
                        </span>
                        {canWrite && documents.length === 0 && (
                            <ModernButton
                                onClick={() => setShowForm(true)}
                                variant="primary"
                                size="sm"
                                className="mt-2"
                            >
                                <Plus className="w-4 h-4" />
                                Upload First Document
                            </ModernButton>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Author</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">File Info</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Uploaded</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredDocuments.map((doc) => {
                                    const FileIcon = getFileIcon(doc.file_type);
                                    return (
                                        <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                                        <FileIcon className="w-5 h-5 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{doc.document_name}</div>
                                                        {doc.description && (
                                                            <div className="text-sm text-gray-500 truncate max-w-xs">{doc.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-700">{doc.author_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-600">
                                                    <div className="font-medium truncate max-w-[150px]">{doc.file_name}</div>
                                                    <div className="text-xs text-gray-400">{formatFileSize(doc.file_size)}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-600">
                                                    <div>{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                                                    {doc.uploaded_by_name && (
                                                        <div className="text-xs text-gray-400">by {doc.uploaded_by_name}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setSelectedDocument(doc)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(doc)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="Download"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    {canWrite && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(doc)}
                                                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setShowDeleteConfirm(doc.id)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredDocuments.map((doc) => {
                            const FileIcon = getFileIcon(doc.file_type);
                            return (
                                <ModernCard key={doc.id} padding="sm" className="flex flex-col h-full">
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                            <FileIcon className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-gray-900 truncate">{doc.document_name}</h3>
                                            <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                                                <User className="w-3 h-3" />
                                                <span>{doc.author_name}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {doc.description && (
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{doc.description}</p>
                                    )}

                                    <div className="space-y-2 text-sm text-gray-600 mb-4 flex-1">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">File</span>
                                            <span className="font-medium text-gray-900 truncate max-w-[150px]">{doc.file_name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Size</span>
                                            <span className="font-medium text-gray-900">{formatFileSize(doc.file_size)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Uploaded</span>
                                            <span className="font-medium text-gray-900">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                                        <button
                                            onClick={() => setSelectedDocument(doc)}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleDownload(doc)}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Download
                                        </button>
                                        {canWrite && (
                                            <button
                                                onClick={() => handleEdit(doc)}
                                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </ModernCard>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Document Details Modal */}
            {selectedDocument && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <ModernCard className="w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col animate-slide-down rounded-t-2xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4 sm:mb-6">
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                                    {(() => {
                                        const FileIcon = getFileIcon(selectedDocument.file_type);
                                        return <FileIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />;
                                    })()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{selectedDocument.document_name}</h3>
                                    <p className="text-xs sm:text-sm text-gray-500">Production Recipe/Formula</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDocument(null)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 -mr-1"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:pr-2 space-y-4 sm:space-y-6">
                            {/* Description */}
                            {selectedDocument.description && (
                                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                                    <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Description</h4>
                                    <p className="text-sm text-gray-600">{selectedDocument.description}</p>
                                </div>
                            )}

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 mb-1">
                                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Author</span>
                                    </div>
                                    <p className="text-sm sm:text-base text-gray-900 font-medium truncate">{selectedDocument.author_name}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 mb-1">
                                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Uploaded</span>
                                    </div>
                                    <p className="text-sm sm:text-base text-gray-900 font-medium">
                                        {new Date(selectedDocument.uploaded_at).toLocaleDateString()}
                                    </p>
                                    {selectedDocument.uploaded_by_name && (
                                        <p className="text-xs sm:text-sm text-gray-500 truncate">by {selectedDocument.uploaded_by_name}</p>
                                    )}
                                </div>
                            </div>

                            {/* File Info */}
                            <div className="bg-blue-50 rounded-xl p-3 sm:p-4">
                                <h4 className="text-xs sm:text-sm font-semibold text-blue-700 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                                    <File className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    File Information
                                </h4>
                                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                                    <div className="flex justify-between gap-2">
                                        <span className="text-blue-600">File Name</span>
                                        <span className="font-medium text-blue-900 truncate max-w-[60%] text-right">{selectedDocument.file_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-blue-600">File Type</span>
                                        <span className="font-medium text-blue-900">{selectedDocument.file_type || 'Unknown'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-blue-600">File Size</span>
                                        <span className="font-medium text-blue-900">{formatFileSize(selectedDocument.file_size)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions - Mobile optimized */}
                        <div className="mt-4 sm:mt-6 pt-4 border-t border-gray-100 space-y-3 sm:space-y-0">
                            {/* Primary action - Download (always visible) */}
                            <ModernButton
                                onClick={() => handleDownload(selectedDocument)}
                                icon={<Download className="w-4 h-4" />}
                                className="w-full sm:hidden"
                            >
                                Download Document
                            </ModernButton>

                            {/* Action buttons row */}
                            <div className="flex flex-wrap gap-2 sm:justify-between">
                                {canWrite && (
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <ModernButton
                                            onClick={() => {
                                                handleEdit(selectedDocument);
                                                setSelectedDocument(null);
                                            }}
                                            variant="secondary"
                                            size="sm"
                                            icon={<Edit className="w-4 h-4" />}
                                            className="flex-1 sm:flex-none"
                                        >
                                            Edit
                                        </ModernButton>
                                        <ModernButton
                                            onClick={() => setShowDeleteConfirm(selectedDocument.id)}
                                            variant="danger"
                                            size="sm"
                                            icon={<Trash2 className="w-4 h-4" />}
                                            className="flex-1 sm:flex-none"
                                        >
                                            Delete
                                        </ModernButton>
                                    </div>
                                )}
                                {/* Desktop download button */}
                                <div className="hidden sm:block ml-auto">
                                    <ModernButton
                                        onClick={() => handleDownload(selectedDocument)}
                                        icon={<Download className="w-4 h-4" />}
                                    >
                                        Download
                                    </ModernButton>
                                </div>
                            </div>
                        </div>
                    </ModernCard>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <ModernCard className="w-full max-w-md animate-slide-down">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Delete Document</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this production document? The file will be permanently removed from storage.
                        </p>
                        <div className="flex justify-end gap-3">
                            <ModernButton onClick={() => setShowDeleteConfirm(null)} variant="secondary">
                                Cancel
                            </ModernButton>
                            <ModernButton
                                onClick={() => {
                                    const doc = documents.find((d) => d.id === showDeleteConfirm);
                                    if (doc) void handleDelete(doc);
                                }}
                                variant="danger"
                            >
                                Delete Document
                            </ModernButton>
                        </div>
                    </ModernCard>
                </div>
            )}
        </div>
    );
}
