import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import type { RawMaterial, RecurringProduct } from '../types/operations';
import { recordWaste, calculateStockBalance } from '../lib/operations';
import { useAuth } from '../contexts/AuthContext';

interface WasteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lot: RawMaterial | RecurringProduct;
  lotType: 'raw_material' | 'recurring_product';
}

export function WasteFormModal({
  isOpen,
  onClose,
  onSuccess,
  lot,
  lotType,
}: WasteFormModalProps) {
  const { user } = useAuth(); // user.id is the auth.users.id
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [wasteDate, setWasteDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableQuantity, setAvailableQuantity] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Fetch available quantity when modal opens or waste date changes
  useEffect(() => {
    if (isOpen && lot && wasteDate) {
      setLoadingBalance(true);
      const fetchBalance = async () => {
        try {
          // Always calculate balance from stock movements for accuracy
          const balance = await calculateStockBalance(
            lotType,
            lot.id,
            wasteDate
          );
          setAvailableQuantity(balance);
        } catch (err) {
          console.error('Failed to fetch balance:', err);
          // Fallback to lot's quantity_available if calculation fails
          setAvailableQuantity(lot.quantity_available);
        } finally {
          setLoadingBalance(false);
        }
      };
      void fetchBalance();
    } else if (isOpen && lot) {
      // If no date yet, use lot's available quantity
      setAvailableQuantity(lot.quantity_available);
    }
  }, [isOpen, lot, lotType, wasteDate]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuantity('');
      setReason('');
      setNotes('');
      setWasteDate(new Date().toISOString().split('T')[0]);
      setError(null);
      setAvailableQuantity(null);
    }
  }, [isOpen]);

  // Determine if unit requires whole numbers (Pieces) or allows decimals
  const isWholeNumberUnit = lot.unit === 'Pieces';
  const displayAvailableQuantity = (qty: number) => {
    return isWholeNumberUnit ? Math.floor(qty).toString() : qty.toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!quantity || !reason) {
      setError('Please fill in all required fields');
      return;
    }

    // Parse quantity - use whole numbers for Pieces, decimals for others
    let quantityNum: number;
    if (isWholeNumberUnit) {
      // For Pieces, parse as integer
      quantityNum = parseInt(quantity, 10);
      if (isNaN(quantityNum) || quantityNum <= 0 || quantityNum !== parseFloat(quantity)) {
        setError('Please enter a whole number greater than 0');
        return;
      }
    } else {
      // For other units, allow decimals
      quantityNum = parseFloat(quantity);
      if (isNaN(quantityNum) || quantityNum <= 0) {
        setError('Please enter a valid quantity greater than 0');
        return;
      }
      // Round to 2 decimal places to avoid precision issues
      quantityNum = Math.round(quantityNum * 100) / 100;
    }

    if (availableQuantity !== null && quantityNum > availableQuantity) {
      const availableDisplay = displayAvailableQuantity(availableQuantity);
      setError(`Cannot waste ${isWholeNumberUnit ? quantityNum : quantityNum.toFixed(2)} ${lot.unit}. Only ${availableDisplay} ${lot.unit} available.`);
      return;
    }

    setLoading(true);
    try {
      await recordWaste(
        lotType,
        lot.id,
        quantityNum,
        reason,
        notes || undefined,
        wasteDate,
        user?.id
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record waste');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center border border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Record Waste</h3>
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
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium">{error}</p>
              </div>
            )}

            {/* Available quantity info */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Available Quantity:</span>
                {loadingBalance ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : (
                  <span className="text-sm font-semibold text-gray-900">
                    {(() => {
                      const qty = availableQuantity !== null ? availableQuantity : lot.quantity_available;
                      const isWholeNumberUnit = lot.unit === 'Pieces';
                      return isWholeNumberUnit ? Math.floor(qty) : qty.toFixed(2);
                    })()} {lot.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Waste Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Waste Date <span className="text-amber-600">*</span>
                </label>
                <input
                  type="date"
                  value={wasteDate}
                  onChange={(e) => setWasteDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                  required
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Quantity Wasted <span className="text-amber-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={lot.unit === 'Pieces' ? '1' : '0.01'}
                    min={lot.unit === 'Pieces' ? '1' : '0.01'}
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      // For Pieces, only allow whole numbers
                      if (lot.unit === 'Pieces') {
                        // Remove any decimal point and after
                        const wholeNumber = val.split('.')[0];
                        setQuantity(wholeNumber);
                      } else {
                        setQuantity(val);
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure value is properly formatted on blur
                      const val = e.target.value;
                      if (val && !isNaN(parseFloat(val))) {
                        if (lot.unit === 'Pieces') {
                          const wholeNum = parseInt(val, 10);
                          if (!isNaN(wholeNum) && wholeNum > 0) {
                            setQuantity(wholeNum.toString());
                          }
                        } else {
                          const decimalNum = parseFloat(val);
                          if (!isNaN(decimalNum) && decimalNum > 0) {
                            // Round to 2 decimal places
                            const rounded = Math.round(decimalNum * 100) / 100;
                            setQuantity(rounded.toString());
                          }
                        }
                      }
                    }}
                    placeholder={lot.unit === 'Pieces' ? '0' : '0.00'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                  Reason <span className="text-amber-600">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Expired, Damaged, Spoiled"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                  placeholder="Additional details about the waste..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || loadingBalance}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    'Record Waste'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
