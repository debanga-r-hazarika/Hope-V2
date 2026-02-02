import { X, Info } from 'lucide-react';
import { ModernButton } from './ModernButton';

interface InfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning';
}

export function InfoDialog({ isOpen, onClose, title, message, type = 'info' }: InfoDialogProps) {
  if (!isOpen) return null;

  const colors = {
    info: 'bg-blue-50 border-blue-100 text-blue-600',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    warning: 'bg-amber-50 border-amber-100 text-amber-600',
  };

  const iconColors = {
    info: 'text-blue-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-premium-lg transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-gray-100">
          <div className="bg-white px-6 pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full border ${colors[type]}`}>
                <Info className={`h-6 w-6 ${iconColors[type]}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="bg-gray-50/50 px-6 py-4 flex justify-end border-t border-gray-100">
            <ModernButton
              onClick={onClose}
              variant="primary"
              size="sm"
            >
              Got it
            </ModernButton>
          </div>
        </div>
      </div>
    </div>
  );
}
