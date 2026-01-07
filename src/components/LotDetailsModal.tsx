import { useEffect, useState } from 'react';
import { X, Edit, AlertCircle, Package, Loader2 } from 'lucide-react';
import type { RawMaterial, RecurringProduct } from '../types/operations';
import {
  fetchRawMaterialBatchUsage,
  fetchRecurringProductBatchUsage,
} from '../lib/operations';

interface LotDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  lot: RawMaterial | RecurringProduct | null;
  type: 'raw-material' | 'recurring-product';
  isLocked: boolean;
  batchIds: string[];
  canEdit: boolean;
}

interface BatchUsage {
  batch_id: string;
  batch_date: string;
  quantity_consumed: number;
  unit: string;
  is_locked: boolean;
  qa_status: string;
  output_product_type?: string;
}

export function LotDetailsModal({
  isOpen,
  onClose,
  onEdit,
  lot,
  type,
  isLocked,
  batchIds,
  canEdit,
}: LotDetailsModalProps) {
  const [batchUsage, setBatchUsage] = useState<BatchUsage[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    if (isOpen && lot) {
      setLoadingUsage(true);
      const fetchUsage = async () => {
        try {
          const usage = type === 'raw-material'
            ? await fetchRawMaterialBatchUsage(lot.id)
            : await fetchRecurringProductBatchUsage(lot.id);
          setBatchUsage(usage);
        } catch (error) {
          console.error('Failed to fetch batch usage:', error);
          setBatchUsage([]);
        } finally {
          setLoadingUsage(false);
        }
      };
      void fetchUsage();
    } else {
      setBatchUsage([]);
    }
  }, [isOpen, lot, type]);

  if (!isOpen || !lot) return null;

  const isRawMaterial = type === 'raw-material';
  const material = lot as RawMaterial;
  const product = lot as RecurringProduct;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {isRawMaterial ? 'Raw Material' : 'Recurring Product'} Details
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                <p className="text-sm text-gray-900 font-medium">{lot.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Lot ID</label>
                <p className="text-sm text-gray-900 font-mono">{lot.lot_id}</p>
              </div>

              {isRawMaterial && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Supplier</label>
                    <p className="text-sm text-gray-900">{material.supplier_name || '—'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Condition</label>
                    <p className="text-sm text-gray-900">{material.condition || '—'}</p>
                  </div>
                </>
              )}

              {!isRawMaterial && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Category</label>
                    <p className="text-sm text-gray-900">{product.category || '—'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Supplier</label>
                    <p className="text-sm text-gray-900">{product.supplier_name || '—'}</p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Quantity Received</label>
                <p className="text-sm text-gray-900">
                  {lot.quantity_received} {lot.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Quantity Available</label>
                <p className={`text-sm font-medium ${
                  lot.quantity_available === 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {lot.quantity_available} {lot.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Quantity Consumed</label>
                <p className="text-sm text-gray-900">
                  {lot.quantity_received - lot.quantity_available} {lot.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Received Date</label>
                <p className="text-sm text-gray-900">{lot.received_date}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Handover To</label>
                <p className="text-sm text-gray-900">
                  {isRawMaterial ? material.handover_to_name : product.handover_to_name || '—'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Amount Paid</label>
                <p className="text-sm text-gray-900">
                  {lot.amount_paid ? `₹${lot.amount_paid.toLocaleString('en-IN')}` : '—'}
                </p>
              </div>

              {isRawMaterial && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Storage Notes</label>
                  <p className="text-sm text-gray-900">{material.storage_notes || '—'}</p>
                </div>
              )}

              {!isRawMaterial && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                  <p className="text-sm text-gray-900">{product.notes || '—'}</p>
                </div>
              )}
            </div>

            {/* Batch Usage History */}
            {batchUsage.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Batch Usage History
                </h4>
                {loadingUsage ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading usage history...</span>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Batch ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Quantity Used</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Product</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {batchUsage.map((usage, index) => (
                            <tr key={`${usage.batch_id}-${index}`} className="hover:bg-gray-100">
                              <td className="px-3 py-2 font-mono text-xs text-gray-900">{usage.batch_id}</td>
                              <td className="px-3 py-2 text-gray-700">{usage.batch_date}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {usage.quantity_consumed} {usage.unit}
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {usage.output_product_type || '—'}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                    usage.is_locked
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {usage.is_locked ? 'Locked' : 'Draft'}
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                    usage.qa_status === 'approved'
                                      ? 'bg-green-100 text-green-800'
                                      : usage.qa_status === 'rejected'
                                        ? 'bg-red-100 text-red-800'
                                        : usage.qa_status === 'hold'
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {usage.qa_status}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t border-gray-200">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">
                              Total Consumed:
                            </td>
                            <td className="px-3 py-2 text-xs font-bold text-gray-900">
                              {batchUsage.reduce((sum, usage) => sum + usage.quantity_consumed, 0)} {lot.unit}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lock Status Warning */}
            {isLocked && batchIds.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 mb-1">
                      This lot is locked and cannot be edited or deleted
                    </h4>
                    <p className="text-xs text-yellow-700">
                      Used in {batchIds.length} locked production batch(es)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
              {canEdit && (
                <button
                  onClick={() => {
                    onEdit();
                    onClose();
                  }}
                  disabled={isLocked}
                  className={`px-4 py-2 text-sm font-medium rounded-md flex items-center ${
                    isLocked
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

