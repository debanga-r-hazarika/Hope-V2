import { useState, useEffect } from 'react';
import { Truck, Upload, FileText, Trash2, Save, X, Image, FileIcon, ExternalLink, Package, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ThirdPartyDelivery, ThirdPartyDeliveryDocument } from '../types/sales';

interface ThirdPartyDeliverySectionProps {
  orderId: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  onSave: (data: {
    quantity_delivered?: number;
    delivery_partner_name?: string;
    delivery_notes?: string;
  }) => Promise<void>;
  onUploadDocument: (file: File) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
  delivery: ThirdPartyDelivery | null;
  documents: ThirdPartyDeliveryDocument[];
  hasWriteAccess: boolean;
}

export function ThirdPartyDeliverySection({
  enabled,
  onToggle,
  onSave,
  onUploadDocument,
  onDeleteDocument,
  delivery,
  documents,
  hasWriteAccess,
}: ThirdPartyDeliverySectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [quantityDelivered, setQuantityDelivered] = useState<string>('');
  const [deliveryPartner, setDeliveryPartner] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (delivery) {
      setQuantityDelivered(delivery.quantity_delivered?.toString() || '');
      setDeliveryPartner(delivery.delivery_partner_name || '');
      setDeliveryNotes(delivery.delivery_notes || '');
    }
  }, [delivery]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        quantity_delivered: quantityDelivered ? parseFloat(quantityDelivered) : undefined,
        delivery_partner_name: deliveryPartner || undefined,
        delivery_notes: deliveryNotes || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save delivery info:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await onUploadDocument(file);
      event.target.value = '';
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    }
    return <FileIcon className="w-5 h-5" />;
  };

  const getFileIconBg = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white';
    }
    return 'bg-gradient-to-br from-red-500 to-rose-600 text-white';
  };

  return (
    <div className="space-y-5">
      {/* Simple Header Row - No box */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'} transition-all`}>
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Third-Party Delivery
              {enabled && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
                  Active
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Track delivery partner & documents
            </p>
          </div>
        </div>

        {hasWriteAccess && (
          <button
            role="switch"
            aria-checked={enabled}
            onClick={async () => {
              if (toggling) return;
              setToggling(true);
              try {
                await onToggle(!enabled);
              } finally {
                setToggling(false);
              }
            }}
            disabled={toggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/20 shrink-0 ${enabled
              ? 'bg-emerald-500'
              : 'bg-slate-200'
              }`}
          >
            <span
              className={`${enabled ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-out`}
            />
          </button>
        )}
      </div>

      {enabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left Column: Delivery Information - No outer box */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                  <Package className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900">Delivery Details</h4>
              </div>
              {hasWriteAccess && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                >
                  {delivery ? 'Edit' : '+ Add'}
                </button>
              )}
            </div>

            {!delivery && !isEditing ? (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">No delivery info yet</p>
                <p className="text-xs text-slate-400 mb-4">Add partner details and notes</p>
                {hasWriteAccess && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Details
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Partner Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={deliveryPartner}
                      onChange={(e) => setDeliveryPartner(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm font-medium transition-all bg-white"
                      placeholder="Enter delivery partner name"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-slate-50 rounded-xl font-semibold text-slate-900 border border-slate-100">
                      {deliveryPartner || '—'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Notes
                  </label>
                  {isEditing ? (
                    <textarea
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm resize-none transition-all bg-white"
                      placeholder="Additional delivery notes..."
                    />
                  ) : (
                    <div className="px-4 py-3 bg-slate-50 rounded-xl text-sm text-slate-600 min-h-[60px] border border-slate-100">
                      {deliveryNotes || '—'}
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Documents - No outer box */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white shadow-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900">Documents</h4>
                  {documents.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                      {documents.length}
                    </span>
                  )}
                </div>
              </div>
              {hasWriteAccess && delivery && (
                <label className="cursor-pointer px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  {uploading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3 h-3" /> Upload
                    </>
                  )}
                </label>
              )}
            </div>

            {!delivery ? (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-amber-50/50 rounded-2xl border border-dashed border-amber-200">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">Save details first</p>
                <p className="text-xs text-slate-400">Add delivery info to enable uploads</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">No documents yet</p>
                <p className="text-xs text-slate-400 mb-4">Upload receipts, invoices, or photos</p>
                {hasWriteAccess && (
                  <label className="cursor-pointer px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Upload className="w-4 h-4" /> Upload Document
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="group flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-slate-100"
                  >
                    <div className={`w-10 h-10 rounded-xl ${getFileIconBg(doc.document_type)} flex items-center justify-center shadow-sm shrink-0`}>
                      {getFileIcon(doc.document_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate" title={doc.document_name}>
                        {doc.document_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(doc.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={doc.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="View"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {hasWriteAccess && (
                        <button
                          onClick={() => onDeleteDocument(doc.id)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Footer Info - Only show when enabled */}
      {enabled && (
        <div className="flex items-center gap-2 px-1 text-xs text-slate-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          <p>Tracking info only — does not affect inventory or order status.</p>
        </div>
      )}
    </div>
  );
}
