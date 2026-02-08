import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import type { ProcessedGood } from '../types/operations';
import { recordProcessedGoodWaste } from '../lib/operations';
import { useAuth } from '../contexts/AuthContext';

interface ProcessedGoodWasteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  processedGood: ProcessedGood | null;
}

export function ProcessedGoodWasteFormModal({
  isOpen,
  onClose,
  onSuccess,
  processedGood,
}: ProcessedGoodWasteFormModalProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [wasteType, setWasteType] = useState<'recycle' | 'full_waste'>('full_waste');
  const [wasteDate, setWasteDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuantity('');
      setReason('');
      setNotes('');
      setWasteType('full_waste');
      setWasteDate(new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [isOpen]);

  if (!processedGood) return null;

  const isWholeNumberUnit = processedGood.unit === 'Pieces' || processedGood.unit?.toLowerCase() === 'bottles';
  const availableQty = Math.max(0, processedGood.actual_available ?? processedGood.quantity_available ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!quantity || !reason) {
      setError('Please fill in quantity and reason');
      return;
    }
    const quantityNum = isWholeNumberUnit ? parseInt(quantity, 10) : parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }
    if (quantityNum > availableQty) {
      setError(`Cannot waste ${quantityNum} ${processedGood.unit}. Only ${availableQty} ${processedGood.unit} available.`);
      return;
    }
    setLoading(true);
    try {
      await recordProcessedGoodWaste(
        processedGood.id,
        quantityNum,
        reason,
        wasteType,
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
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500/75 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-100">
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Record Waste / Damage</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{processedGood.batch_reference} · {processedGood.product_type}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            {error && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
                {error}
              </div>
            )}

            <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Available quantity</span>
                <span className="text-sm font-bold text-gray-900">
                  {isWholeNumberUnit ? Math.floor(availableQty) : availableQty.toFixed(2)} {processedGood.unit}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Waste date <span className="text-amber-600">*</span></label>
                <input
                  type="date"
                  value={wasteDate}
                  onChange={(e) => setWasteDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity wasted <span className="text-amber-600">*</span></label>
                <div className="relative">
                  <input
                    type="number"
                    step={isWholeNumberUnit ? '1' : '0.01'}
                    min={isWholeNumberUnit ? '1' : '0.01'}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={isWholeNumberUnit ? '0' : '0.00'}
                    className="w-full px-3 py-2.5 pr-16 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{processedGood.unit}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="text-amber-600">*</span></label>
                <div className="flex gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 border-gray-200">
                    <input
                      type="radio"
                      name="wasteType"
                      value="full_waste"
                      checked={wasteType === 'full_waste'}
                      onChange={() => setWasteType('full_waste')}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-gray-700">Full waste</span>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 border-gray-200">
                    <input
                      type="radio"
                      name="wasteType"
                      value="recycle"
                      checked={wasteType === 'recycle'}
                      onChange={() => setWasteType('recycle')}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-gray-700">Recycle</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason <span className="text-amber-600">*</span></label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Expired, Damaged, Not sold"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional details..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording...</> : 'Record waste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
