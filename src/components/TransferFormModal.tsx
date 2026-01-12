import { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Loader2 } from 'lucide-react';
import type { RawMaterial, RecurringProduct } from '../types/operations';
import { transferBetweenLots, calculateStockBalance, fetchRawMaterials, fetchRecurringProducts } from '../lib/operations';
import { useAuth } from '../contexts/AuthContext';

interface TransferFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lot: RawMaterial | RecurringProduct;
  lotType: 'raw_material' | 'recurring_product';
}

export function TransferFormModal({
  isOpen,
  onClose,
  onSuccess,
  lot,
  lotType,
}: TransferFormModalProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetLotId, setTargetLotId] = useState<string>('');
  const [availableLots, setAvailableLots] = useState<(RawMaterial | RecurringProduct)[]>([]);
  const [availableQuantity, setAvailableQuantity] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWholeNumberUnit = lot.unit === 'Pieces';

  // Fetch available lots when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingLots(true);
      const fetchLots = async () => {
        try {
          const lots = lotType === 'raw_material' 
            ? await fetchRawMaterials()
            : await fetchRecurringProducts();
          
          // Filter out the current lot and only show lots with same unit
          const filtered = lots.filter(l => 
            l.id !== lot.id && 
            l.unit === lot.unit &&
            !l.is_archived
          );
          setAvailableLots(filtered);
        } catch (err) {
          console.error('Failed to fetch lots:', err);
          setError('Failed to load available lots');
        } finally {
          setLoadingLots(false);
        }
      };
      void fetchLots();
    }
  }, [isOpen, lot, lotType]);

  // Fetch available quantity when modal opens or transfer date changes
  useEffect(() => {
    if (isOpen && lot && transferDate) {
      setLoadingBalance(true);
      const fetchBalance = async () => {
        try {
          const balance = await calculateStockBalance(
            lotType,
            lot.id,
            transferDate
          );
          setAvailableQuantity(balance);
        } catch (err) {
          console.error('Failed to fetch balance:', err);
          setAvailableQuantity(lot.quantity_available);
        } finally {
          setLoadingBalance(false);
        }
      };
      void fetchBalance();
    }
  }, [isOpen, lot, lotType, transferDate]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuantity('');
      setReason('');
      setNotes('');
      setTransferDate(new Date().toISOString().split('T')[0]);
      setTargetLotId('');
      setError(null);
      setAvailableQuantity(null);
    }
  }, [isOpen]);

  const displayAvailableQuantity = (qty: number): string => {
    return isWholeNumberUnit ? Math.floor(qty).toString() : qty.toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!quantity || !reason || !targetLotId) {
      setError('Please fill in all required fields');
      return;
    }

    let quantityNum = isWholeNumberUnit 
      ? parseInt(quantity, 10)
      : parseFloat(quantity);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }

    if (!isWholeNumberUnit) {
      // Round to 2 decimal places to avoid precision issues
      quantityNum = Math.round(quantityNum * 100) / 100;
    }

    if (availableQuantity !== null && quantityNum > availableQuantity) {
      const availableDisplay = displayAvailableQuantity(availableQuantity);
      setError(`Cannot transfer ${isWholeNumberUnit ? quantityNum : quantityNum.toFixed(2)} ${lot.unit}. Only ${availableDisplay} ${lot.unit} available.`);
      return;
    }

    if (targetLotId === lot.id) {
      setError('Cannot transfer to the same lot');
      return;
    }

    setLoading(true);
    try {
      await transferBetweenLots(
        lotType,
        lot.id,
        targetLotId,
        quantityNum,
        reason,
        notes || undefined,
        transferDate,
        user?.id
      );
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to transfer:', err);
      setError(err instanceof Error ? err.message : 'Failed to transfer stock');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const stepValue = isWholeNumberUnit ? "1" : "0.01";
  const minQuantity = isWholeNumberUnit ? "1" : "0.01";
  const selectedTargetLot = availableLots.find(l => l.id === targetLotId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center border border-blue-200">
                  <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Transfer Stock</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{lot.lot_id} - {lot.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">{error}</p>
              </div>
            )}

            {/* Available quantity info */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Available Quantity (Source):</span>
                {loadingBalance ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : (
                  <span className="text-sm font-semibold text-gray-900">
                    {(() => {
                      const qty = availableQuantity !== null ? availableQuantity : lot.quantity_available;
                      return isWholeNumberUnit ? Math.floor(qty) : qty.toFixed(2);
                    })()} {lot.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Transfer Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Transfer Date <span className="text-blue-600">*</span>
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              {/* Target Lot Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Transfer To Lot <span className="text-blue-600">*</span>
                </label>
                {loadingLots ? (
                  <div className="flex items-center justify-center py-4 border border-gray-300 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                    <span className="text-sm text-gray-500">Loading lots...</span>
                  </div>
                ) : availableLots.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">No other lots available with the same unit ({lot.unit})</p>
                  </div>
                ) : (
                  <select
                    value={targetLotId}
                    onChange={(e) => setTargetLotId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  >
                    <option value="">Select target lot...</option>
                    {availableLots.map((targetLot) => (
                      <option key={targetLot.id} value={targetLot.id}>
                        {targetLot.lot_id} - {targetLot.name} (Available: {isWholeNumberUnit ? Math.floor(targetLot.quantity_available) : targetLot.quantity_available.toFixed(2)} {targetLot.unit})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Quantity to Transfer <span className="text-blue-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={stepValue}
                    min={minQuantity}
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isWholeNumberUnit) {
                        // Only allow whole numbers
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0) {
                          setQuantity(num.toString());
                        } else if (val === '') {
                          setQuantity('');
                        }
                      } else {
                        setQuantity(val);
                      }
                    }}
                    onBlur={(e) => {
                      const val = isWholeNumberUnit 
                        ? parseInt(e.target.value, 10)
                        : parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setQuantity(isWholeNumberUnit ? val.toString() : val.toFixed(2));
                      }
                    }}
                    placeholder={isWholeNumberUnit ? "0" : "0.00"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    {lot.unit}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason <span className="text-blue-600">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Adjustment, Consolidation, Reallocation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional details about the transfer..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {/* Transfer Preview */}
              {targetLotId && quantity && !isNaN(parseFloat(quantity)) && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Transfer Preview:</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">From:</span>
                      <span className="font-semibold text-blue-900">{lot.lot_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">To:</span>
                      <span className="font-semibold text-blue-900">{selectedTargetLot?.lot_id || '—'}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="text-blue-700">Quantity:</span>
                      <span className="font-bold text-blue-900">
                        {isWholeNumberUnit ? parseInt(quantity, 10) : parseFloat(quantity).toFixed(2)} {lot.unit}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-all shadow-sm ${
                    loading
                      ? 'bg-blue-300 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                  }`}
                  disabled={loading || !targetLotId || loadingLots}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Transfer Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
