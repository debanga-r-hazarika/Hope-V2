import { useEffect, useState } from 'react';
import { X, PartyPopper, CheckCircle2, Sparkles, Trophy } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  totalAmount: number;
}

export function CelebrationModal({ isOpen, onClose, orderNumber, totalAmount }: CelebrationModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Auto-close after 8 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setShowConfetti(false);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal Content */}
      <div className="relative z-10 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-3xl shadow-2xl p-8 sm:p-12 max-w-lg w-full mx-4 animate-in zoom-in-95 duration-500">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-2 hover:bg-white/20 rounded-full"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Celebration Content */}
        <div className="text-center space-y-6">
          {/* Trophy and Stars Section */}
          <div className="relative flex items-center justify-center mb-4">
            {/* Left Star */}
            <Sparkles className="w-8 h-8 text-white absolute left-1/4 animate-pulse" />
            {/* Trophy - Centered */}
            <div className="relative animate-bounce">
              <Trophy className="w-20 h-20 sm:w-24 sm:h-24 text-yellow-300 drop-shadow-lg" />
            </div>
            {/* Right Star */}
            <Sparkles className="w-8 h-8 text-white absolute right-1/4 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>

          {/* Title with Confetti */}
          <div className="space-y-3">
            <div className="relative flex items-center justify-center gap-3">
              {/* Left Confetti */}
              <PartyPopper className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-300 animate-bounce" style={{ animationDelay: '0.2s' }} />
              {/* Title */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg animate-in slide-in-from-bottom-4 duration-700">
                Order Completed!
              </h2>
              {/* Right Confetti */}
              <PartyPopper className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-300 animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
            {/* Congratulations */}
            <div className="flex items-center justify-center gap-2 text-white/90">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
              <p className="text-base sm:text-lg font-semibold">Congratulations!</p>
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-white/20 backdrop-blur-md rounded-2xl p-5 sm:p-6 space-y-4 animate-in fade-in duration-1000 delay-300">
            <div className="text-center">
              <p className="text-white/80 text-xs sm:text-sm font-medium uppercase tracking-wide mb-1.5">Order Number</p>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono">{orderNumber}</p>
            </div>
            <div className="border-t border-white/30 pt-4 text-center">
              <p className="text-white/80 text-xs sm:text-sm font-medium uppercase tracking-wide mb-1.5">Total Value</p>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-2 animate-in fade-in duration-1000 delay-500">
            <p className="text-white text-base sm:text-lg font-semibold">
              ✨ All items delivered & payment received! ✨
            </p>
            <p className="text-white/90 text-xs sm:text-sm">
              This order has been successfully completed and marked as closed.
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={onClose}
            className="w-full bg-white text-purple-600 font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg animate-in slide-in-from-bottom-4 duration-700 delay-700 text-sm sm:text-base"
          >
            Awesome! Let's Continue 🚀
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-slow-reverse {
          animation: spin-slow-reverse 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
