import { useEffect, useState } from 'react';
import { Lock, Unlock, Clock, User } from 'lucide-react';
import { lockOrder, unlockOrder, canUnlockOrder, getUnlockTimeRemaining } from '../lib/sales';

const UNLOCK_WINDOW_DAYS = 7;

interface OrderLockTimerProps {
  orderId: string;
  orderStatus: string;
  isLocked: boolean;
  lockedAt?: string;
  lockedByName?: string;
  canUnlockUntil?: string;
  currentUserId?: string;
  onLockChange: () => void;
  hasWriteAccess: boolean;
}

export function OrderLockTimer({
  orderId,
  orderStatus,
  isLocked,
  lockedAt,
  lockedByName,
  canUnlockUntil,
  currentUserId,
  onLockChange,
  hasWriteAccess,
}: OrderLockTimerProps) {
  const [locking, setLocking] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const canUnlock = canUnlockOrder({ is_locked: isLocked, can_unlock_until: canUnlockUntil });
  const isPermanentlyLocked = isLocked && !canUnlock;

  // Countdown for unlock window (only when locked and within window)
  useEffect(() => {
    if (!isLocked || !canUnlockUntil || !canUnlock) {
      setTimeRemaining(null);
      return;
    }
    const update = () => {
      const remaining = getUnlockTimeRemaining(canUnlockUntil);
      setTimeRemaining(remaining !== null && remaining > 0 ? remaining : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isLocked, canUnlockUntil, canUnlock]);

  const handleLock = async () => {
    if (!currentUserId || !hasWriteAccess) return;
    setLocking(true);
    try {
      const result = await lockOrder(orderId, { currentUserId });
      if (result.success) {
        onLockChange();
      } else {
        alert(result.error || 'Failed to lock order');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to lock order');
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!currentUserId || !unlockReason.trim()) {
      setUnlockError('Unlock reason is required');
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    try {
      const result = await unlockOrder(orderId, unlockReason.trim(), { currentUserId });
      if (result.success) {
        setUnlockModalOpen(false);
        setUnlockReason('');
        onLockChange();
      } else {
        setUnlockError(result.error || 'Failed to unlock order');
      }
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : 'Failed to unlock order');
    } finally {
      setUnlocking(false);
    }
  };

  const formatDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return s;
    }
  };

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return '0:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Only show for ORDER_COMPLETED
  if (orderStatus !== 'ORDER_COMPLETED') return null;

  // --- Not locked: show Lock button (only for R/W users) ---
  if (!isLocked) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="bg-blue-500 rounded-full p-2.5 sm:p-3 flex-shrink-0">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-blue-900 mb-1 text-base sm:text-lg">
                Order completed – ready to lock
              </h3>
              <p className="text-xs sm:text-sm text-blue-800">
                Lock this order to prevent any further changes. Once locked, you can unlock it within {UNLOCK_WINDOW_DAYS} days; after that it stays locked.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasWriteAccess && (
              <button
                type="button"
                onClick={handleLock}
                disabled={locking}
                className="flex-1 sm:flex-none px-4 py-3 sm:py-2 min-h-[44px] text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
              >
                <Lock className="w-4 h-4 shrink-0" />
                {locking ? 'Locking…' : 'Lock order'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Locked: show who/when and unlock countdown or permanently locked ---
  return (
    <>
      <div className={`rounded-xl p-4 sm:p-6 shadow-lg border-2 ${
        isPermanentlyLocked
          ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300'
          : 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <div className={`rounded-full p-2.5 sm:p-3 flex-shrink-0 ${isPermanentlyLocked ? 'bg-red-500' : 'bg-amber-500'}`}>
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className={`font-bold mb-1 sm:mb-2 text-base sm:text-lg ${isPermanentlyLocked ? 'text-red-900' : 'text-amber-900'}`}>
                Order locked
              </h3>
              <div className="space-y-1 text-xs sm:text-sm">
                {lockedByName && (
                  <p className={`flex items-center gap-2 ${isPermanentlyLocked ? 'text-red-800' : 'text-amber-800'}`}>
                    <User className="w-4 h-4 flex-shrink-0" />
                    Locked by: <strong>{lockedByName}</strong>
                  </p>
                )}
                {lockedAt && (
                  <p className={`flex items-center gap-2 ${isPermanentlyLocked ? 'text-red-800' : 'text-amber-800'}`}>
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    Locked at: <strong>{formatDate(lockedAt)}</strong>
                  </p>
                )}
              </div>
              {isPermanentlyLocked ? (
                <p className="mt-2 text-sm text-red-800">
                  The {UNLOCK_WINDOW_DAYS}-day unlock window has ended. This order can no longer be unlocked or edited.
                </p>
              ) : (
                <p className="mt-2 text-sm text-amber-800">
                  You can unlock this order within {UNLOCK_WINDOW_DAYS} days of the lock time. After that, it will be permanently locked.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasWriteAccess && canUnlock && (
              <button
                type="button"
                onClick={() => setUnlockModalOpen(true)}
                className="w-full sm:w-auto px-4 py-3 sm:py-2 min-h-[44px] text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 touch-manipulation"
              >
                <Unlock className="w-4 h-4 shrink-0" />
                Unlock order
              </button>
            )}
          </div>
        </div>

        {/* Unlock countdown (when within window) */}
        {canUnlock && timeRemaining !== null && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-amber-200">
            <p className="text-xs sm:text-sm font-medium text-amber-800 mb-1 sm:mb-2">Time left to unlock</p>
            <div className="text-2xl font-mono font-bold text-amber-700">
              {formatTimeRemaining(timeRemaining)}
            </div>
          </div>
        )}
      </div>

      {/* Unlock modal */}
      {unlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">Unlock order</h3>
            <p className="text-sm text-gray-600 mb-3 sm:mb-4">
              You must provide a reason to unlock this order.
            </p>
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Reason for unlocking (required)"
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            {unlockError && (
              <p className="mt-2 text-sm text-red-600">{unlockError}</p>
            )}
            <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setUnlockModalOpen(false); setUnlockReason(''); setUnlockError(null); }}
                className="px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={unlocking || !unlockReason.trim()}
                className="px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
              >
                <Unlock className="w-4 h-4 shrink-0" />
                {unlocking ? 'Unlocking…' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
