import { useEffect, useState } from 'react';
import { X, Edit, AlertCircle, Package, Loader2, MoreVertical, Trash2, ArrowRightLeft } from 'lucide-react';
import type { RawMaterial, RecurringProduct, WasteRecord, TransferRecord } from '../types/operations';
import {
  fetchRawMaterialBatchUsage,
  fetchRecurringProductBatchUsage,
  fetchWasteRecordsForLot,
  fetchTransferRecordsForLot,
  calculateStockBalance,
} from '../lib/operations';
import { WasteFormModal } from './WasteFormModal';
import { TransferFormModal } from './TransferFormModal';

interface LotDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  lot: RawMaterial | RecurringProduct | null;
  type: 'raw-material' | 'recurring-product';
  isLocked: boolean;
  batchIds: string[];
  canEdit: boolean;
  onRefresh?: () => void; // Callback to refresh lot data in parent
}

interface BatchOutput {
  output_name: string;
  produced_quantity: number;
  produced_unit: string;
  output_size?: number;
  output_size_unit?: string;
}

interface BatchUsage {
  batch_id: string;
  batch_date: string;
  quantity_consumed: number;
  unit: string;
  is_locked: boolean;
  qa_status: string;
  outputs: BatchOutput[];
}

// Helper component to display before/after transfer quantities
function TransferQuantityCell({
  lotType,
  lotId,
  transferDate,
  transferId,
  isOutgoing,
  quantity,
  unit,
  isAfter = false,
}: {
  lotType: 'raw_material' | 'recurring_product';
  lotId: string;
  transferDate: string;
  transferId: string;
  isOutgoing: boolean;
  quantity: number;
  unit: string;
  isAfter?: boolean;
}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const isWholeNumberUnit = unit === 'Pieces';

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        // Calculate balance at the transfer date (includes the transfer)
        const balanceAtDate = await calculateStockBalance(lotType, lotId, transferDate);
        
        if (isAfter) {
          // After transfer: current balance includes the transfer
          setBalance(balanceAtDate);
        } else {
          // Before transfer: reverse the transfer effect
          // Outgoing: was subtracted, so add it back
          // Incoming: was added, so subtract it
          setBalance(isOutgoing ? balanceAtDate + quantity : balanceAtDate - quantity);
        }
      } catch (err) {
        console.error('Failed to calculate balance:', err);
        setBalance(null);
      } finally {
        setLoading(false);
      }
    };
    void fetchBalance();
  }, [lotType, lotId, transferDate, transferId, isOutgoing, quantity, isAfter]);

  if (loading) {
    return <Loader2 className="w-3 h-3 animate-spin text-gray-400" />;
  }

  if (balance === null) {
    return <span className="text-gray-400">—</span>;
  }

  return (
    <span className="font-medium text-gray-900">
      {isWholeNumberUnit ? Math.floor(balance) : balance.toFixed(2)} {unit}
    </span>
  );
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
  onRefresh,
}: LotDetailsModalProps) {
  const [batchUsage, setBatchUsage] = useState<BatchUsage[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [loadingWaste, setLoadingWaste] = useState(false);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (isOpen && lot) {
      setLoadingUsage(true);
      setLoadingWaste(true);
      setLoadingTransfer(true);
      const fetchData = async () => {
        try {
          const [batchUsageData, wasteData, transferData] = await Promise.all([
            type === 'raw-material'
              ? fetchRawMaterialBatchUsage(lot.id)
              : fetchRecurringProductBatchUsage(lot.id),
            fetchWasteRecordsForLot(
              type === 'raw-material' ? 'raw_material' : 'recurring_product',
              lot.id
            ),
            fetchTransferRecordsForLot(
              type === 'raw-material' ? 'raw_material' : 'recurring_product',
              lot.id
            ),
          ]);
          
          setBatchUsage(batchUsageData);
          setWasteRecords(wasteData);
          setTransferRecords(transferData);
        } catch (error) {
          console.error('Failed to fetch history:', error);
          setBatchUsage([]);
          setWasteRecords([]);
          setTransferRecords([]);
        } finally {
          setLoadingUsage(false);
          setLoadingWaste(false);
          setLoadingTransfer(false);
        }
      };
      void fetchData();
    } else {
      setBatchUsage([]);
      setWasteRecords([]);
      setTransferRecords([]);
      setShowMenu(false);
    }
  }, [isOpen, lot, type]);

  const handleWasteSuccess = () => {
    // Refresh waste records
    if (lot) {
      setLoadingWaste(true);
      fetchWasteRecordsForLot(
        type === 'raw-material' ? 'raw_material' : 'recurring_product',
        lot.id
      )
        .then(setWasteRecords)
        .catch((error) => {
          console.error('Failed to refresh waste records:', error);
          setWasteRecords([]);
        })
        .finally(() => {
          setLoadingWaste(false);
          // Refresh lot data in parent component to update available quantity
          if (onRefresh) {
            onRefresh();
          }
        });
    }
  };

  const handleTransferSuccess = () => {
    // Refresh transfer records
    if (lot) {
      setLoadingTransfer(true);
      fetchTransferRecordsForLot(
        type === 'raw-material' ? 'raw_material' : 'recurring_product',
        lot.id
      )
        .then(setTransferRecords)
        .catch((error) => {
          console.error('Failed to refresh transfer records:', error);
          setTransferRecords([]);
        })
        .finally(() => {
          setLoadingTransfer(false);
          // Refresh lot data in parent component to update available quantity
          if (onRefresh) {
            onRefresh();
          }
        });
    }
  };

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
              <div className="flex items-center gap-2">
                {/* 3-dot menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {showMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <button
                          onClick={() => {
                            setShowTransferModal(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                        >
                          <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">Transfer</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowWasteModal(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-amber-600" />
                          <span className="font-medium">Waste Management</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                <label className="block text-sm font-medium text-gray-500 mb-1">Total Input</label>
                <p className="text-sm text-gray-900 font-semibold">
                  {lot.quantity_received} {lot.unit}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Initial quantity when lot was received</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Available</label>
                <p className={`text-sm font-bold ${
                  lot.quantity_available === 0 ? 'text-red-600' : 'text-green-700'
                }`}>
                  {lot.unit === 'Pieces' 
                    ? Math.floor(lot.quantity_available) 
                    : lot.quantity_available.toFixed(2)} {lot.unit}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Current available after all movements</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Total Used</label>
                <p className="text-sm text-gray-900 font-medium">
                  {(() => {
                    const used = lot.quantity_received - lot.quantity_available;
                    return lot.unit === 'Pieces' 
                      ? Math.floor(used) 
                      : used.toFixed(2);
                  })()} {lot.unit}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Batch consumption + Waste</p>
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
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Outputs</th>
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
                                {usage.outputs.length > 0 ? (
                                  <div className="space-y-1">
                                    {usage.outputs.map((output, idx) => (
                                      <div key={idx} className="text-xs">
                                        <div className="font-medium">{output.output_name}</div>
                                        <div className="text-gray-500">
                                          {output.produced_quantity} {output.produced_unit}
                                          {output.output_size && output.output_size_unit &&
                                            ` (${output.output_size}${output.output_size_unit})`
                                          }
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No outputs</span>
                                )}
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

            {/* Waste History */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-600" />
                Waste History
              </h4>
              {loadingWaste ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading waste history...</span>
                </div>
              ) : wasteRecords.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-100 border-b border-amber-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Waste ID</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Quantity</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Reason</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Notes</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Recorded By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-200">
                        {wasteRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-amber-100">
                            <td className="px-3 py-2 font-mono text-xs text-gray-900">{record.id.substring(0, 8)}</td>
                            <td className="px-3 py-2 text-gray-700">{record.waste_date}</td>
                            <td className="px-3 py-2 font-medium text-amber-800">
                              {lot.unit === 'Pieces' 
                                ? Math.floor(record.quantity_wasted) 
                                : record.quantity_wasted.toFixed(2)} {record.unit}
                            </td>
                            <td className="px-3 py-2 text-gray-700 text-xs">{record.reason}</td>
                            <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate" title={record.notes || undefined}>
                              {record.notes || '—'}
                            </td>
                            <td className="px-3 py-2 text-gray-600 text-xs">
                              {record.created_by_name || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-amber-100 border-t border-amber-200">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-amber-900 text-right">
                            Total Wasted:
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-amber-900">
                            {(() => {
                              const total = wasteRecords.reduce((sum, record) => sum + record.quantity_wasted, 0);
                              return lot.unit === 'Pieces' ? Math.floor(total) : total.toFixed(2);
                            })()} {lot.unit}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">No waste records found</p>
                </div>
              )}
            </div>

            {/* Transfer History */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                Transfer History
              </h4>
              {loadingTransfer ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading transfer history...</span>
                </div>
              ) : transferRecords.length > 0 ? (
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-blue-100 to-indigo-100 border-b-2 border-blue-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Direction</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Quantity</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Reason</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Before Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">After Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Recorded By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100 bg-white/50">
                        {transferRecords.map((record) => {
                          const isOutgoing = record.type === 'transfer_out';
                          const otherLotId = isOutgoing ? record.to_lot_identifier : record.from_lot_identifier;
                          const quantityDisplay = lot.unit === 'Pieces' 
                            ? Math.floor(record.quantity_transferred) 
                            : record.quantity_transferred.toFixed(2);
                          
                          return (
                            <tr key={record.id} className="hover:bg-blue-50/70 transition-colors">
                              <td className="px-4 py-3 text-gray-700 font-medium">{record.transfer_date}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-medium text-gray-700">
                                    {isOutgoing ? 'Transferred To' : 'Transferred From'}
                                  </span>
                                  <span className="text-xs font-semibold text-blue-700">
                                    {otherLotId}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-semibold text-xs ${
                                  isOutgoing 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {isOutgoing ? '-' : '+'}{quantityDisplay} {record.unit}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700 text-xs font-medium">{record.reason}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                <TransferQuantityCell 
                                  lotType={type === 'raw-material' ? 'raw_material' : 'recurring_product'}
                                  lotId={lot.id}
                                  transferDate={record.transfer_date}
                                  transferId={record.id}
                                  isOutgoing={isOutgoing}
                                  quantity={record.quantity_transferred}
                                  unit={lot.unit}
                                />
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                <TransferQuantityCell 
                                  lotType={type === 'raw-material' ? 'raw_material' : 'recurring_product'}
                                  lotId={lot.id}
                                  transferDate={record.transfer_date}
                                  transferId={record.id}
                                  isOutgoing={isOutgoing}
                                  quantity={record.quantity_transferred}
                                  unit={lot.unit}
                                  isAfter={true}
                                />
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {record.created_by_name || <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 text-center">
                  <ArrowRightLeft className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                  <p className="text-sm text-blue-700 font-medium">No transfer records found</p>
                </div>
              )}
            </div>

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

      {/* Waste Form Modal */}
      {lot && (
        <WasteFormModal
          isOpen={showWasteModal}
          onClose={() => setShowWasteModal(false)}
          onSuccess={handleWasteSuccess}
          lot={lot}
          lotType={type === 'raw-material' ? 'raw_material' : 'recurring_product'}
        />
      )}

      {/* Transfer Form Modal */}
      {lot && (
        <TransferFormModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          onSuccess={handleTransferSuccess}
          lot={lot}
          lotType={type === 'raw-material' ? 'raw_material' : 'recurring_product'}
        />
      )}
    </div>
  );
}

