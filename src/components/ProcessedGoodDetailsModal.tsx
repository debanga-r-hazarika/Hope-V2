import { useEffect, useState } from 'react';
import { X, Package, Calendar, CheckCircle, AlertCircle, Info, ExternalLink, ShoppingCart, User, IndianRupee, Truck } from 'lucide-react';
import type { ProcessedGood } from '../types/operations';
import { fetchProcessedGoodSalesHistory } from '../lib/sales';
import type { ProcessedGoodSalesHistory } from '../types/sales';

interface ProcessedGoodDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  processedGood: ProcessedGood | null;
  onBatchReferenceClick?: (batchId: string | undefined) => void;
  onOrderClick?: (orderId: string) => void;
}

export function ProcessedGoodDetailsModal({
  isOpen,
  onClose,
  processedGood,
  onBatchReferenceClick,
  onOrderClick,
}: ProcessedGoodDetailsModalProps) {
  const [salesHistory, setSalesHistory] = useState<ProcessedGoodSalesHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && processedGood?.id) {
      void loadSalesHistory();
    } else {
      setSalesHistory([]);
      setHistoryError(null);
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

  if (!isOpen || !processedGood) return null;

  // Parse custom fields if they exist
  let customFields: Array<{key: string, value: string}> = [];
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
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Processed Good Details
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Processed Good Basic Info */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Product Information</h4>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Product Type</label>
                  <p className="text-sm text-gray-900 font-medium">{processedGood.product_type}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Quantity Available</label>
                  <p className={`text-sm font-semibold ${
                    ((processedGood as any).actual_available ?? processedGood.quantity_available) === 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {(processedGood as any).actual_available ?? processedGood.quantity_available} {processedGood.unit}
                  </p>
                  {(processedGood as any).actual_available !== undefined && (processedGood as any).actual_available !== processedGood.quantity_available && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      ({processedGood.quantity_available} total, {processedGood.quantity_available - ((processedGood as any).actual_available ?? 0)} reserved)
                    </p>
                  )}
                </div>
                {processedGood.output_size && processedGood.output_size_unit && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Output Size</label>
                    <p className="text-sm text-gray-900">
                      {processedGood.output_size} {processedGood.output_size_unit}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Production Date</label>
                  <p className="text-sm text-gray-900 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {processedGood.production_date}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">QA Status</label>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    processedGood.qa_status === 'approved' ? 'bg-green-100 text-green-800' :
                    processedGood.qa_status === 'rejected' ? 'bg-red-100 text-red-800' :
                    processedGood.qa_status === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {processedGood.qa_status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {processedGood.qa_status === 'rejected' && <AlertCircle className="w-3 h-3" />}
                    {processedGood.qa_status === 'hold' && <Info className="w-3 h-3" />}
                    {processedGood.qa_status}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Batch Reference</label>
                  {onBatchReferenceClick && processedGood.batch_id ? (
                    <button
                      onClick={handleBatchReferenceClick}
                      className="text-sm text-blue-600 hover:text-blue-700 font-mono flex items-center gap-1 transition-colors"
                    >
                      {processedGood.batch_reference}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : (
                    <p className="text-sm text-gray-900 font-mono">{processedGood.batch_reference}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Custom Fields</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {customFields.map((field, index) => (
                      <div key={index}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{field.key}</label>
                        <p className="text-sm text-gray-900">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Additional Information */}
            {processedGood.additional_information && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Additional Information</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{processedGood.additional_information}</p>
                </div>
              </div>
            )}

            {/* Sales History */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Sales History
              </h4>
              {loadingHistory ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading sales history...</p>
                </div>
              ) : historyError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{historyError}</p>
                </div>
              ) : salesHistory.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">No sales records found for this processed good lot.</p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                  {salesHistory.map((sale) => (
                    <div
                      key={sale.id}
                      onClick={(e) => onOrderClick && handleOrderClick(e, sale.order_id)}
                      className={`bg-white rounded-lg p-4 border border-gray-200 transition-all ${
                        onOrderClick 
                          ? 'cursor-pointer hover:shadow-md hover:border-blue-300 hover:bg-blue-50' 
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{sale.order_number}</span>
                            {onOrderClick && (
                              <ExternalLink className="w-3 h-3 text-blue-600 flex-shrink-0" />
                            )}
                            {sale.customer_name && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <User className="w-3 h-3" />
                                {sale.customer_name}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">{sale.product_type}</span>
                            {sale.quantity_delivered > 0 && (
                              <span className="ml-2">
                                - {sale.quantity_delivered} {sale.unit} delivered
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                            <IndianRupee className="w-4 h-4" />
                            ₹{sale.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Order: {new Date(sale.order_date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          Delivered: {new Date(sale.delivery_date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-xs">
                          ₹{sale.unit_price.toFixed(2)}/{sale.unit}
                        </div>
                      </div>
                      {sale.delivery_notes && (
                        <p className="mt-2 text-xs text-gray-600 italic">{sale.delivery_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
