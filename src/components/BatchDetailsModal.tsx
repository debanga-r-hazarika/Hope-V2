import { X, Edit, AlertCircle, Package, CheckCircle, Trash2 } from 'lucide-react';
import type { ProductionBatch, BatchRawMaterial, BatchRecurringProduct, BatchOutput } from '../types/operations';

interface BatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: (batchId: string) => void;
  batch: ProductionBatch | null;
  rawMaterials: BatchRawMaterial[];
  recurringProducts: BatchRecurringProduct[];
  batchOutputs: BatchOutput[];
  canEdit: boolean;
  onMoveToProcessedGoods?: (batchId: string) => void;
  processedGoodsExists?: boolean;
  movingToProcessed?: boolean;
}

export function BatchDetailsModal({
  isOpen,
  onClose,
  onEdit,
  onDelete,
  batch,
  rawMaterials,
  recurringProducts,
  batchOutputs,
  canEdit,
  onMoveToProcessedGoods,
  processedGoodsExists,
  movingToProcessed,
}: BatchDetailsModalProps) {
  if (!isOpen || !batch) return null;

  const isLocked = batch.is_locked;
  
  // Parse custom fields if they exist
  let customFields: Array<{key: string, value: string}> = [];
  if (batch.custom_fields) {
    try {
      if (typeof batch.custom_fields === 'string') {
        customFields = JSON.parse(batch.custom_fields);
      } else if (Array.isArray(batch.custom_fields)) {
        customFields = batch.custom_fields;
      }
    } catch (e) {
      console.error('Failed to parse custom_fields:', e);
    }
  }

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

              {batch.notes && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                  <p className="text-sm text-gray-900">{batch.notes}</p>
                </div>
              )}

              {batch.additional_information && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Additional Information</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{batch.additional_information}</p>
                </div>
              )}

              {customFields.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Custom Fields</label>
                  <div className="grid grid-cols-2 gap-2">
                    {customFields.map((field, index) => (
                      <div key={index} className="bg-gray-50 rounded p-2">
                        <span className="text-xs font-medium text-gray-600">{field.key}:</span>
                        <span className="text-xs text-gray-900 ml-1">{field.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

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

            {/* Batch Outputs */}
            {batchOutputs.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-purple-600" />
                  Batch Outputs ({batchOutputs.length})
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-4">
                    {batchOutputs.map((output, index) => (
                      <div key={output.id} className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-900">Output {index + 1}: {output.output_name}</h5>
                          {output.produced_goods_tag_name && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                              {output.produced_goods_tag_name}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {output.output_size && output.output_size_unit && (
                            <div>
                              <span className="text-gray-500">Size:</span>
                              <span className="ml-2 text-gray-900 font-medium">
                                {output.output_size} {output.output_size_unit}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">Produced Quantity:</span>
                            <span className="ml-2 text-gray-900 font-medium">
                              {output.produced_quantity} {output.produced_unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Legacy single output display (for backward compatibility) */}
            {batchOutputs.length === 0 && batch.output_product_type && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-purple-600" />
                  Batch Output
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Product Type:</span>
                      <span className="ml-2 text-gray-900 font-medium">{batch.output_product_type}</span>
                    </div>
                    {batch.output_quantity && (
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <span className="ml-2 text-gray-900 font-medium">
                          {batch.output_quantity} {batch.output_unit || ''}
                        </span>
                      </div>
                    )}
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
                      This batch has been completed and locked. No modifications can be made.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              {canEdit && !isLocked && onDelete && (
                <button
                  onClick={() => onDelete(batch.id)}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Batch
                </button>
              )}
              <div className="flex space-x-3 ml-auto">
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
    </div>
  );
}

