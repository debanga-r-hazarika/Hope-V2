import { useEffect, useState } from 'react';
import { Clock, Lock, AlertCircle } from 'lucide-react';

interface OrderLockTimerProps {
  completedAt: string;
  isLocked: boolean;
  onLockCheck?: () => void;
}

export function OrderLockTimer({ completedAt, isLocked, onLockCheck }: OrderLockTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!completedAt || isLocked) {
      setTimeRemaining(null);
      setIsExpired(isLocked);
      return;
    }

    const calculateTimeRemaining = () => {
      const completed = new Date(completedAt).getTime();
      const now = new Date().getTime();
      const fortyEightHours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
      const elapsed = now - completed;
      const remaining = fortyEightHours - elapsed;

      if (remaining <= 0) {
        setIsExpired(true);
        setTimeRemaining(0);
        // Call onLockCheck to trigger auto-lock if not already locked
        if (onLockCheck && !isLocked) {
          onLockCheck();
        }
      } else {
        setIsExpired(false);
        setTimeRemaining(remaining);
      }
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [completedAt, isLocked, onLockCheck]);

  if (!completedAt) {
    // If no completed_at, show a message that timer will start from next completion
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-blue-500 rounded-full p-3 flex-shrink-0">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-blue-900 mb-1 text-lg sm:text-xl">
              ⏱️ Order Completed
            </h3>
            <p className="text-sm sm:text-base text-blue-800 leading-relaxed font-medium">
              This order is completed. The 48-hour editing window timer will be active for future completed orders.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLocked || isExpired) {
    return (
      <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-5 sm:p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-red-500 rounded-full p-3 flex-shrink-0 animate-pulse">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900 mb-1 text-lg sm:text-xl">
              🔒 Order Locked
            </h3>
            <p className="text-sm sm:text-base text-red-800 leading-relaxed font-medium">
              This order has been automatically locked after 48 hours of completion.
              It can no longer be edited to maintain data integrity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (timeRemaining === null) {
    return null;
  }

  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');

  // Calculate percentage remaining (for progress bar)
  const percentageRemaining = (timeRemaining / (48 * 60 * 60 * 1000)) * 100;

  // Determine color based on time remaining
  const isWarning = timeRemaining < (12 * 60 * 60 * 1000); // Less than 12 hours
  const isCritical = timeRemaining < (6 * 60 * 60 * 1000); // Less than 6 hours

  return (
    <div className={`border-2 rounded-xl p-5 sm:p-6 shadow-lg ${
      isCritical 
        ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300' 
        : isWarning 
        ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300' 
        : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300'
    }`}>
      <div className="flex items-start gap-4 mb-5">
        <div className={`rounded-full p-3 flex-shrink-0 ${
          isCritical 
            ? 'bg-red-500 animate-pulse' 
            : isWarning 
            ? 'bg-amber-500' 
            : 'bg-blue-500'
        }`}>
          <Clock className={`w-6 h-6 text-white`} />
        </div>
        <div className="flex-1">
          <h3 className={`font-bold mb-2 text-lg sm:text-xl ${
            isCritical 
              ? 'text-red-900' 
              : isWarning 
              ? 'text-amber-900' 
              : 'text-blue-900'
          }`}>
            {isCritical 
              ? '⏰ Order Will Lock Soon!' 
              : isWarning 
              ? '⏳ Editing Window Closing Soon' 
              : '⏱️ Order Editing Window Active'}
          </h3>
          <p className={`text-sm sm:text-base leading-relaxed font-medium ${
            isCritical 
              ? 'text-red-800' 
              : isWarning 
              ? 'text-amber-800' 
              : 'text-blue-800'
          }`}>
            {isCritical
              ? 'This order will be automatically locked in less than 6 hours. Make any final edits now.'
              : isWarning
              ? 'This order will be automatically locked after 48 hours of completion. You have less than 12 hours remaining.'
              : 'This order will be automatically locked after 48 hours of completion. Make any necessary edits before the timer expires.'}
          </p>
        </div>
      </div>

      {/* Timer Display - Large and Prominent */}
      <div className={`bg-white rounded-xl p-5 sm:p-7 border-2 ${
        isCritical 
          ? 'border-red-300 shadow-lg' 
          : isWarning 
          ? 'border-amber-300 shadow-md' 
          : 'border-blue-300 shadow-md'
      } mb-4`}>
        <div className="text-center">
          <div className={`text-4xl sm:text-5xl md:text-6xl font-mono font-bold mb-3 ${
            isCritical
              ? 'text-red-600'
              : isWarning
              ? 'text-amber-600'
              : 'text-blue-600'
          }`}>
            {hoursStr}:{minutesStr}:{secondsStr}
          </div>
          <div className={`text-sm sm:text-base font-bold ${
            isCritical
              ? 'text-red-700'
              : isWarning
              ? 'text-amber-700'
              : 'text-blue-700'
          }`}>
            {hours} {hours === 1 ? 'Hour' : 'Hours'} • {minutes} {minutes === 1 ? 'Minute' : 'Minutes'} • {seconds} {seconds === 1 ? 'Second' : 'Seconds'} Remaining
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isCritical 
                  ? 'bg-gradient-to-r from-red-500 to-red-600' 
                  : isWarning 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600' 
                  : 'bg-gradient-to-r from-blue-500 to-blue-600'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, percentageRemaining))}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs sm:text-sm font-semibold text-gray-700">
            <span>0 Hours</span>
            <span>48 Hours</span>
          </div>
        </div>
      </div>

      {/* Warning Message for Critical Time */}
      {isCritical && (
        <div className="flex items-start gap-3 bg-red-100 border-2 border-red-400 rounded-lg p-4 shadow-sm">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm sm:text-base text-red-900 font-semibold">
            <strong>⚠️ Important:</strong> Once locked, this order cannot be edited.
            Please complete any necessary changes before the timer expires.
          </p>
        </div>
      )}
    </div>
  );
}
