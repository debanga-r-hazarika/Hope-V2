import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface QuantityInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (quantity: number) => void;
  title: string;
  itemName: string;
  maxQuantity: number;
  unit: string;
  lotId?: string;
}

export function QuantityInputModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  itemName,
  maxQuantity,
  unit,
  lotId,
}: QuantityInputModalProps) {
  const [quantity, setQuantity] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);

    if (!quantity || isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    if (qty > maxQuantity) {
      setError(`Quantity cannot exceed available amount (${maxQuantity} ${unit})`);
      return;
    }

    onSubmit(qty);
    onClose();
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item
                </label>
                <p className="text-sm text-gray-900 font-medium">{itemName}</p>
                {lotId && (
                  <p className="text-xs text-gray-500 mt-1">Lot ID: {lotId}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Quantity
                </label>
                <p className="text-sm text-gray-600">
                  {maxQuantity} {unit}
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity to Consume *
                </label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setError(null);
                  }}
                  min="0"
                  max={maxQuantity}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Enter quantity (max: ${maxQuantity} ${unit})`}
                  autoFocus
                />
                {error && (
                  <p className="mt-1 text-sm text-red-600">{error}</p>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Add to Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


