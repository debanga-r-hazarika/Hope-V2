import { useState, useEffect } from 'react';
import { Truck, Upload, FileText, Trash2, Save, X, Image, FileIcon, ExternalLink, CheckCircle } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';
import { ModernCard } from './ui/ModernCard';
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
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    return <FileIcon className="w-5 h-5 text-red-500" />;
  };

  return (
    <ModernCard className="mt-6 overflow-hidden">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-5 border-b border-indigo-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-indigo-100">
              <Truck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Third-Party Delivery Tracking</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {enabled ? 'Track delivery partner information and documents' : 'Enable to track third-party delivery details'}
              </p>
            </div>
          </div>
          {hasWriteAccess && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">
                {toggling ? 'Loading...' : enabled ? 'Enabled' : 'Enable Tracking'}
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={async (e) => {
                    setToggling(true);
                    try {
                      await onToggle(e.target.checked);
                    } finally {
                      setToggling(false);
                    }
                  }}
                  disabled={toggling}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
              </div>
            </label>
          )}
        </div>
      </div>

      {enabled && (
        <div className="p-6 space-y-6">
          {/* Delivery Information Section */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  Delivery Information
                </h4>
                {hasWriteAccess && !isEditing && (
                  <ModernButton
                    onClick={() => setIsEditing(true)}
                    variant="secondary"
                    size="sm"
                  >
                    {delivery ? 'Edit Details' : 'Add Details'}
                  </ModernButton>
                )}
              </div>
            </div>

            <div className="p-5">
              {!delivery && !isEditing ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No delivery information added yet</p>
                  {hasWriteAccess && (
                    <ModernButton
                      onClick={() => setIsEditing(true)}
                      variant="primary"
                      size="sm"
                      className="mt-3"
                    >
                      Add Delivery Info
                    </ModernButton>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Quantity Delivered
                      </label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={quantityDelivered}
                          onChange={(e) => setQuantityDelivered(e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          placeholder="Enter quantity"
                          step="0.01"
                        />
                      ) : (
                        <div className="px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg">
                          <span className="text-gray-900 font-medium">
                            {quantityDelivered || '—'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Delivery Partner
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={deliveryPartner}
                          onChange={(e) => setDeliveryPartner(e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          placeholder="e.g., Blue Dart, DTDC, FedEx"
                        />
                      ) : (
                        <div className="px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg">
                          <span className="text-gray-900 font-medium">
                            {deliveryPartner || '—'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Delivery Notes
                    </label>
                    {isEditing ? (
                      <textarea
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                        placeholder="Add any additional delivery information..."
                      />
                    ) : (
                      <div className="px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg min-h-[80px]">
                        <span className="text-gray-900 whitespace-pre-wrap">
                          {deliveryNotes || '—'}
                        </span>
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex gap-3 pt-2">
                      <ModernButton
                        onClick={handleSave}
                        disabled={saving}
                        variant="primary"
                        icon={saving ? undefined : <Save className="w-4 h-4" />}
                      >
                        {saving ? 'Saving...' : 'Save Information'}
                      </ModernButton>
                      <ModernButton
                        onClick={() => {
                          setIsEditing(false);
                          if (delivery) {
                            setQuantityDelivered(delivery.quantity_delivered?.toString() || '');
                            setDeliveryPartner(delivery.delivery_partner_name || '');
                            setDeliveryNotes(delivery.delivery_notes || '');
                          }
                        }}
                        variant="ghost"
                        icon={<X className="w-4 h-4" />}
                      >
                        Cancel
                      </ModernButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Documents Section */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-gray-600" />
                  Delivery Documents
                  {documents.length > 0 && (
                    <span className="ml-2 px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                      {documents.length}
                    </span>
                  )}
                </h4>
                {hasWriteAccess && delivery && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    <div className="inline-block">
                      <ModernButton
                        variant="secondary"
                        size="sm"
                        disabled={uploading}
                        icon={<Upload className="w-4 h-4" />}
                      >
                        {uploading ? 'Uploading...' : 'Upload Document'}
                      </ModernButton>
                    </div>
                  </label>
                )}
              </div>
            </div>

            <div className="p-5">
              {!delivery ? (
                <div className="text-center py-8 bg-amber-50 rounded-lg border-2 border-amber-200">
                  <Upload className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                  <p className="text-amber-800 text-sm font-medium">
                    Please save delivery information first before uploading documents
                  </p>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-1">No documents uploaded yet</p>
                  <p className="text-gray-400 text-xs">Upload delivery slips, photos, or proof of delivery</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="group relative bg-gradient-to-br from-gray-50 to-white rounded-lg border-2 border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {getFileIcon(doc.document_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate mb-1">
                            {doc.document_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(doc.created_at).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <a
                              href={doc.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                            {hasWriteAccess && (
                              <button
                                onClick={() => onDeleteDocument(doc.id)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  Record-Keeping Only
                </p>
                <p className="text-xs text-blue-800 leading-relaxed">
                  This information is for tracking purposes only and does not affect inventory or order status. 
                  Inventory is automatically managed when order items are added or removed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModernCard>
  );
}
