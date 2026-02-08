import { useEffect, useState } from 'react';
import { X, Package, Calendar, CheckCircle, AlertCircle, Info, ExternalLink, ShoppingCart, User, IndianRupee, Trash2, Loader2 } from 'lucide-react';
import type { ProcessedGood, ProcessedGoodWasteRecord } from '../types/operations';
import { fetchProcessedGoodSalesHistory } from '../lib/sales';
import type { ProcessedGoodSalesHistory } from '../types/sales';
import { fetchProcessedGoodWasteRecords } from '../lib/operations';
import { ProcessedGoodWasteFormModal } from './ProcessedGoodWasteFormModal';

interface ProcessedGoodDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  processedGood: ProcessedGood | null;
  onBatchReferenceClick?: (batchId: string | undefined) => void;
  onOrderClick?: (orderId: string) => void;
  onWasteRecorded?: () => void;
}

export function ProcessedGoodDetailsModal({
  isOpen,
  onClose,
  processedGood,
  onBatchReferenceClick,
  onOrderClick,
  onWasteRecorded,
}: ProcessedGoodDetailsModalProps) {
  const [salesHistory, setSalesHistory] = useState<ProcessedGoodSalesHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [wasteRecords, setWasteRecords] = useState<ProcessedGoodWasteRecord[]>([]);
  const [loadingWaste, setLoadingWaste] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [selectedWasteDetail, setSelectedWasteDetail] = useState<ProcessedGoodWasteRecord | null>(null);

  useEffect(() => {
    if (isOpen && processedGood?.id) {
      void loadSalesHistory();
      void loadWasteRecords();
    } else {
      setSalesHistory([]);
      setHistoryError(null);
      setWasteRecords([]);
      setSelectedWasteDetail(null);
    }
  }, [isOpen, processedGood?.id]);

  const loadSalesHistory = async () => {
    if (!processedGood?.id) return;
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const history = await fetchProcessedGoodSalesHistory(processedGood.id);
      setSalesHistory(history);
    } catch (err) {
      console.error('Failed to load sales history:', err);
      setHistoryError(err instanceof Error ? err.message : 'Failed to load sales history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadWasteRecords = async () => {
    if (!processedGood?.id) return;
    setLoadingWaste(true);
    try {
      const records = await fetchProcessedGoodWasteRecords(processedGood.id);
      setWasteRecords(records);
    } catch (err) {
      console.error('Failed to load waste records:', err);
      setWasteRecords([]);
    } finally {
      setLoadingWaste(false);
    }
  };

  const handleWasteSuccess = () => {
    void loadWasteRecords();
    onWasteRecorded?.();
  };

  if (!isOpen || !processedGood) return null;

  // Parse custom fields if they exist
  let customFields: Array<{ key: string, value: string }> = [];
  if (processedGood.custom_fields) {
    try {
      if (typeof processedGood.custom_fields === 'string') {
        customFields = JSON.parse(processedGood.custom_fields);
      } else if (Array.isArray(processedGood.custom_fields)) {
        customFields = processedGood.custom_fields;
      }
    } catch (e) {
      console.error('Failed to parse custom_fields:', e);
    }
  }

  const handleBatchReferenceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBatchReferenceClick) {
      onBatchReferenceClick(processedGood.batch_id);
      onClose();
    }
  };

  const handleOrderClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (onOrderClick) {
      onOrderClick(orderId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-900/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal panel */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div
          className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Package className="w-5 h-5" />
              </div>
              Processed Good Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {/* Processed Good Basic Info */}
            <div className="mb-8">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Product Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Left Column: Core Info */}
                <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100 space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Product Type</label>
                    <p className="text-base font-bold text-gray-900">{processedGood.product_type}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Batch Reference</label>
                      {onBatchReferenceClick && processedGood.batch_id ? (
                        <button
                          onClick={handleBatchReferenceClick}
                          className="text-sm text-blue-600 hover:text-blue-700 font-mono font-medium flex items-center gap-1 transition-colors hover:underline"
                        >
                          {processedGood.batch_reference}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <p className="text-sm text-gray-900 font-mono">{processedGood.batch_reference}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Production Date</label>
                      <p className="text-sm text-gray-900 flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(processedGood.production_date).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1.5">QA Status</label>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${processedGood.qa_status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      processedGood.qa_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                        processedGood.qa_status === 'hold' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                      {processedGood.qa_status === 'approved' && <CheckCircle className="w-3.5 h-3.5" />}
                      {processedGood.qa_status === 'rejected' && <AlertCircle className="w-3.5 h-3.5" />}
                      {processedGood.qa_status === 'hold' && <Info className="w-3.5 h-3.5" />}
                      {processedGood.qa_status || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Right Column: Inventory Stats */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <h5 className="text-sm font-bold text-gray-900">Inventory Status</h5>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                      <span className="text-xs text-gray-500">Total Created</span>
                      <span className="text-sm font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded text-right">
                        {processedGood.quantity_created ?? processedGood.quantity_available}
                        <span className="text-xs font-normal text-gray-500 ml-1">{processedGood.unit}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                      <span className="text-xs text-blue-600 font-medium">Ordered</span>
                      <span className="text-sm font-bold text-blue-600 text-right">
                        {processedGood.quantity_delivered ?? 0}
                        <span className="text-xs font-normal text-blue-400 ml-1">{processedGood.unit}</span>
                      </span>
                    </div>

                    {(processedGood.total_wasted ?? 0) > 0 && (
                      <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                        <span className="text-xs text-amber-700 font-medium">Unbilled/damage</span>
                        <span className="text-sm font-bold text-amber-700 text-right">
                          {processedGood.total_wasted}
                          <span className="text-xs font-normal text-amber-600 ml-1">{processedGood.unit}</span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-bold text-gray-700">Available</span>
                      <span className={`text-lg font-bold text-right ${(processedGood.actual_available ?? processedGood.quantity_available) <= 0 ? 'text-red-500' : 'text-emerald-600'
                        }`}>
                        {processedGood.actual_available ?? processedGood.quantity_available}
                        <span className="text-xs font-medium text-gray-400 ml-1">{processedGood.unit}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Fields & Output Size */}
              {(customFields.length > 0 || (processedGood.output_size && processedGood.output_size_unit)) && (
                <div className="mt-6 bg-gray-50/30 rounded-xl p-4 border border-gray-100">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Specifications</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {processedGood.output_size && processedGood.output_size_unit && (
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase">Size</span>
                        <span className="text-sm font-medium text-gray-900">{processedGood.output_size} {processedGood.output_size_unit}</span>
                      </div>
                    )}
                    {customFields.map((field, index) => (
                      <div key={index}>
                        <span className="text-[10px] text-gray-400 block uppercase">{field.key}</span>
                        <span className="text-sm font-medium text-gray-900">{field.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Information */}
              {processedGood.additional_information && (
                <div className="mt-6">
                  <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</h5>
                  <div className="bg-yellow-50/50 rounded-xl p-4 border border-yellow-100">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{processedGood.additional_information}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sales History */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center justify-between">
                <span>Sales History</span>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{salesHistory.length} Record{salesHistory.length !== 1 && 's'}</span>
              </h4>

              {loadingHistory ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-gray-500 font-medium">Retrieving sales data...</p>
                </div>
              ) : historyError ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <p className="text-sm text-red-600">{historyError}</p>
                </div>
              ) : salesHistory.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100 border-dashed">
                  <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No sales recorded for this batch yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {salesHistory.map((sale) => (
                    <div
                      key={sale.id}
                      onClick={(e) => onOrderClick && handleOrderClick(e, sale.order_id)}
                      className={`
                        bg-white rounded-xl p-4 border border-gray-200 transition-all duration-200
                        ${onOrderClick
                          ? 'cursor-pointer hover:shadow-md hover:border-indigo-300 hover:bg-indigo-50/10 group'
                          : ''}
                      `}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2 mb-1.5">
                            <span className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {sale.order_number}
                            </span>
                            {onOrderClick && <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-indigo-400" />}

                            {sale.customer_name && (
                              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                <User className="w-3 h-3" />
                                {sale.customer_name}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium text-indigo-900/80">{sale.quantity_delivered} {sale.unit}</span>
                            <span className="text-gray-400 mx-1">•</span>
                            <span className="text-gray-500">{sale.product_type}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg self-start">
                          <IndianRupee className="w-3.5 h-3.5" />
                          {sale.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>Ordered: {new Date(sale.order_date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short'
                          })}</span>
                        </div>
                        <div className="ml-auto font-medium text-gray-400">
                          @ ₹{sale.unit_price.toFixed(2)}/{sale.unit}
                        </div>
                      </div>

                      {sale.delivery_notes && (
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 italic">
                          "{sale.delivery_notes}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Waste History */}
            <div className="mt-8">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-amber-600" />
                  Waste History
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{wasteRecords.length} Record{wasteRecords.length !== 1 && 's'}</span>
                  <button
                    type="button"
                    onClick={() => setShowWasteModal(true)}
                    className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Record waste
                  </button>
                </div>
              </h4>

              {loadingWaste ? (
                <div className="bg-amber-50/50 rounded-xl p-8 text-center flex flex-col items-center justify-center border border-amber-100">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Loading waste history...</p>
                </div>
              ) : wasteRecords.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-100 border-dashed">
                  <Trash2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No waste or damage recorded for this lot.</p>
                  <button
                    type="button"
                    onClick={() => setShowWasteModal(true)}
                    className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-800"
                  >
                    Record waste
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {wasteRecords.map((record) => {
                    const isWhole = processedGood.unit === 'Pieces' || processedGood.unit?.toLowerCase() === 'bottles';
                    const qtyDisplay = isWhole ? Math.floor(record.quantity_wasted) : record.quantity_wasted.toFixed(2);
                    return (
                      <div
                        key={record.id}
                        onClick={() => setSelectedWasteDetail(record)}
                        className="bg-amber-50/80 rounded-xl p-4 border border-amber-200/80 cursor-pointer hover:bg-amber-100/80 hover:border-amber-300 transition-all duration-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span className="font-bold text-amber-900">
                                {qtyDisplay} {record.unit}
                              </span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${record.waste_type === 'recycle' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-900'}`}>
                                {record.waste_type === 'recycle' ? 'Recycle' : 'Full waste'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{record.reason}</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(record.waste_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        {record.notes && (
                          <p className="mt-2 text-xs text-gray-600 line-clamp-1">{record.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Waste detail overlay */}
          {selectedWasteDetail && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
              onClick={() => setSelectedWasteDetail(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-sm w-full p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Waste details</h5>
                  <button
                    type="button"
                    onClick={() => setSelectedWasteDetail(null)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Quantity</span>
                    <span className="font-semibold text-gray-900">
                      {(processedGood.unit === 'Pieces' || processedGood.unit?.toLowerCase() === 'bottles')
                        ? Math.floor(selectedWasteDetail.quantity_wasted)
                        : selectedWasteDetail.quantity_wasted.toFixed(2)} {selectedWasteDetail.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full ${selectedWasteDetail.waste_type === 'recycle' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {selectedWasteDetail.waste_type === 'recycle' ? 'Recycle' : 'Full waste'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Reason</span>
                    <p className="font-medium text-gray-900">{selectedWasteDetail.reason}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span className="font-medium text-gray-900">
                      {new Date(selectedWasteDetail.waste_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {selectedWasteDetail.notes && (
                    <div>
                      <span className="text-gray-500 block mb-0.5">Notes</span>
                      <p className="text-gray-700">{selectedWasteDetail.notes}</p>
                    </div>
                  )}
                  {selectedWasteDetail.created_by_name && (
                    <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
                      Recorded by {selectedWasteDetail.created_by_name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white border border-gray-300 shadow-sm text-sm font-semibold text-gray-700 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>

      {processedGood && (
        <ProcessedGoodWasteFormModal
          isOpen={showWasteModal}
          onClose={() => setShowWasteModal(false)}
          onSuccess={handleWasteSuccess}
          processedGood={processedGood}
        />
      )}
    </div>
  );
}
