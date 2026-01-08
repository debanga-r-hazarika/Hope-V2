import { useEffect, useState } from 'react';
import { X, Edit, AlertCircle, Package, Loader2, Trash2, ArrowRightLeft } from 'lucide-react';
import type { RawMaterial, RecurringProduct } from '../types/operations';
import {
  fetchRawMaterialBatchUsage,
  fetchRecurringProductBatchUsage,
  fetchRawMaterialWasteTransferHistory,
  fetchRecurringProductWasteTransferHistory,
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

interface WasteTransferRecord {
  waste_id?: string;
  transfer_id?: string;
  waste_date?: string;
  transfer_date?: string;
  quantity_wasted?: number;
  quantity_transferred?: number;
  quantity_before?: number;
  quantity_after?: number;
  unit: string;
  reason: string;
  notes?: string;
  type: 'waste' | 'transfer_out' | 'transfer_in';
  from_lot_id?: string;
  from_lot_identifier?: string;
  from_lot_name?: string;
  to_lot_id?: string;
  to_lot_identifier?: string;
  to_lot_name?: string;
  created_at?: string;
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
  const [wasteTransferHistory, setWasteTransferHistory] = useState<WasteTransferRecord[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    if (isOpen && lot) {
      setLoadingUsage(true);
      const fetchUsage = async () => {
        try {
          const [batchUsageData, wasteTransferData] = await Promise.all([
            type === 'raw-material'
              ? fetchRawMaterialBatchUsage(lot.id)
              : fetchRecurringProductBatchUsage(lot.id),
            type === 'raw-material'
              ? fetchRawMaterialWasteTransferHistory(lot.id)
              : fetchRecurringProductWasteTransferHistory(lot.id),
          ]);
          
          setBatchUsage(batchUsageData);
          
          // Combine and sort waste/transfer records by date (oldest first for quantity calculations)
          const combined: WasteTransferRecord[] = [
            ...wasteTransferData.wasteRecords.map(w => ({
              waste_id: w.waste_id,
              waste_date: w.waste_date,
              quantity_wasted: w.quantity_wasted,
              unit: w.unit,
              reason: w.reason,
              notes: w.notes,
              type: 'waste' as const,
              created_at: (w as any).created_at,
            })),
            ...wasteTransferData.transferRecords.map(t => ({
              transfer_id: t.transfer_id,
              transfer_date: t.transfer_date,
              quantity_transferred: t.quantity_transferred,
              unit: t.unit,
              reason: t.reason,
              notes: t.notes,
              from_lot_id: t.from_lot_id,
              from_lot_identifier: t.from_lot_identifier || lot.lot_id,
              from_lot_name: t.from_lot_name || lot.name,
              to_lot_id: t.to_lot_id,
              to_lot_identifier: t.to_lot_identifier || lot.lot_id,
              to_lot_name: t.to_lot_name || lot.name,
              type: t.type,
              created_at: (t as any).created_at,
            })),
          ].sort((a, b) => {
            const dateA = a.waste_date || a.transfer_date || '';
            const dateB = b.waste_date || b.transfer_date || '';
            const dateCompare = dateA.localeCompare(dateB);
            if (dateCompare !== 0) return dateCompare;
            // If dates are equal, sort by created_at (oldest first for accurate calculations)
            const createdAtA = (a as any).created_at || '';
            const createdAtB = (b as any).created_at || '';
            return new Date(createdAtA).getTime() - new Date(createdAtB).getTime();
          });

          // Calculate before/after quantities for each record
          // Calculate total batch consumption first
          const totalBatchConsumption = batchUsageData.reduce((sum, usage) => sum + usage.quantity_consumed, 0);
          
          // Start with quantity_received minus total batch consumption (baseline after all batch consumption)
          // Then apply waste/transfers chronologically
          let runningQuantity = lot.quantity_received - totalBatchConsumption;
          
          const recordsWithQuantities = combined.map(record => {
            let quantityBefore = runningQuantity;
            let quantityAfter = runningQuantity;

            if (record.type === 'waste') {
              quantityAfter = runningQuantity - (record.quantity_wasted || 0);
              runningQuantity = quantityAfter;
            } else if (record.type === 'transfer_out') {
              quantityAfter = runningQuantity - (record.quantity_transferred || 0);
              runningQuantity = quantityAfter;
            } else if (record.type === 'transfer_in') {
              quantityAfter = runningQuantity + (record.quantity_transferred || 0);
              runningQuantity = quantityAfter;
            }

            return {
              ...record,
              quantity_before: quantityBefore,
              quantity_after: quantityAfter,
            };
          }).reverse(); // Reverse to show newest first

          setWasteTransferHistory(recordsWithQuantities);
        } catch (error) {
          console.error('Failed to fetch usage history:', error);
          setBatchUsage([]);
          setWasteTransferHistory([]);
        } finally {
          setLoadingUsage(false);
        }
      };
      void fetchUsage();
    } else {
      setBatchUsage([]);
      setWasteTransferHistory([]);
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

            {/* Waste & Transfer History */}
            {wasteTransferHistory.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Waste & Transfer History
                </h4>
                {loadingUsage ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading history...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Waste Records */}
                    {wasteTransferHistory.filter(r => r.type === 'waste').length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
                          <h5 className="text-xs font-semibold text-red-800 flex items-center gap-2">
                            <Trash2 className="w-3 h-3" />
                            Waste Records
                          </h5>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Waste ID</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Lot</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Waste Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Quantity Before</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Quantity Wasted</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Quantity After</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {wasteTransferHistory.filter(r => r.type === 'waste').map((record, index) => (
                                <tr key={`${record.waste_id}-${index}`} className="hover:bg-gray-100">
                                  <td className="px-3 py-2 font-mono text-xs text-gray-900">{record.waste_id || 'N/A'}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-col">
                                      <span className="font-mono text-xs text-gray-900">{lot.lot_id}</span>
                                      <span className="text-xs text-gray-600">{lot.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-gray-700">{record.waste_date || '—'}</td>
                                  <td className="px-3 py-2 font-medium text-gray-900">
                                    {record.quantity_before?.toFixed(2) || '—'} {record.unit}
                                  </td>
                                  <td className="px-3 py-2 font-medium text-red-700">
                                    {record.quantity_wasted?.toFixed(2) || '—'} {record.unit}
                                  </td>
                                  <td className="px-3 py-2 font-medium text-gray-900">
                                    {record.quantity_after?.toFixed(2) || '—'} {record.unit}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700 text-xs">{record.reason}</td>
                                  <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate" title={record.notes || undefined}>
                                    {record.notes || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Transfer Records */}
                    {wasteTransferHistory.filter(r => r.type === 'transfer_out' || r.type === 'transfer_in').length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
                          <h5 className="text-xs font-semibold text-blue-800 flex items-center gap-2">
                            <ArrowRightLeft className="w-3 h-3" />
                            Transfer Records
                          </h5>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Transfer ID</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">From Lot</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">To Lot</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Quantity Before</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Quantity Transferred</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Quantity After</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {wasteTransferHistory.filter(r => r.type === 'transfer_out' || r.type === 'transfer_in').map((record, index) => {
                                // Determine if this is a credit (transfer_in) or debit (transfer_out) for the current lot
                                const isCredit = record.type === 'transfer_in';
                                const isDebit = record.type === 'transfer_out';
                                
                                return (
                                  <tr key={`${record.transfer_id}-${index}`} className={`hover:bg-gray-100 ${isDebit ? 'bg-orange-50/50' : 'bg-green-50/50'}`}>
                                    <td className="px-3 py-2 font-mono text-xs text-gray-900">{record.transfer_id || 'N/A'}</td>
                                    <td className="px-3 py-2 text-gray-700">{record.transfer_date || '—'}</td>
                                    <td className="px-3 py-2">
                                      <div className="flex flex-col">
                                        <span className="font-mono text-xs font-semibold text-gray-900">{record.from_lot_identifier || '—'}</span>
                                        <span className="text-xs text-gray-600">{record.from_lot_name || '—'}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex flex-col">
                                        <span className="font-mono text-xs font-semibold text-gray-900">{record.to_lot_identifier || '—'}</span>
                                        <span className="text-xs text-gray-600">{record.to_lot_name || '—'}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                      {record.quantity_before?.toFixed(2) || '—'} {record.unit}
                                    </td>
                                    <td className="px-3 py-2 font-bold">
                                      {isCredit ? (
                                        <span className="text-green-600">+{record.quantity_transferred?.toFixed(2) || '—'} {record.unit}</span>
                                      ) : (
                                        <span className="text-red-600">-{record.quantity_transferred?.toFixed(2) || '—'} {record.unit}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                      {record.quantity_after?.toFixed(2) || '—'} {record.unit}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 text-xs">{record.reason}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
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

