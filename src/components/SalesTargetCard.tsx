import { TrendingUp, Package, Calendar, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { SalesTargetProgress } from '../types/sales-targets';

interface SalesTargetCardProps {
  targetProgress: SalesTargetProgress;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: 'active' | 'completed' | 'cancelled') => void;
  hasWriteAccess?: boolean; // Whether user can edit/delete targets
}

export function SalesTargetCard({ targetProgress, onEdit, onDelete, onStatusChange, hasWriteAccess = true }: SalesTargetCardProps) {
  const { target, current_value, progress_percentage, is_achieved, days_remaining } = targetProgress;

  // Check if target period has ended (days_remaining will be negative if expired)
  const isExpired = days_remaining <= 0;
  const effectiveStatus = isExpired && target.status === 'active' ? 'expired' : target.status;

  const formatValue = (value: number) => {
    if (target.target_type === 'sales_revenue') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toFixed(2);
  };

  // Determine if target is exceeded
  const isExceeded = current_value > target.target_value;

  const getRemainingLabel = () => {
    return isExceeded ? 'Exceeded' : 'Remaining';
  };

  const getRemainingValue = () => {
    return Math.abs(target.target_value - current_value);
  };

  const getProgressColor = () => {
    if (is_achieved) return 'bg-emerald-500';
    if (progress_percentage >= 75) return 'bg-blue-500';
    if (progress_percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusBadge = () => {
    switch (effectiveStatus) {
      case 'active':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md">Active</span>;
      case 'expired':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-md">Expired</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-md">Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">Cancelled</span>;
    }
  };

  const getFulfillmentComment = () => {
    // Calculate total period duration in days
    const totalPeriodDays = Math.ceil((new Date(target.period_end).getTime() - new Date(target.period_start).getTime()) / (1000 * 60 * 60 * 24));
    // Calculate percentage of time remaining
    const daysRemainingPercent = totalPeriodDays > 0 ? Math.max(0, (days_remaining / totalPeriodDays) * 100) : 0;
    
    // Target achieved
    if (is_achieved) {
      if (days_remaining > 7) {
        return {
          text: '🎉 Target Achieved Early! Outstanding performance!',
          color: 'text-emerald-600 bg-emerald-50',
        };
      } else if (days_remaining > 0) {
        return {
          text: '🎉 Target Achieved! Excellent work!',
          color: 'text-emerald-600 bg-emerald-50',
        };
      } else {
        return {
          text: '✅ Target Completed Successfully!',
          color: 'text-emerald-600 bg-emerald-50',
        };
      }
    }
    
    // Expired but not achieved
    if (isExpired) {
      if (progress_percentage >= 90) {
        return {
          text: '😔 So close! Target missed by a small margin.',
          color: 'text-orange-600 bg-orange-50',
        };
      } else if (progress_percentage >= 75) {
        return {
          text: '⚠️ Target not met. Good effort but fell short.',
          color: 'text-orange-600 bg-orange-50',
        };
      } else {
        return {
          text: '❌ Target missed. Review and plan better next time.',
          color: 'text-red-600 bg-red-50',
        };
      }
    }
    
    // Active targets - consider both progress and time
    if (progress_percentage >= 90) {
      return {
        text: '🔥 Almost there! Just a little more to go!',
        color: 'text-blue-600 bg-blue-50',
      };
    } else if (progress_percentage >= 75) {
      if (daysRemainingPercent < 25) {
        return {
          text: '⏰ Good progress but time is running out! Sprint to finish!',
          color: 'text-amber-600 bg-amber-50',
        };
      }
      return {
        text: '💪 Great progress! Keep up the momentum!',
        color: 'text-indigo-600 bg-indigo-50',
      };
    } else if (progress_percentage >= 50) {
      if (daysRemainingPercent < 30) {
        return {
          text: '🚨 Halfway but running out of time! Urgent action needed!',
          color: 'text-red-600 bg-red-50',
        };
      }
      return {
        text: '📈 Halfway there! Push harder to reach the goal!',
        color: 'text-amber-600 bg-amber-50',
      };
    } else if (progress_percentage >= 25) {
      if (daysRemainingPercent < 50) {
        return {
          text: '🚨 Critical! Behind schedule - immediate action required!',
          color: 'text-red-600 bg-red-50',
        };
      }
      return {
        text: '⚠️ Needs attention! Accelerate efforts to meet target!',
        color: 'text-orange-600 bg-orange-50',
      };
    } else {
      return {
        text: '🚨 Critical! Significant effort required immediately!',
        color: 'text-red-600 bg-red-50',
      };
    }
  };

  const fulfillmentComment = getFulfillmentComment();

  const getTargetTypeLabel = () => {
    return target.target_type === 'sales_quantity' ? 'Quantity Target' : 'Revenue Target';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-slate-200">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              {target.target_type === 'sales_quantity' ? (
                <Package className="w-4 h-4 text-indigo-600" />
              ) : (
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{target.target_name}</h3>
              <p className="text-xs text-indigo-600 font-semibold mt-0.5">{getTargetTypeLabel()}</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
        
        <p className="text-xs text-slate-600 mt-2">
          Product: {target.tag_name || 'All Products'}
        </p>
        
        {target.description && (
          <p className="text-sm text-slate-600 mt-2">{target.description}</p>
        )}
      </div>

      {/* Progress */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Progress</span>
          <span className="text-sm font-bold text-slate-900">{progress_percentage.toFixed(1)}%</span>
        </div>
        
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
            style={{ width: `${Math.min(progress_percentage, 100)}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-600 mb-1">Target</div>
            <div className="font-bold text-slate-900 text-sm">{formatValue(target.target_value)}</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-600 mb-1">Current</div>
            <div className="font-bold text-blue-700 text-sm">{formatValue(current_value)}</div>
          </div>
          <div className={`text-center p-3 rounded-lg ${isExceeded ? 'bg-purple-50' : 'bg-amber-50'}`}>
            <div className={`text-xs mb-1 ${isExceeded ? 'text-purple-600' : 'text-amber-600'}`}>{getRemainingLabel()}</div>
            <div className={`font-bold text-sm ${isExceeded ? 'text-purple-700' : 'text-amber-700'}`}>{formatValue(getRemainingValue())}</div>
          </div>
        </div>

        {/* Period & Days */}
        <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}</span>
          </div>
          <div className={`font-semibold ${isExpired ? 'text-orange-600' : days_remaining > 7 ? 'text-slate-600' : 'text-red-600'}`}>
            {isExpired ? 'Expired' : `${days_remaining} days left`}
          </div>
        </div>

        {/* Fulfillment Comment */}
        <div className={`mb-4 pb-4 border-b px-3 py-2 rounded-lg ${fulfillmentComment.color}`}>
          <p className={`text-xs font-semibold ${fulfillmentComment.color.split(' ')[0]}`}>
            {fulfillmentComment.text}
          </p>
        </div>

        {/* Actions */}
        {hasWriteAccess ? (
          <div className="flex gap-2">
            {effectiveStatus === 'active' && !isExpired && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                {is_achieved && (
                  <button
                    type="button"
                    onClick={() => onStatusChange('completed')}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onStatusChange('cancelled')}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
            {effectiveStatus === 'expired' && (
              <>
                {is_achieved ? (
                  <button
                    type="button"
                    onClick={() => onStatusChange('completed')}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Completed
                  </button>
                ) : (
                  <div className="flex-1 text-center px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium">
                    Target period ended
                  </div>
                )}
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            {(effectiveStatus === 'completed' || effectiveStatus === 'cancelled') && (
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        ) : (
          <div className="text-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
            View-only access • Contact admin to modify targets
          </div>
        )}
      </div>
    </div>
  );
}
