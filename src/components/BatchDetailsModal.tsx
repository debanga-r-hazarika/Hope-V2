import { X, Edit, AlertCircle, Package, CheckCircle, RefreshCw } from 'lucide-react';
import type { ProductionBatch, BatchRawMaterial, BatchRecurringProduct } from '../types/operations';

interface BatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  batch: ProductionBatch | null;
  rawMaterials: BatchRawMaterial[];
  recurringProducts: BatchRecurringProduct[];
  canEdit: boolean;
  onMoveToProcessedGoods?: (batchId: string) => Promise<void>;
  processedGoodsExists?: boolean;
  movingToProcessed?: boolean;
}

export function BatchDetailsModal({
  isOpen,
  onClose,
  onEdit,
  batch,
  rawMaterials,
  recurringProducts,
  canEdit,
  onMoveToProcessedGoods,
  processedGoodsExists = false,
  movingToProcessed = false,
}: BatchDetailsModalProps) {
  if (!isOpen || !batch) return null;

  const isLocked = batch.is_locked;
  const hasOutputData = !!(batch.output_product_type && batch.output_quantity && batch.output_unit);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Production Batch Details</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Batch Information */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Batch ID</label>
                <p className="text-sm text-gray-900 font-mono">{batch.batch_id}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Batch Date</label>
                <p className="text-sm text-gray-900">{batch.batch_date}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Responsible User</label>
                <p className="text-sm text-gray-900">{batch.responsible_user_name || '—'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                <span className={`px-2 py-1 rounded text-xs ${
                  batch.is_locked ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {batch.is_locked ? 'Locked' : 'Draft'}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Product Type</label>
                <p className="text-sm text-gray-900">{batch.output_product_type || '—'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Output Quantity</label>
                <p className="text-sm text-gray-900">
                  {batch.output_quantity ? `${batch.output_quantity} ${batch.output_unit || ''}` : '—'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">QA Status</label>
                <span className={`px-2 py-1 rounded text-xs ${
                  batch.qa_status === 'approved' ? 'bg-green-100 text-green-800' :
                  batch.qa_status === 'rejected' ? 'bg-red-100 text-red-800' :
                  batch.qa_status === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {batch.qa_status || 'pending'}
                </span>
              </div>

              {isLocked && processedGoodsExists && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Processed Goods</label>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-700">This batch has been moved to Processed Goods</p>
                  </div>
                </div>
              )}

              {batch.notes && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                  <p className="text-sm text-gray-900">{batch.notes}</p>
                </div>
              )}

              {batch.production_start_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Production Start Date</label>
                  <p className="text-sm text-gray-900">{batch.production_start_date}</p>
                </div>
              )}

              {batch.production_end_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Production End Date</label>
                  <p className="text-sm text-gray-900">{batch.production_end_date}</p>
                </div>
              )}

              {batch.qa_reason && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">QA Reason</label>
                  <p className="text-sm text-gray-900">{batch.qa_reason}</p>
                </div>
              )}

              {batch.additional_information && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Additional Information</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{batch.additional_information}</p>
                </div>
              )}
            </div>

            {/* Custom Fields */}
            {batch.custom_fields && (() => {
              try {
                const customFields = typeof batch.custom_fields === 'string' 
                  ? JSON.parse(batch.custom_fields) 
                  : batch.custom_fields;
                
                if (Array.isArray(customFields) && customFields.length > 0) {
                  return (
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Custom Fields</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="space-y-2">
                          {customFields.map((field: { key: string; value: string }, index: number) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{field.key}</p>
                              </div>
                              <p className="text-sm text-gray-700">{field.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
              } catch (e) {
                // Invalid JSON, skip
              }
              return null;
            })()}

            {/* Raw Materials Used */}
            {rawMaterials.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-blue-600" />
                  Raw Materials Used
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    {rawMaterials.map((material) => (
                      <div key={material.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{material.raw_material_name}</p>
                          <p className="text-xs text-gray-500">
                            Lot: <span className="font-mono">{material.lot_id}</span>
                          </p>
                        </div>
                        <p className="text-sm text-gray-700">
                          {material.quantity_consumed} {material.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recurring Products Used */}
            {recurringProducts.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-green-600" />
                  Packaging Materials Used
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    {recurringProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.recurring_product_name}</p>
                        </div>
                        <p className="text-sm text-gray-700">
                          {product.quantity_consumed} {product.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Lock Status Warning */}
            {isLocked && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 mb-1">
                      Batch is Locked
                    </h4>
                    <p className="text-sm text-yellow-700">
                      This batch has been completed and locked. You can move it to Processed Goods if needed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Move to Processed Goods Section */}
            {isLocked && canEdit && onMoveToProcessedGoods && hasOutputData && !processedGoodsExists && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-800 mb-1">
                      Move to Processed Goods
                    </h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Create a processed goods entry from this batch. This will make the product available in inventory.
                    </p>
                    <button
                      onClick={() => void onMoveToProcessedGoods(batch.id)}
                      disabled={movingToProcessed}
                      className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {movingToProcessed ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Moving...
                        </>
                      ) : (
                        <>
                          <Package className="w-4 h-4" />
                          Move to Processed Goods
                        </>
                      )}
                    </button>
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
              {canEdit && !isLocked && (
                <button
                  onClick={() => {
                    onEdit();
                    onClose();
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-md flex items-center bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Batch
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

