import { X, Package, Calendar, CheckCircle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import type { ProcessedGood } from '../types/operations';

interface ProcessedGoodDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  processedGood: ProcessedGood | null;
  onBatchReferenceClick?: (batchId: string | undefined) => void;
}

export function ProcessedGoodDetailsModal({
  isOpen,
  onClose,
  processedGood,
  onBatchReferenceClick,
}: ProcessedGoodDetailsModalProps) {
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
                    processedGood.quantity_available === 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {processedGood.quantity_available} {processedGood.unit}
                  </p>
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
