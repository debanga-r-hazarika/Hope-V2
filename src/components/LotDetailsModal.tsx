import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit, AlertCircle, Package, Loader2, MoreVertical, Trash2, ArrowRightLeft, Image as ImageIcon, RefreshCw, ChevronDown } from 'lucide-react';
import type { RawMaterial, RecurringProduct, WasteRecord, TransferRecord, StockMovement } from '../types/operations';
import type { RawMaterialTag } from '../types/tags';
import { isMultiStageRawMaterialTag } from '../lib/tags';
import type { RawMaterialUnit } from '../types/units';
import {
  fetchRawMaterialBatchUsage,
  fetchRecurringProductBatchUsage,
  fetchWasteRecordsForLot,
  fetchTransferRecordsForLot,
  calculateStockBalance,
  updateRawMaterialUsabilityStatus,
  fetchTransformationMovementsForLot,
  fetchUserFullNameByAuthUserId,
} from '../lib/operations';
import type { RawMaterialLifecycleConfig } from '../types/raw-material-lifecycle';
import type { TransformationRuleWithTarget } from '../types/transformation-rules';
import {
  fetchRawMaterialLifecycleConfigByTagId,
  isStageUsable,
} from '../lib/raw-material-lifecycles';
import { WasteFormModal } from './WasteFormModal';
import { TransferFormModal } from './TransferFormModal';
import { TransformToBananaPeelModal } from './TransformToBananaPeelModal';
import { useAuth } from '../contexts/AuthContext';

function getUsabilityStatusDisplayLabel(status: string | null | undefined): string {
  if (!status) return '';
  if (status === 'NOT_USABLE') return 'Full Raw';
  if (status === 'IN_RIPENING') return 'In Ripening';
  if (['READY_FOR_PROCESSING', 'READY_FOR_PRODUCTION', 'PROCESSED'].includes(status)) return 'Ready for Production';
  return status;
}

interface LotDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  lot: RawMaterial | RecurringProduct | null;
  type: 'raw-material' | 'recurring-product';
  isLocked: boolean;
  batchIds: string[];
  canEdit: boolean;
  onRefresh?: () => void;
  rawMaterialTags?: RawMaterialTag[];
  rawMaterialUnits?: RawMaterialUnit[];
  onGoToLot?: (lotId: string) => void;
  onTransformSuccess?: (newLot: RawMaterial) => void;
  transformationRulesBySourceTagId?: Record<string, TransformationRuleWithTarget[]>;
  transformationUsers?: Array<{ id: string; full_name: string; email: string }>;
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
  onDelete,
  lot,
  type,
  isLocked,
  batchIds,
  canEdit,
  onRefresh,
  rawMaterialTags = [],
  rawMaterialUnits = [],
  onGoToLot,
  onTransformSuccess,
  transformationRulesBySourceTagId = {},
  transformationUsers = [],
}: LotDetailsModalProps) {
  const { user } = useAuth();
  const [batchUsage, setBatchUsage] = useState<BatchUsage[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [loadingWaste, setLoadingWaste] = useState(false);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTransformModal, setShowTransformModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [updatingUsability, setUpdatingUsability] = useState(false);
  const [currentUsabilityStatus, setCurrentUsabilityStatus] = useState<string | null>(null);
  const [showUsabilityDropdown, setShowUsabilityDropdown] = useState(false);
  const [lifecycleConfig, setLifecycleConfig] = useState<RawMaterialLifecycleConfig | null>(null);
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);
  const [transformationMovements, setTransformationMovements] = useState<StockMovement[]>([]);
  const [loadingTransformation, setLoadingTransformation] = useState(false);
  const [transformedMeta, setTransformedMeta] = useState<{ date: string | null; by: string | null }>({
    date: null,
    by: null,
  });

  useEffect(() => {
    if (lot && type === 'raw-material') {
      setCurrentUsabilityStatus((lot as RawMaterial).usability_status ?? null);
    }
  }, [lot, type]);

  useEffect(() => {
    if (!isOpen) setShowUsabilityDropdown(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !lot || type !== 'raw-material') return;
    const material = lot as RawMaterial;
    const tagId = material.raw_material_tag_id || material.raw_material_tag_ids?.[0];
    if (!tagId) {
      setLifecycleConfig(null);
      return;
    }
    setLoadingLifecycle(true);
    fetchRawMaterialLifecycleConfigByTagId(tagId)
      .then((cfg) => setLifecycleConfig(cfg))
      .catch(() => setLifecycleConfig(null))
      .finally(() => setLoadingLifecycle(false));
  }, [isOpen, lot, type]);

  useEffect(() => {
    if (isOpen && lot) {
      setLoadingUsage(true);
      setLoadingWaste(true);
      setLoadingTransfer(true);
      if (type === 'raw-material') setLoadingTransformation(true);
      const fetchData = async () => {
        try {
          const promises: [Promise<BatchUsage[]>, Promise<WasteRecord[]>, Promise<TransferRecord[]>] = [
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
          ];
          if (type === 'raw-material') {
            const [batchUsageData, wasteData, transferData, transData] = await Promise.all([
              ...promises,
              fetchTransformationMovementsForLot(lot.id),
            ]);
            setBatchUsage(batchUsageData);
            setWasteRecords(wasteData);
            setTransferRecords(transferData);
            setTransformationMovements(transData);
            const material = lot as RawMaterial;
            if (material.transformed_from_lot_id) {
              const inMovement = transData.find((m) => m.movement_type === 'IN');
              const byName = inMovement?.created_by ? await fetchUserFullNameByAuthUserId(inMovement.created_by) : null;
              setTransformedMeta({
                date: inMovement?.effective_date ?? null,
                by: byName ?? null,
              });
            } else {
              setTransformedMeta({ date: null, by: null });
            }
          } else {
            const [batchUsageData, wasteData, transferData] = await Promise.all(promises);
            setBatchUsage(batchUsageData);
            setWasteRecords(wasteData);
            setTransferRecords(transferData);
          }
        } catch (error) {
          console.error('Failed to fetch history:', error);
          setBatchUsage([]);
          setWasteRecords([]);
          setTransferRecords([]);
          if (type === 'raw-material') setTransformationMovements([]);
        } finally {
          setLoadingUsage(false);
          setLoadingWaste(false);
          setLoadingTransfer(false);
          if (type === 'raw-material') setLoadingTransformation(false);
        }
      };
      void fetchData();
    } else {
      setBatchUsage([]);
      setWasteRecords([]);
      setTransferRecords([]);
      setTransformationMovements([]);
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
          className="fixed inset-0 transition-opacity bg-gray-500/75 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl border border-gray-100 transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {isRawMaterial ? 'Raw Material' : 'Recurring Product'} Details
              </h3>
              <div className="flex items-center gap-2">
                {/* 3-dot menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {showMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
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
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                <p className="text-sm text-gray-900 font-medium">{lot.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Lot ID</label>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-900 font-mono">{lot.lot_id}</p>
                  {isRawMaterial && (material as RawMaterial).transformed_from_lot_id && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      Transformed
                    </span>
                  )}
                </div>
              </div>

              {isRawMaterial && (
                <>
                  {(() => {
                    const material = lot as RawMaterial;
                    const tagId = material.raw_material_tag_id || material.raw_material_tag_ids?.[0];
                    const tag = rawMaterialTags.find((t) => t.id === tagId);
                    const isMulti = isMultiStageRawMaterialTag(tag);
                    return isMulti ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Lifecycle</label>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Multi-stage
                        </span>
                      </div>
                    ) : null;
                  })()}

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
                <p className={`text-sm font-bold ${lot.quantity_available === 0 ? 'text-red-600' : 'text-green-700'
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

              {isRawMaterial && (material as RawMaterial).transformed_from_lot_id && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Transformed Date</label>
                    <p className="text-sm text-gray-900">{transformedMeta.date || lot.received_date || '—'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Transformed By</label>
                    <p className="text-sm text-gray-900">
                      {transformedMeta.by || material.created_by_name || lot.created_by_name || '—'}
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Collected by</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Last Edited By</label>
                {lot.updated_by_name ? (
                  <div className="flex flex-col">
                    <p className="text-sm text-gray-900 font-medium">{lot.updated_by_name}</p>
                    <p className="text-xs text-gray-500">{new Date(lot.updated_at).toLocaleString()}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>

              {isRawMaterial && (() => {
                const tagId = (material as RawMaterial).raw_material_tag_id || (material as RawMaterial).raw_material_tag_ids?.[0];
                const tag = rawMaterialTags?.find((t) => t.id === tagId);
                const isMultiStageTag = isMultiStageRawMaterialTag(tag);
                return (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Usability Status</label>
                  {canEdit && !isLocked && isMultiStageTag && lifecycleConfig?.stages?.length && !(material as RawMaterial).transformed_from_lot_id && material.usable !== true ? (
                    <div className="space-y-1">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowUsabilityDropdown((open) => !open)}
                          disabled={updatingUsability}
                          className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:ring-2 focus:ring-blue-500 flex items-center justify-between bg-white text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="truncate">
                              {(() => {
                                const currentKey = currentUsabilityStatus === 'READY_FOR_PROCESSING' || currentUsabilityStatus === 'PROCESSED'
                                  ? 'READY_FOR_PRODUCTION'
                                  : currentUsabilityStatus;
                                const stage = lifecycleConfig.stages.find((s) => s.stage_key === currentKey);
                                return stage?.stage_label ?? currentKey ?? '—';
                              })()}
                            </span>
                            {(() => {
                              const currentKey = currentUsabilityStatus === 'READY_FOR_PROCESSING' || currentUsabilityStatus === 'PROCESSED'
                                ? 'READY_FOR_PRODUCTION'
                                : currentUsabilityStatus;
                              const stage = lifecycleConfig.stages.find((s) => s.stage_key === currentKey);
                              return stage ? (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                                    stage.makes_usable ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {stage.makes_usable ? 'Usable' : 'Not Usable'}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
                        </button>
                        {showUsabilityDropdown && (
                          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-auto">
                            {lifecycleConfig.stages.slice().sort((a, b) => a.stage_order - b.stage_order).map((s) => {
                              const currentKey = currentUsabilityStatus === 'READY_FOR_PROCESSING' || currentUsabilityStatus === 'PROCESSED'
                                ? 'READY_FOR_PRODUCTION'
                                : currentUsabilityStatus;
                              const isSelected = s.stage_key === currentKey;
                              return (
                                <button
                                  key={s.stage_key}
                                  type="button"
                                  onClick={async () => {
                                    if (!lot) return;
                                    setShowUsabilityDropdown(false);
                                    setUpdatingUsability(true);
                                    try {
                                      await updateRawMaterialUsabilityStatus(lot.id, s.stage_key, user?.id);
                                      setCurrentUsabilityStatus(s.stage_key);
                                      onRefresh?.();
                                    } finally {
                                      setUpdatingUsability(false);
                                    }
                                  }}
                                  className={`w-full px-3 py-2 flex items-center justify-between text-sm text-left ${
                                    isSelected ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <span>{s.stage_label}</span>
                                  <span
                                    className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                                      s.makes_usable ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {s.makes_usable ? 'Usable' : 'Not Usable'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {loadingLifecycle ? 'Loading lifecycle…' : lifecycleConfig.stages.slice().sort((a, b) => a.stage_order - b.stage_order).map((s) => s.stage_label).join(' → ')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${material.usability_status ? 'bg-teal-100 text-teal-800' : material.usable ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                        {material.usability_status
                          ? (lifecycleConfig?.stages?.find((s) => s.stage_key === material.usability_status)?.stage_label ?? getUsabilityStatusDisplayLabel(material.usability_status))
                          : material.usable ? 'Usable' : 'Not Usable'}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {material.usability_status === 'READY_FOR_PROCESSING' || material.usability_status === 'READY_FOR_PRODUCTION' || material.usability_status === 'PROCESSED'
                          ? 'Available for production'
                          : material.usability_status === 'IN_RIPENING'
                            ? 'Ripening'
                            : material.usable ? 'Available for production' : 'Aging/ripening/drying'}
                      </p>
                    </>
                  )}
                </div>
                );
              })()}

              {isRawMaterial && (
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{material.storage_notes?.trim() || '—'}</p>
                </div>
              )}

              {!isRawMaterial && (
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                  <p className="text-sm text-gray-900">{product.notes || '—'}</p>
                </div>
              )}

              {/* Photo Display Section - Only for Raw Materials */}
              {isRawMaterial && material.photo_urls && material.photo_urls.length > 0 && (
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Lot Photos</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {material.photo_urls.map((photoUrl, index) => (
                      <div key={index} className="relative group aspect-square">
                        <img
                          src={photoUrl}
                          alt={`Lot photo ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Photo clicked:', photoUrl);
                            setSelectedImage(photoUrl);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center pointer-events-none">
                          <ImageIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
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
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${usage.is_locked
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                    }`}>
                                    {usage.is_locked ? 'Locked' : 'Draft'}
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${usage.qa_status === 'approved'
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
            {wasteRecords.length > 0 && (
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
                ) : (
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
                )}
              </div>
            )}

            {/* Transfer History */}
            {transferRecords.length > 0 && (
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
                ) : (
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
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-semibold text-xs ${isOutgoing
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
                )}
              </div>
            )}

            {/* Transformation / Processing (Peel + Dry) — show for transformed lots and parent lots with transformation history */}
            {isRawMaterial &&
              (((material as RawMaterial).transformed_from_lot_id as string | null) ||
                loadingTransformation ||
                transformationMovements.length > 0) && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-600" />
                  Transformation / Processing
                </h4>
                {loadingTransformation ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading…</span>
                  </div>
                ) : transformationMovements.length > 0 ? (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-amber-100/80 border-b border-amber-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Quantity</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-amber-900 uppercase">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-200">
                          {transformationMovements.map((m) => (
                            <tr key={m.id} className="hover:bg-amber-100/50">
                              <td className="px-3 py-2 text-gray-700">{m.effective_date}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${m.movement_type === 'CONSUMPTION' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                  }`}>
                                  {m.movement_type === 'CONSUMPTION' ? 'Out (transformed)' : 'In (created)'}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {m.movement_type === 'CONSUMPTION' ? '-' : '+'}{typeof m.quantity === 'number' ? m.quantity : parseFloat(m.quantity as unknown as string)} {m.unit}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs">
                                {m.notes || '—'}
                                {m.movement_type === 'CONSUMPTION' && m.reference_id && onGoToLot && (
                                  <span className="ml-2">
                                    <button
                                      type="button"
                                      onClick={() => onGoToLot(m.reference_id!)}
                                      className="text-amber-700 hover:text-amber-900 font-medium underline"
                                    >
                                      View created lot
                                    </button>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="px-3 py-2 text-xs text-amber-800 bg-amber-100/50 border-t border-amber-200">
                      Ledger-based. No data overwritten. Original lot remains in history.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500">No transformation / processing records</p>
                  </div>
                )}
              </div>
            )}

            {isRawMaterial && (material as RawMaterial).transformed_from_lot_id && onGoToLot && (
              <div className="mb-6 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-amber-900">This lot was created by transforming another lot.</p>
                  <p className="text-xs text-amber-800">You can open the parent lot to see the original intake and history.</p>
                </div>
                <button
                  onClick={() => {
                    const parentId = (material as RawMaterial).transformed_from_lot_id;
                    if (parentId) {
                      onClose();
                      onGoToLot(parentId);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700"
                >
                  View parent lot
                </button>
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

            {/* Transformed lot: Edit not available */}
            {isRawMaterial && (material as RawMaterial).transformed_from_lot_id && (
              <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-600">
                  Transformed lots cannot be edited. Open the parent lot to see intake and edit there if needed.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                Close
              </button>
              {isRawMaterial && (() => {
                const sourceTagId = (material as RawMaterial).raw_material_tag_id;
                const tag = rawMaterialTags?.find((t) => t.id === sourceTagId);
                const isMultiStageTag = isMultiStageRawMaterialTag(tag);
                const allowedTargets = sourceTagId ? (transformationRulesBySourceTagId?.[sourceTagId] ?? []) : [];
                const hasBalance = (material.quantity_available ?? 0) > 0;
                const isCurrentlyUsable = material.usable === true;
                const hasAnyMakesUsableStage = (lifecycleConfig?.stages?.some((s) => s.makes_usable) ?? false);
                const effectiveStatus = currentUsabilityStatus ?? (material as RawMaterial).usability_status;
                const currentStageIsUsable = lifecycleConfig?.stages && isStageUsable(lifecycleConfig.stages, effectiveStatus);
                const showTransform = allowedTargets.length > 0 && hasBalance && rawMaterialUnits.length > 0 &&
                  (isMultiStageTag && hasAnyMakesUsableStage ? currentStageIsUsable : !isCurrentlyUsable);
                const hasTargetsButCannotTransform = allowedTargets.length > 0 && hasBalance && rawMaterialUnits.length > 0 && !showTransform;
                return (
                  <>
                    {hasTargetsButCannotTransform && hasAnyMakesUsableStage && isMultiStageTag && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 w-full text-left">
                        Change the stage above to a &quot;USABLE STAGE(Green Badge)&quot; stage to enable the Transform button. The lot stays non-usable until you transform.
                      </p>
                    )}
                    {hasTargetsButCannotTransform && !hasAnyMakesUsableStage && isMultiStageTag && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2 w-full text-left">
                        No stage is marked as &quot;Makes usable&quot;. Transform is available when the lot is not usable. To enable Transform only when a specific stage is selected, mark a stage as &quot;Makes usable&quot; in Admin → Manage lifecycle for this tag.
                      </p>
                    )}
                    {showTransform ? (
                      <button
                        type="button"
                        onClick={() => setShowTransformModal(true)}
                        className="px-4 py-2 text-sm font-medium rounded-xl flex items-center bg-amber-600 text-white hover:bg-amber-700"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Transform
                      </button>
                    ) : null}
                  </>
                );
              })()}
              {canEdit && (
                <>
                  {!(isRawMaterial && (material as RawMaterial).transformed_from_lot_id) && (
                    <button
                      onClick={() => {
                        onEdit();
                        onClose();
                      }}
                      disabled={isLocked}
                      className={`px-4 py-2 text-sm font-medium rounded-xl flex items-center ${isLocked
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onDelete();
                      onClose();
                    }}
                    disabled={isLocked}
                    className={`px-4 py-2 text-sm font-medium rounded-xl flex items-center ${isLocked
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </>
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

      {/* Transform / Process Modal */}
      {lot && type === 'raw-material' && rawMaterialUnits.length > 0 && (
        <TransformToBananaPeelModal
          isOpen={showTransformModal}
          onClose={() => setShowTransformModal(false)}
          onSuccess={(newLot) => {
            if (newLot) onTransformSuccess?.(newLot);
            handleTransferSuccess();
          }}
          sourceLot={lot as RawMaterial}
          rawMaterialUnits={rawMaterialUnits}
          rawMaterialTags={rawMaterialTags}
          allowedTargets={(() => {
            const tid = lot && type === 'raw-material' ? (lot as RawMaterial).raw_material_tag_id : undefined;
            return tid ? transformationRulesBySourceTagId[tid] : undefined;
          })()}
          users={transformationUsers}
        />
      )}

      {/* Image Preview Modal */}
      {selectedImage && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="relative max-w-6xl max-h-[95vh] w-full flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-lg z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Full size preview"
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

